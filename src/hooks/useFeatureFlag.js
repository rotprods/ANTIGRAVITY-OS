// OCULOPS — Feature Flag Hook
// Kill-switches for agents, modules, and integrations.
// Flags are loaded once per session and cached in memory.

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from './useOrg'

// Module-level cache — survives re-renders, resets on org change
const flagCache = new Map()
let cacheOrgId = null
let cacheLoading = false
let cacheListeners = new Set()

function emitFlagChange() {
  cacheListeners.forEach(fn => fn())
}

async function loadFlags(orgId) {
  if (cacheLoading) return
  if (cacheOrgId === orgId && flagCache.size > 0) return

  cacheLoading = true
  cacheOrgId = orgId
  flagCache.clear()

  const { data } = await supabase
    .from('feature_flags')
    .select('key, enabled')
    .or(`org_id.is.null,org_id.eq.${orgId || '00000000-0000-0000-0000-000000000000'}`)

  if (data) {
    // Global flags first, then org overrides win
    data.forEach(({ key, enabled }) => {
      flagCache.set(key, enabled)
    })
  }

  cacheLoading = false
  emitFlagChange()
}

/**
 * Returns true if the flag is enabled, false if disabled.
 * Defaults to true while loading (fail-open — don't break UI).
 */
export function useFeatureFlag(key) {
  const { currentOrg } = useOrg()
  const [, forceUpdate] = useState(0)
  const orgId = currentOrg?.id

  useEffect(() => {
    const refresh = () => forceUpdate(n => n + 1)
    cacheListeners.add(refresh)
    loadFlags(orgId)
    return () => cacheListeners.delete(refresh)
  }, [orgId])

  if (!flagCache.has(key)) return true   // fail-open while loading
  return flagCache.get(key)
}

/**
 * Returns all flags as { key: boolean } map.
 */
export function useAllFlags() {
  const { currentOrg } = useOrg()
  const [, forceUpdate] = useState(0)
  const orgId = currentOrg?.id

  useEffect(() => {
    const refresh = () => forceUpdate(n => n + 1)
    cacheListeners.add(refresh)
    loadFlags(orgId)
    return () => cacheListeners.delete(refresh)
  }, [orgId])

  return Object.fromEntries(flagCache)
}

/**
 * Imperative toggle — for Settings UI.
 * Updates DB + local cache immediately.
 */
export async function setFeatureFlag(key, enabled, orgId = null) {
  const { error } = await supabase
    .from('feature_flags')
    .upsert({ key, enabled, org_id: orgId, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (!error) {
    flagCache.set(key, enabled)
    emitFlagChange()
  }

  return !error
}

/**
 * Invalidate cache — call after bulk changes.
 */
export function invalidateFlagCache() {
  cacheOrgId = null
  flagCache.clear()
  emitFlagChange()
}
