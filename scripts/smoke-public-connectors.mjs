#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  PUBLIC_API_ADAPTER_TEMPLATES,
  buildConnectorInstallPayload,
  validateConnectorCredentials,
} from '../src/lib/publicApiConnectorTemplates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REQUIRED_USER_CONNECTOR_COUNT = 11;
const BASE_HEADERS = {
  'Content-Type': 'application/json',
};

function normalizeError(error) {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  return String(error);
}

async function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  } catch {
    // optional
  }
}

function formatTemplateEnvPrefix(templateKey = '') {
  return templateKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function buildExpectedEnvelope(result) {
  return Boolean(
    result
    && Object.prototype.hasOwnProperty.call(result, 'ok')
    && Object.prototype.hasOwnProperty.call(result, 'status')
    && Object.prototype.hasOwnProperty.call(result, 'connector_id')
    && Object.prototype.hasOwnProperty.call(result, 'endpoint_name')
    && Object.prototype.hasOwnProperty.call(result, 'normalized')
    && Object.prototype.hasOwnProperty.call(result, 'raw')
    && Object.prototype.hasOwnProperty.call(result, 'data')
    && Object.prototype.hasOwnProperty.call(result, 'meta')
  );
}

async function invokeApiProxy({ supabaseUrl, userJwt, payload }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${userJwt}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function ensureConnector({ admin, catalogEntry, template }) {
  const existingQuery = await admin
    .from('api_connectors')
    .select('*')
    .eq('catalog_slug', catalogEntry.slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingQuery.error) throw existingQuery.error;
  if (existingQuery.data) return { connector: existingQuery.data, installed: false };

  const payload = buildConnectorInstallPayload(catalogEntry, template);
  const insertQuery = await admin
    .from('api_connectors')
    .insert(payload)
    .select('*')
    .single();

  if (insertQuery.error) throw insertQuery.error;
  return { connector: insertQuery.data, installed: true };
}

function buildAuthValidationPayload(template, connector) {
  const defaults = {
    ...(template.authConfigDefaults || {}),
    ...((connector && typeof connector.auth_config === 'object' && connector.auth_config !== null) ? connector.auth_config : {}),
  };

  for (const field of template.authRequirements?.requiredFields || []) {
    if (!defaults[field]) {
      const prefix = formatTemplateEnvPrefix(template.templateKey);
      const fromEnv = process.env[`${prefix}_${field.toUpperCase()}`] || process.env[`CONNECTOR_${prefix}_${field.toUpperCase()}`];
      defaults[field] = fromEnv || `placeholder-${field}`;
    }
  }

  return defaults;
}

async function main() {
  await loadEnvFile();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
  const userJwt = process.env.SMOKE_CONNECTOR_USER_JWT || process.env.SMOKE_USER_JWT || null;

  const templates = PUBLIC_API_ADAPTER_TEMPLATES.filter(template => !template.internalOnly);
  if (templates.length !== REQUIRED_USER_CONNECTOR_COUNT) {
    throw new Error(`Expected ${REQUIRED_USER_CONNECTOR_COUNT} user-facing adapter templates, found ${templates.length}`);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('[smoke-public-connectors] SKIP: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  const failures = [];

  for (const template of templates) {
    const row = {
      templateKey: template.templateKey,
      catalogSlug: template.catalogSlug,
      installed: false,
      checks: [],
    };

    try {
      const entryQuery = await admin
        .from('api_catalog_entries')
        .select('*')
        .eq('slug', template.catalogSlug)
        .maybeSingle();

      if (entryQuery.error) throw entryQuery.error;
      const catalogEntry = entryQuery.data;
      if (!catalogEntry) throw new Error('Catalog entry missing');

      if (!['adapter_ready', 'live'].includes(catalogEntry.activation_tier)) {
        throw new Error(`Catalog entry tier is ${catalogEntry.activation_tier}, expected adapter_ready/live`);
      }
      row.checks.push('catalog-entry');

      const connectorResult = await ensureConnector({ admin, catalogEntry, template });
      row.installed = true;
      row.checks.push(connectorResult.installed ? 'connector-installed' : 'connector-existing');
      const connector = connectorResult.connector;

      const strictValidation = validateConnectorCredentials(template, {});
      if ((template.authRequirements?.requiredFields || []).length > 0 && strictValidation.valid) {
        throw new Error('Credential validator should reject empty required credentials');
      }
      row.checks.push('credential-validation-empty');

      const validAuth = buildAuthValidationPayload(template, connector);
      const passValidation = validateConnectorCredentials(template, validAuth);
      if (!passValidation.valid) {
        throw new Error(`Credential validator rejected defaults: ${passValidation.errors.join(', ')}`);
      }
      row.checks.push('credential-validation-ready');

      if (!userJwt) {
        row.checks.push('proxy-skipped-no-user-jwt');
        results.push(row);
        continue;
      }

      const healthPayload = {
        connector_id: connector.id,
        endpoint_name: template.endpointName,
        params: template.healthcheckEndpoint?.sampleParams || {},
        healthcheck: true,
      };

      const health = await invokeApiProxy({ supabaseUrl, userJwt, payload: healthPayload });
      if (!buildExpectedEnvelope(health.data)) {
        throw new Error(`Healthcheck envelope invalid (HTTP ${health.response.status})`);
      }
      row.checks.push('health-envelope');

      if (!health.data.ok) {
        row.checks.push(`health-not-ok:${health.data?.meta?.normalizer_key || 'none'}`);
        results.push(row);
        continue;
      }

      const executePayload = {
        connector_id: connector.id,
        endpoint_name: template.endpointName,
        params: template.endpoints?.[0]?.sampleParams || {},
        body: {},
        healthcheck: false,
      };

      const execute = await invokeApiProxy({ supabaseUrl, userJwt, payload: executePayload });
      if (!buildExpectedEnvelope(execute.data)) {
        throw new Error(`Execution envelope invalid (HTTP ${execute.response.status})`);
      }
      row.checks.push('execute-envelope');

      if (!Object.is(execute.data.data, execute.data.raw)) {
        throw new Error('Envelope compatibility alias check failed: data must alias raw');
      }
      row.checks.push('data-alias');

      results.push(row);
    } catch (error) {
      failures.push({
        templateKey: template.templateKey,
        error: normalizeError(error),
      });
      results.push({
        ...row,
        error: normalizeError(error),
      });
    }
  }

  console.table(results.map(row => ({
    templateKey: row.templateKey,
    installed: row.installed,
    checks: row.checks.join(', '),
    error: row.error || '',
  })));

  if (failures.length > 0) {
    console.error(`[smoke-public-connectors] ${failures.length} connector(s) failed.`);
    failures.forEach(failure => console.error(` - ${failure.templateKey}: ${failure.error}`));
    process.exitCode = 1;
    return;
  }

  console.log(`[smoke-public-connectors] All ${results.length} connector smoke checks passed.`);
}

main().catch((error) => {
  console.error('[smoke-public-connectors] failed:', normalizeError(error));
  process.exitCode = 1;
});
