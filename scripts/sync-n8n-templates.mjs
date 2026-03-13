#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { buildN8nTemplateCatalogSnapshot } from '../src/lib/n8nTemplateCatalog.js'

const SOURCE_URL = 'https://api.n8n.io/templates/workflows'
const CATEGORIES_URL = 'https://api.n8n.io/templates/categories'
const UPSERT_CHUNK_SIZE = 200

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const SEED_OUTPUT_FILE = path.join(ROOT_DIR, 'src/data/n8nTemplateCatalog.seed.json')
const PUBLIC_CATALOG_DIR = path.join(ROOT_DIR, 'public/n8n-template-catalog')
const PUBLIC_SHARDS_DIR = path.join(PUBLIC_CATALOG_DIR, 'shards')

function toPrettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function chunk(items, size = UPSERT_CHUNK_SIZE) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function normalizeError(error) {
  if (!error) return 'Unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const message = error.message || error.error_description || error.details || error.hint
    if (message) return String(message)
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

async function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env')
  try {
    const content = await fs.readFile(envPath, 'utf8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const [key, ...rest] = line.split('=')
      const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value
      }
    }
  } catch {
    // .env is optional
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`)
  }
  return response.json()
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function replaceDirectoryContents(dir) {
  await ensureDir(dir)
  const entries = await fs.readdir(dir).catch(() => [])
  await Promise.all(entries.map(async entry => {
    await fs.rm(path.join(dir, entry), { recursive: true, force: true })
  }))
}

function buildShardPayload(snapshot) {
  const grouped = new Map()

  for (const entry of snapshot.entries || []) {
    const numericId = Number(entry.template_id)
    const bucket = Number.isFinite(numericId)
      ? `b${numericId % 24}`
      : 'b0'
    const rows = grouped.get(bucket) || []
    rows.push(entry)
    grouped.set(bucket, rows)
  }

  const shards = [...grouped.entries()]
    .map(([bucket, entries]) => ({
      bucket,
      count: entries.length,
      path: `./shards/${bucket}.json`,
      entries,
    }))
    .sort((left, right) => left.bucket.localeCompare(right.bucket))

  return {
    index: {
      generated_at: snapshot.generated_at,
      source: snapshot.source,
      sync_run: snapshot.sync_run,
      stats: snapshot.stats,
      shards: shards.map(({ bucket, count, path: shardPath }) => ({
        bucket,
        count,
        path: shardPath,
      })),
    },
    full: {
      generated_at: snapshot.generated_at,
      source: snapshot.source,
      sync_run: snapshot.sync_run,
      stats: snapshot.stats,
      entries: snapshot.entries,
    },
    shardFiles: shards.map(shard => ({
      path: path.join(PUBLIC_SHARDS_DIR, `${shard.bucket}.json`),
      payload: {
        bucket: shard.bucket,
        count: shard.count,
        entries: shard.entries,
      },
    })),
  }
}

async function writeCatalogArtifacts(snapshot) {
  await ensureDir(path.dirname(SEED_OUTPUT_FILE))
  await fs.writeFile(SEED_OUTPUT_FILE, toPrettyJson(snapshot), 'utf8')

  await replaceDirectoryContents(PUBLIC_SHARDS_DIR)
  const shardPayload = buildShardPayload(snapshot)

  await ensureDir(PUBLIC_CATALOG_DIR)
  await fs.writeFile(path.join(PUBLIC_CATALOG_DIR, 'index.json'), toPrettyJson(shardPayload.index), 'utf8')
  await fs.writeFile(path.join(PUBLIC_CATALOG_DIR, 'full.json'), toPrettyJson(shardPayload.full), 'utf8')

  for (const file of shardPayload.shardFiles) {
    await fs.writeFile(file.path, toPrettyJson(file.payload), 'utf8')
  }

  return shardPayload.index.shards.length
}

async function createSyncRun(supabase, snapshot, startedAt) {
  const { data, error } = await supabase
    .from('n8n_template_sync_runs')
    .insert({
      source_url: snapshot.sync_run.source_url || SOURCE_URL,
      entry_count: 0,
      installable_count: 0,
      install_ready_count: 0,
      priority_count: 0,
      status: 'running',
      started_at: startedAt,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function completeSyncRun(supabase, runId, snapshot, status, errorMessage = null) {
  const payload = {
    source_url: snapshot.sync_run.source_url || SOURCE_URL,
    entry_count: snapshot.stats.total,
    installable_count: snapshot.stats.installable,
    install_ready_count: snapshot.stats.installReady,
    priority_count: snapshot.stats.priority,
    status,
    error: errorMessage,
    finished_at: new Date().toISOString(),
  }

  await supabase
    .from('n8n_template_sync_runs')
    .update(payload)
    .eq('id', runId)
}

async function syncToSupabase(snapshot, startedAt) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      skipped: true,
      reason: 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL missing',
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let runId = null

  try {
    const run = await createSyncRun(supabase, snapshot, startedAt)
    runId = run.id

    const { data: existingEntries, error: existingEntriesError } = await supabase
      .from('n8n_template_entries')
      .select('template_id,first_seen_at')
      .limit(12000)

    if (existingEntriesError) throw existingEntriesError

    const existingFirstSeen = new Map(
      (existingEntries || []).map(entry => [Number(entry.template_id), entry.first_seen_at || startedAt])
    )

    const now = new Date().toISOString()
    const nextEntries = snapshot.entries.map(entry => ({
      ...entry,
      first_seen_at: existingFirstSeen.get(Number(entry.template_id)) || now,
      last_seen_at: now,
      sync_run_id: runId,
    }))

    for (const rows of chunk(nextEntries, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase
        .from('n8n_template_entries')
        .upsert(rows, { onConflict: 'template_id' })

      if (error) throw error
    }

    const nextTemplateIds = new Set(nextEntries.map(entry => Number(entry.template_id)))
    const missingTemplateIds = (existingEntries || [])
      .map(entry => Number(entry.template_id))
      .filter(templateId => !nextTemplateIds.has(templateId))

    for (const ids of chunk(missingTemplateIds, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase
        .from('n8n_template_entries')
        .update({ is_listed: false, sync_run_id: runId })
        .in('template_id', ids)

      if (error) throw error
    }

    await completeSyncRun(supabase, runId, snapshot, 'completed', null)

    return {
      skipped: false,
      runId,
      upsertedEntries: nextEntries.length,
      delistedEntries: missingTemplateIds.length,
    }
  } catch (error) {
    if (runId) {
      await completeSyncRun(supabase, runId, snapshot, 'failed', normalizeError(error))
    }
    throw error
  }
}

async function fetchSnapshot(startedAt) {
  const [workflowPayload, categoryPayload] = await Promise.all([
    fetchJson(SOURCE_URL),
    fetchJson(CATEGORIES_URL).catch(() => ({ categories: [] })),
  ])

  const workflows = workflowPayload.workflows || []
  const snapshot = buildN8nTemplateCatalogSnapshot({
    workflows,
    syncedAt: startedAt,
  })

  snapshot.sync_run.total_workflows = Number(workflowPayload.totalWorkflows || workflows.length)
  snapshot.sync_run.category_count = Number(categoryPayload.categories?.length || 0)

  return snapshot
}

async function main() {
  await loadEnvFile()
  const startedAt = new Date().toISOString()

  console.log('[sync-n8n-templates] Fetching n8n template catalog...')
  const snapshot = await fetchSnapshot(startedAt)

  const shardCount = await writeCatalogArtifacts(snapshot)
  console.log(
    `[sync-n8n-templates] Wrote seed + shards (${snapshot.stats.total} templates across ${shardCount} shards, installable=${snapshot.stats.installable}, priority=${snapshot.stats.priority}).`
  )

  try {
    const dbResult = await syncToSupabase(snapshot, startedAt)
    if (dbResult.skipped) {
      console.log(`[sync-n8n-templates] Supabase sync skipped: ${dbResult.reason}`)
    } else {
      console.log(
        `[sync-n8n-templates] Supabase sync completed: run=${dbResult.runId}, upserted=${dbResult.upsertedEntries}, delisted=${dbResult.delistedEntries}.`
      )
    }
  } catch (error) {
    console.warn(`[sync-n8n-templates] Supabase sync warning: ${normalizeError(error)}`)
  }
}

main().catch(error => {
  console.error('[sync-n8n-templates] failed:', normalizeError(error))
  process.exitCode = 1
})
