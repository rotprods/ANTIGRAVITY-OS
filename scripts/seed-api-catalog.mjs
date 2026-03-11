/**
 * OCULOPS — Seed api_catalog Supabase table
 * Reads src/data/api-mega-catalog.json → inserts in batches
 *
 * Usage: node scripts/seed-api-catalog.mjs
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env manually (no dotenv dep needed)
async function loadEnv() {
  try {
    const env = await fs.readFile(path.join(__dirname, '../.env'), 'utf8');
    for (const line of env.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* .env optional */ }
}

async function main() {
  await loadEnv();

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const catalogPath = path.join(__dirname, '../src/data/api-mega-catalog.json');
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const apis = catalog.apis;

  console.log(`Seeding ${apis.length} APIs to Supabase api_catalog...`);

  // Clear existing (idempotent)
  const clearRes = await fetch(`${url}/rest/v1/api_catalog?id=gte.1`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
  });
  if (!clearRes.ok) {
    const t = await clearRes.text();
    console.warn('Clear warning:', t.slice(0, 200));
  } else {
    console.log('  Cleared existing rows.');
  }

  // Insert in batches of 500
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < apis.length; i += BATCH) {
    const batch = apis.slice(i, i + BATCH).map((a) => ({
      name: a.name?.slice(0, 255) || '',
      url: a.url?.slice(0, 500) || '',
      docs: a.docs?.slice(0, 500) || '',
      description: a.description?.slice(0, 500) || '',
      category: a.category?.slice(0, 100) || 'General',
      auth: a.auth?.slice(0, 50) || 'unknown',
      stars: typeof a.stars === 'number' ? a.stars : null,
      source: a.source?.slice(0, 50) || '',
    }));

    const res = await fetch(`${url}/rest/v1/api_catalog`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`  Batch ${i}-${i + BATCH} failed:`, t.slice(0, 300));
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted: ${inserted}/${apis.length}`);
    }
  }

  console.log(`\n\nDone. ${inserted} APIs seeded to api_catalog.`);
  console.log('Copilot tool api_catalog_search is now active.');
}

main().catch(console.error);
