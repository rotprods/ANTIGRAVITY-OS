// OCULOPS — Billing Hook
// Wraps billing-engine edge function calls

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from './useOrg'

const BILLING_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing-engine`

async function callBilling(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(BILLING_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...params }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Billing request failed')
  return data
}

export function useBilling() {
  const { currentOrg } = useOrg()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchStatus = useCallback(async () => {
    if (!currentOrg?.id) return
    setLoading(true)
    try {
      const data = await callBilling('get_status', { org_id: currentOrg.id })
      setStatus(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [currentOrg?.id])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const startCheckout = useCallback(async (priceId) => {
    if (!currentOrg?.id) throw new Error('No org')
    const { checkout_url } = await callBilling('create_checkout', { org_id: currentOrg.id, price_id: priceId })
    window.location.href = checkout_url
  }, [currentOrg?.id])

  const openPortal = useCallback(async () => {
    if (!currentOrg?.id) throw new Error('No org')
    const { portal_url } = await callBilling('get_portal', { org_id: currentOrg.id })
    window.open(portal_url, '_blank')
  }, [currentOrg?.id])

  return { status, loading, error, startCheckout, openPortal, refetch: fetchStatus }
}
