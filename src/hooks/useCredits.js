import { useCallback, useEffect, useState } from 'react'
import { callSupabaseFunction, supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

async function callEngine(action, body = {}) {
  try {
    return await callSupabaseFunction(`credit-engine?action=${encodeURIComponent(action)}`, { body })
  } catch (error) {
    return { error: error.message }
  }
}

export function useCredits() {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [tier, setTier] = useState('free')
  const [stakedAmount, setStakedAmount] = useState(0)
  const [pricing, setPricing] = useState([])
  const [history, setHistory] = useState([])
  const [deflation, setDeflation] = useState(null)
  const [loading, setLoading] = useState(true)
  const userId = user?.id || null

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      callEngine('check-balance', { userId }),
      callEngine('pricing'),
    ]).then(([balRes, priceRes]) => {
      setBalance(balRes?.balance || 0)
      setTier(balRes?.tier || 'free')
      setStakedAmount(balRes?.stakedAmount || 0)
      setPricing(priceRes?.pricing || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('credit_balance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_accounts' }, (payload) => {
        if (payload.new?.user_id === userId) {
          setBalance(payload.new.balance)
          setTier(payload.new.tier)
          setStakedAmount(payload.new.staked_amount)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId])

  const canAfford = useCallback(async (action) => {
    if (!userId) return { canAfford: false }
    return callEngine('can-afford', { userId, action })
  }, [userId])

  const debit = useCallback(async (action, correlationId) => {
    if (!userId) return { error: 'Not logged in' }
    const r = await callEngine('debit', { userId, action, correlationId })
    if (r.success) setBalance(r.balanceAfter)
    return r
  }, [userId])

  const credit = useCallback(async (amount, action, type = 'credit', correlationId) => {
    if (!userId) return { error: 'Not logged in' }
    const r = await callEngine('credit', { userId, amount, action, type, correlationId })
    if (r.success) setBalance(r.balanceAfter)
    return r
  }, [userId])

  const purchase = useCallback(async (amountFiat, currency = 'EUR') => {
    if (!userId) return { error: 'Not logged in' }
    const r = await callEngine('purchase', { userId, amountFiat, currency })
    if (r.success) setBalance(r.newBalance)
    return r
  }, [userId])

  const stake = useCallback(async (amount) => {
    if (!userId) return { error: 'Not logged in' }
    const r = await callEngine('stake', { userId, amount })
    if (r.success) {
      setBalance(r.balanceAfter)
      setStakedAmount(r.totalStaked)
      setTier(r.tier)
    }
    return r
  }, [userId])

  const unstake = useCallback(async (amount) => {
    if (!userId) return { error: 'Not logged in' }
    const r = await callEngine('unstake', { userId, amount })
    if (r.success) {
      setBalance(r.balanceAfter)
      setStakedAmount(r.totalStaked)
      setTier(r.tier)
    }
    return r
  }, [userId])

  const refreshHistory = useCallback(async (limit = 50) => {
    if (!userId) return
    const r = await callEngine('history', { userId, limit })
    setHistory(r?.transactions || [])
    return r
  }, [userId])

  const refreshDeflation = useCallback(async () => {
    const r = await callEngine('deflation')
    setDeflation(r)
    return r
  }, [])

  const getCost = useCallback((action) => {
    return pricing.find(p => p.action === action)?.cost || 0
  }, [pricing])

  return {
    balance, tier, stakedAmount, pricing, history, deflation, loading, userId,
    canAfford, debit, credit, purchase, stake, unstake,
    refreshHistory, refreshDeflation, getCost,
  }
}
