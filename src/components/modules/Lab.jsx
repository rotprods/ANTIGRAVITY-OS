// ═══════════════════════════════════════════════════
// OCULOPS — Blockchain Laboratory (Chain Dashboard)
// XRPL EVM Sidechain — 100-Year UX
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCredits } from '../../hooks/useCredits'

const CHAIN_BRIDGE_URL = `${import.meta.env.VITE_SUPABASE_URL || 'https://yxzdafptqtcvpsbqkmkm.supabase.co'}/functions/v1/chain-bridge`
const EXPLORER_URL = 'https://explorer.testnet.xrplevm.org'

// --- Helpers ---
function hexToDecimal(hex) {
  if (!hex || hex === 'error') return '—'
  try { return (BigInt(hex) / BigInt(10 ** 18)).toLocaleString() } catch { return '—' }
}
function shortAddr(addr) {
  if (!addr) return '—'
  return addr.slice(0, 6) + '···' + addr.slice(-4)
}
function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
}

function Lab() {
  const [activeTab, setActiveTab] = useState('overview')
  const [chainStatus, setChainStatus] = useState(null)
  const [contracts, setContracts] = useState([])
  const [config, setConfig] = useState([])
  const [wallets, setWallets] = useState([])
  const [settlements, setSettlements] = useState([])
  const [batches, setBatches] = useState([])
  const [transactions, setTransactions] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [escrows, setEscrows] = useState([])
  const [escrowMilestones, setEscrowMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const credits = useCredits()

  // Fetch chain status from bridge
  const fetchChainStatus = useCallback(async () => {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4emRhZnB0cXRjdnBzYnFrbWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NjUwNjIsImV4cCI6MjA4ODM0MTA2Mn0.-Kg8u3DVUq5T8JiJNJMPknzPgDBJVJusRatk_WkTxyU'
      const res = await fetch(`${CHAIN_BRIDGE_URL}?action=status`, {
        headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      setChainStatus(data)
    } catch (e) {
      console.error('Chain bridge error:', e)
      setChainStatus({ status: 'offline', error: e.message })
    }
  }, [])

  // Fetch Supabase data
  const fetchSupabaseData = useCallback(async () => {
    const [contractsRes, configRes, walletsRes, settlementsRes, batchesRes, txRes, auditRes, escrowsRes, milestonesRes] = await Promise.all([
      supabase.from('chain_contracts').select('*').order('name'),
      supabase.from('chain_config').select('*').order('key'),
      supabase.from('chain_wallets').select('*').order('created_at', { ascending: false }),
      supabase.from('chain_settlements').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('chain_settlement_batches').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('chain_transactions').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('chain_audit_log').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('chain_escrows').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('chain_escrow_milestones').select('*').order('milestone_index'),
    ])
    setContracts(contractsRes.data || [])
    setConfig(configRes.data || [])
    setWallets(walletsRes.data || [])
    setSettlements(settlementsRes.data || [])
    setBatches(batchesRes.data || [])
    setTransactions(txRes.data || [])
    setAuditLog(auditRes.data || [])
    setEscrows(escrowsRes.data || [])
    setEscrowMilestones(milestonesRes.data || [])
  }, [])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchChainStatus(), fetchSupabaseData()])
    setRefreshing(false)
  }, [fetchChainStatus, fetchSupabaseData])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchChainStatus(), fetchSupabaseData()]).finally(() => setLoading(false))
  }, [fetchChainStatus, fetchSupabaseData])

  // --- Tab: OVERVIEW ---
  const renderOverview = () => {
    const supply = chainStatus?.onchain?.tokenSupply
    const treasuryBal = chainStatus?.onchain?.treasuryBalance
    const rewardsBal = chainStatus?.onchain?.rewardsBalance
    const totalBatches = chainStatus?.onchain?.totalBatches

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* CHAIN STATUS */}
        <div style={{ border: `1px solid ${chainStatus?.status === 'operational' ? 'var(--color-success)' : 'var(--color-danger)'}`, background: '#000', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="mono text-xs font-bold" style={{ color: '#000', background: chainStatus?.status === 'operational' ? 'var(--color-success)' : 'var(--color-danger)', padding: '4px 8px' }}>
              {chainStatus?.status === 'operational' ? 'CHAIN ONLINE' : 'CHAIN OFFLINE'}
            </div>
            <div>
              <div className="mono font-bold" style={{ fontSize: '14px', color: 'var(--color-text)' }}>XRPL EVM SIDECHAIN — TESTNET</div>
              <div className="mono text-xs text-tertiary">CHAIN ID: {chainStatus?.chainId || '1449000'} // RPC: {chainStatus?.rpc || '—'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: '9px', padding: '4px 8px', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)', textDecoration: 'none' }}>EXPLORER ↗</a>
          </div>
        </div>

        {/* ONCHAIN KPI STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">TOTAL SUPPLY</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{hexToDecimal(supply)} OCUL</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">TREASURY VAULT</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{hexToDecimal(treasuryBal)} OCUL</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">REWARDS POOL</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{hexToDecimal(rewardsBal)} OCUL</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">CIRCULATING</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-info)' }}>
              {supply !== 'error' && treasuryBal !== 'error' && rewardsBal !== 'error'
                ? (hexToDecimal(supply) !== '—' ? `${(Number(hexToDecimal(supply).replace(/,/g, '')) - Number(hexToDecimal(treasuryBal).replace(/,/g, '')) - Number(hexToDecimal(rewardsBal).replace(/,/g, ''))).toLocaleString()}` : '—')
                : '—'
              } OCUL
            </span>
          </div>
        </div>

        {/* TOKEN DISTRIBUTION BAR */}
        <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
          <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// TOKEN DISTRIBUTION</div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', height: '24px', border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ width: '40%', background: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Treasury 40%">
                <span className="mono" style={{ fontSize: '8px', color: '#000', fontWeight: 'bold' }}>TREASURY 40%</span>
              </div>
              <div style={{ width: '25%', background: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Rewards 25%">
                <span className="mono" style={{ fontSize: '8px', color: '#000', fontWeight: 'bold' }}>REWARDS 25%</span>
              </div>
              <div style={{ width: '20%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Team 20%">
                <span className="mono" style={{ fontSize: '8px', color: '#000', fontWeight: 'bold' }}>TEAM 20%</span>
              </div>
              <div style={{ width: '10%', background: 'var(--color-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reserve 10%">
                <span className="mono" style={{ fontSize: '8px', color: '#000', fontWeight: 'bold' }}>RES</span>
              </div>
              <div style={{ width: '5%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Airdrop 5%">
                <span className="mono" style={{ fontSize: '8px', color: '#000', fontWeight: 'bold' }}>AD</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'TREASURY', pct: '40%', amount: '40,000,000', color: 'var(--color-success)' },
                { label: 'REWARDS', pct: '25%', amount: '25,000,000', color: 'var(--color-warning)' },
                { label: 'TEAM/FOUNDER', pct: '20%', amount: '20,000,000', color: 'var(--color-primary)' },
                { label: 'RESERVE', pct: '10%', amount: '10,000,000', color: 'var(--color-info)' },
                { label: 'AIRDROP', pct: '5%', amount: '5,000,000', color: '#8b5cf6' },
              ].map(d => (
                <div key={d.label} className="mono text-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 8, height: 8, background: d.color }} />
                  <span style={{ color: d.color, fontWeight: 'bold' }}>{d.label}</span>
                  <span className="text-tertiary">{d.pct} ({d.amount})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CONTRACTS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {contracts.map(c => (
            <div key={c.id} style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{c.name.toUpperCase()}</span>
                <span className="mono" style={{ fontSize: '9px', color: c.is_active ? 'var(--color-success)' : 'var(--color-danger)', border: `1px solid ${c.is_active ? 'var(--color-success)' : 'var(--color-danger)'}`, padding: '2px 6px' }}>
                  {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="mono text-xs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-tertiary">ADDRESS:</span>
                <a href={`${EXPLORER_URL}/address/${c.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'none' }}>{shortAddr(c.address)}</a>
                <button className="mono" style={{ fontSize: '8px', padding: '1px 4px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)', cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(c.address)}>COPY</button>
              </div>
              <div className="mono text-xs" style={{ display: 'flex', gap: '16px' }}>
                <span className="text-tertiary">CHAIN: <strong style={{ color: 'var(--color-text-2)' }}>{c.chain_name?.toUpperCase()}</strong></span>
                <span className="text-tertiary">VER: <strong style={{ color: 'var(--color-text-2)' }}>{c.version}</strong></span>
              </div>
              <div className="mono text-xs text-tertiary">DEPLOYED: {formatTime(c.deployed_at)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- Tab: WALLETS ---
  const renderWallets = () => (
    <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
      <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// CHAIN WALLETS [{wallets.length}]</div>
      {wallets.length === 0 ? (
        <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO WALLETS REGISTERED. DEPLOY CREATES THE FIRST.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ADDRESS', 'TYPE', 'LABEL', 'STATUS', 'CREATED'].map(h => (
                <th key={h} className="mono text-xs text-tertiary" style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 'normal' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wallets.map(w => (
              <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="mono text-xs" style={{ padding: '10px 16px' }}>
                  <a href={`${EXPLORER_URL}/address/${w.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'none' }}>{shortAddr(w.address)}</a>
                </td>
                <td className="mono text-xs" style={{ padding: '10px 16px' }}>
                  <span style={{ border: '1px solid var(--border-subtle)', padding: '2px 6px', fontSize: '9px', color: 'var(--color-text-2)' }}>{w.wallet_type?.toUpperCase()}</span>
                </td>
                <td className="mono text-xs" style={{ padding: '10px 16px', color: 'var(--color-text)' }}>{(w.label || '—').toUpperCase()}</td>
                <td className="mono text-xs" style={{ padding: '10px 16px' }}>
                  <span style={{ color: w.is_active ? 'var(--color-success)' : 'var(--color-danger)' }}>{w.is_active ? 'ACTIVE' : 'DISABLED'}</span>
                </td>
                <td className="mono text-xs text-tertiary" style={{ padding: '10px 16px' }}>{formatTime(w.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  // --- Tab: SETTLEMENTS ---
  const renderSettlements = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Batch Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
        <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span className="mono text-xs text-tertiary">TOTAL SETTLEMENTS</span>
          <span className="mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{settlements.length}</span>
        </div>
        <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span className="mono text-xs text-tertiary">BATCHES RECORDED</span>
          <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{batches.length}</span>
        </div>
        <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span className="mono text-xs text-tertiary">CONFIRMED ONCHAIN</span>
          <span className="mono text-lg font-bold" style={{ color: 'var(--color-info)' }}>{batches.filter(b => b.status === 'confirmed').length}</span>
        </div>
        <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span className="mono text-xs text-tertiary">TOTAL VOLUME</span>
          <span className="mono text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{batches.reduce((s, b) => s + Number(b.total_amount || 0), 0).toLocaleString()} OCUL</span>
        </div>
      </div>

      {/* Recent Batches */}
      <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// SETTLEMENT BATCHES [{batches.length}]</div>
        {batches.length === 0 ? (
          <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO BATCHES YET. SETTLEMENTS WILL APPEAR HERE.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {batches.map(b => (
              <div key={b.id} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                <span style={{ color: b.status === 'confirmed' ? 'var(--color-success)' : b.status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)', width: '80px', fontWeight: 'bold' }}>[{b.status?.toUpperCase()}]</span>
                <span style={{ color: 'var(--color-text-2)', flex: 1 }}>{shortAddr(b.batch_hash || '')}</span>
                <span className="text-tertiary">{b.settlement_count} SETTLEMENTS</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{Number(b.total_amount || 0).toLocaleString()} OCUL</span>
                <span className="text-tertiary">{formatTime(b.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Individual Settlements */}
      <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// SETTLEMENT LOG [{settlements.length}]</div>
        {settlements.length === 0 ? (
          <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO SETTLEMENTS RECORDED.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {settlements.map(s => (
              <div key={s.id} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                <span style={{ color: s.status === 'confirmed' ? 'var(--color-success)' : s.status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)', width: '80px', fontWeight: 'bold' }}>[{s.status?.toUpperCase()}]</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{Number(s.amount || 0).toLocaleString()} {s.currency}</span>
                <span className="text-tertiary" style={{ flex: 1 }}>{s.correlation_type ? `${s.correlation_type.toUpperCase()} // ${s.correlation_id || '—'}` : 'UNLINKED'}</span>
                <span className="text-tertiary">{formatTime(s.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // --- Tab: TRANSACTIONS ---
  const renderTransactions = () => (
    <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
      <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// CHAIN TRANSACTIONS [{transactions.length}]</div>
      {transactions.length === 0 ? (
        <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO TRANSACTIONS LOGGED. BRIDGE OPERATIONS APPEAR HERE.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {transactions.map(tx => (
            <div key={tx.id} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
              <span style={{ color: tx.status === 'confirmed' ? 'var(--color-success)' : tx.status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)', width: '70px', fontWeight: 'bold' }}>[{tx.status?.toUpperCase()}]</span>
              <a href={`${EXPLORER_URL}/tx/${tx.tx_hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'none', width: '120px' }}>{shortAddr(tx.tx_hash)}</a>
              <span style={{ color: 'var(--color-text)', flex: 1 }}>{(tx.function_name || 'TRANSFER').toUpperCase()}</span>
              <span className="text-tertiary">FROM: {shortAddr(tx.from_address)}</span>
              <span className="text-tertiary">TO: {shortAddr(tx.to_address)}</span>
              <span className="text-tertiary">{formatTime(tx.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // --- Tab: AUDIT LOG ---
  const renderAuditLog = () => (
    <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
      <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// CHAIN AUDIT LOG [{auditLog.length}]</div>
      {auditLog.length === 0 ? (
        <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>AUDIT TRAIL EMPTY. FIRST EVENTS LOGGED ON SETTLEMENT.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {auditLog.map(log => (
            <div key={log.id} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
              <span className="text-tertiary" style={{ width: '120px' }}>{formatTime(log.created_at)}</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', width: '160px' }}>{log.event_type?.toUpperCase()}</span>
              <span style={{ color: 'var(--color-text-2)', flex: 1 }}>{log.entity_type?.toUpperCase()} // {shortAddr(log.entity_id)}</span>
              <span className="text-tertiary">{log.actor_address ? shortAddr(log.actor_address) : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // --- Tab: CONFIG ---
  const renderConfig = () => (
    <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
      <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// CHAIN CONFIGURATION [{config.length}]</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['KEY', 'VALUE', 'DESCRIPTION'].map(h => (
              <th key={h} className="mono text-xs text-tertiary" style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 'normal' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.map(c => (
            <tr key={c.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td className="mono text-xs" style={{ padding: '10px 16px', color: 'var(--color-primary)', fontWeight: 'bold' }}>{c.key.toUpperCase()}</td>
              <td className="mono text-xs" style={{ padding: '10px 16px', color: 'var(--color-text)', wordBreak: 'break-all' }}>{typeof c.value === 'string' ? c.value : JSON.stringify(c.value)}</td>
              <td className="mono text-xs text-tertiary" style={{ padding: '10px 16px' }}>{c.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // --- Tab: CREDITS ---
  const renderCredits = () => {
    const CATEGORY_COLORS = { ai_agent: 'var(--color-info)', intelligence: '#8b5cf6', creative: 'var(--color-success)', execution: 'var(--color-warning)', reports: 'var(--color-text-2)', platform: 'var(--color-text-3)', settlement: 'var(--color-primary)', escrow: '#ec4899' }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Credit Balance KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">YOUR BALANCE</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{credits.balance.toLocaleString()} OCUL</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">TIER</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{credits.tier.toUpperCase()}</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">EXCHANGE RATE</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-text)' }}>1€ = 100 OCUL</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">SIGNUP BONUS</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>100 OCUL</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">ACTIVE PRICING</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-info)' }}>{credits.pricing.length} ACTIONS</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Pricing Table */}
          <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// CREDIT PRICING TABLE</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {credits.pricing.map(p => (
                <div key={p.action} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                  <span style={{ color: CATEGORY_COLORS[p.category] || 'var(--color-text)', fontWeight: 'bold', width: '180px' }}>{p.action.replace(/_/g, ' ').toUpperCase()}</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', width: '80px' }}>{p.cost > 0 ? `${p.cost} OCUL` : 'VARIABLE'}</span>
                  <span className="text-tertiary" style={{ flex: 1 }}>{p.description?.toUpperCase()}</span>
                  <span style={{ border: '1px solid var(--border-subtle)', padding: '1px 5px', fontSize: '8px', color: CATEGORY_COLORS[p.category] || 'var(--color-text-2)' }}>{p.category?.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Purchase */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="section-box--gold" style={{ height: 'fit-content' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'rgba(234,179,8,0.06)', borderBottom: '1px solid var(--color-primary)' }}>/// PURCHASE OCUL CREDITS</div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="mono text-xs text-tertiary">Rate: 1 EUR = 100 OCUL (fixed Phase 1)</div>
                {[10, 50, 100, 500].map(amt => (
                  <button key={amt} className="mono" style={{ padding: '10px', background: '#000', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => credits.purchase(amt)}>
                    <span>€{amt}</span>
                    <span style={{ color: 'var(--color-text-2)' }}>→ {(amt * 100).toLocaleString()} OCUL</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Credit TXs */}
            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>/// CREDIT HISTORY</span>
                <button className="mono" style={{ fontSize: '8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)', cursor: 'pointer', padding: '2px 6px' }} onClick={() => credits.refreshHistory()}>LOAD</button>
              </div>
              {credits.history.length === 0 ? (
                <div className="mono text-xs text-tertiary" style={{ padding: '24px', textAlign: 'center' }}>CLICK LOAD TO FETCH HISTORY</div>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {credits.history.slice(0, 20).map(tx => (
                    <div key={tx.id} className="mono text-xs" style={{ display: 'flex', gap: '12px', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: tx.type === 'debit' ? 'var(--color-danger)' : 'var(--color-success)', width: '60px', fontWeight: 'bold' }}>{tx.type === 'debit' ? '-' : '+'}{tx.amount}</span>
                      <span style={{ color: 'var(--color-text)', flex: 1 }}>{tx.action.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className="text-tertiary">{formatTime(tx.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Tab: ESCROW ---
  const renderEscrow = () => {
    const activeEscrows = escrows.filter(e => e.status === 'active')
    const totalLocked = activeEscrows.reduce((s, e) => s + Number(e.total_amount || 0) - Number(e.amount_released || 0), 0)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Escrow KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">TOTAL ESCROWS</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{escrows.length}</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">ACTIVE</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{activeEscrows.length}</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">OCUL LOCKED</span>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{totalLocked.toLocaleString()}</span>
          </div>
          <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span className="mono text-xs text-tertiary">CONTRACT</span>
            <a href={`${EXPLORER_URL}/address/0xfb7E3A09312b3664eddD71c427bc657f4638A866`} target="_blank" rel="noreferrer" className="mono text-xs" style={{ color: 'var(--color-info)', textDecoration: 'none' }}>0xfb7E···A866 ↗</a>
          </div>
        </div>

        {/* Escrow Contract Info */}
        <div style={{ border: '1px solid var(--color-primary)', background: '#000', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="mono text-xs font-bold" style={{ color: '#000', background: 'var(--color-primary)', padding: '4px 8px' }}>ESCROW ENGINE</div>
            <div>
              <div className="mono font-bold" style={{ fontSize: '14px', color: 'var(--color-text)' }}>OCULOPS ESCROW v1.0</div>
              <div className="mono text-xs text-tertiary">MILESTONE-BASED // ADMIN-MANAGED // FEE: 1% CREATION + 2% RELEASE</div>
            </div>
          </div>
          <div className="mono text-xs" style={{ display: 'flex', gap: '16px' }}>
            <span className="text-tertiary">ADMIN: <strong style={{ color: 'var(--color-primary)' }}>DEPLOYER</strong></span>
            <span className="text-tertiary">MAX MS: <strong style={{ color: 'var(--color-text)' }}>20</strong></span>
          </div>
        </div>

        {/* Active Escrows */}
        <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
          <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// ESCROW REGISTRY [{escrows.length}]</div>
          {escrows.length === 0 ? (
            <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO ESCROWS CREATED YET. CREATE ONE VIA THE CHAIN-BRIDGE API.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {escrows.map(e => {
                const ms = escrowMilestones.filter(m => m.escrow_id === e.id)
                return (
                  <div key={e.id} style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="mono text-xs" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ color: e.status === 'active' ? 'var(--color-warning)' : e.status === 'completed' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>[{e.status?.toUpperCase()}]</span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{Number(e.total_amount || 0).toLocaleString()} OCUL</span>
                      <span className="text-tertiary">{e.milestone_count} MILESTONES // {e.milestones_released || 0} RELEASED</span>
                      <span className="text-tertiary" style={{ marginLeft: 'auto' }}>{formatTime(e.created_at)}</span>
                    </div>
                    {e.description && <div className="mono text-xs text-tertiary" style={{ marginBottom: '8px' }}>{e.description.toUpperCase()}</div>}
                    {/* Milestone progress bar */}
                    <div style={{ display: 'flex', height: '6px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                      {Array.from({ length: e.milestone_count }).map((_, i) => (
                        <div key={i} style={{ flex: 1, background: i < (e.milestones_released || 0) ? 'var(--color-success)' : 'var(--color-bg-2)', borderRight: i < e.milestone_count - 1 ? '1px solid var(--border-subtle)' : 'none' }} />
                      ))}
                    </div>
                    {/* Milestones detail */}
                    {ms.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {ms.map(m => (
                          <span key={m.id} className="mono" style={{ fontSize: '8px', padding: '2px 6px', border: `1px solid ${m.status === 'released' ? 'var(--color-success)' : 'var(--border-subtle)'}`, color: m.status === 'released' ? 'var(--color-success)' : 'var(--color-text-2)' }}>
                            MS{m.milestone_index}: {m.title?.toUpperCase() || `MILESTONE ${m.milestone_index}`} — {Number(m.amount || 0).toLocaleString()} OCUL
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Tab: DEFLATION ---
  const renderDeflation = () => {
    const d = credits.deflation
    const burnPct = d?.metrics?.total_burned && d?.metrics?.max_supply ? ((d.metrics.total_burned / d.metrics.max_supply) * 100).toFixed(4) : '0.0000'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!d ? (
          <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', padding: '32px', textAlign: 'center' }}>
            <button className="mono" onClick={credits.refreshDeflation} style={{ fontSize: '10px', padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', cursor: 'pointer' }}>LOAD DEFLATION METRICS</button>
          </div>
        ) : (
          <>
            {/* Deflation KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
              <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <span className="mono text-xs text-tertiary">TOTAL BURNED</span>
                <span className="mono text-lg font-bold" style={{ color: 'var(--color-danger)' }}>{Number(d.metrics?.total_burned || 0).toLocaleString()} OCUL</span>
                <span className="mono" style={{ fontSize: '8px', color: 'var(--color-danger)' }}>{burnPct}% OF MAX SUPPLY</span>
              </div>
              <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <span className="mono text-xs text-tertiary">PENDING BURNS</span>
                <span className="mono text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{Number(d.metrics?.pending_burns || 0).toLocaleString()}</span>
              </div>
              <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <span className="mono text-xs text-tertiary">EFFECTIVE SUPPLY</span>
                <span className="mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{Number(d.metrics?.effective_supply || 100000000).toLocaleString()}</span>
              </div>
              <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <span className="mono text-xs text-tertiary">TOTAL STAKED</span>
                <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{Number(d.metrics?.total_staked || 0).toLocaleString()}</span>
                <span className="mono" style={{ fontSize: '8px', color: 'var(--color-text-3)' }}>{d.metrics?.stakers_count || 0} STAKERS</span>
              </div>
              <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <span className="mono text-xs text-tertiary">PREMIUM USERS</span>
                <span className="mono text-lg font-bold" style={{ color: '#8b5cf6' }}>{(d.metrics?.pro_users || 0) + (d.metrics?.enterprise_users || 0)}</span>
                <span className="mono" style={{ fontSize: '8px', color: 'var(--color-text-3)' }}>{d.metrics?.pro_users || 0} PRO / {d.metrics?.enterprise_users || 0} ENT</span>
              </div>
            </div>

            {/* Supply Visualization */}
            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-danger)' }}>/// DEFLATIONARY SUPPLY MODEL</div>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', height: '32px', border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ width: `${100 - Number(burnPct)}%`, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', paddingLeft: '8px', transition: 'width 0.5s' }}>
                    <span className="mono" style={{ fontSize: '9px', color: '#000', fontWeight: 'bold' }}>CIRCULATING: {Number(d.metrics?.effective_supply || 100000000).toLocaleString()}</span>
                  </div>
                  {Number(burnPct) > 0 && <div style={{ flex: 1, background: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="mono" style={{ fontSize: '8px', color: '#000', fontWeight: 'bold' }}>🔥 BURNED</span>
                  </div>}
                </div>
                <div className="mono text-xs" style={{ display: 'flex', gap: '24px', color: 'var(--color-text-2)' }}>
                  <span>MAX SUPPLY: <strong style={{ color: 'var(--color-text)' }}>100,000,000</strong></span>
                  <span>BURNED: <strong style={{ color: 'var(--color-danger)' }}>{Number(d.metrics?.total_burned || 0).toLocaleString()}</strong></span>
                  <span>STAKED (LOCKED): <strong style={{ color: 'var(--color-success)' }}>{Number(d.metrics?.total_staked || 0).toLocaleString()}</strong></span>
                  <span>FREE FLOAT: <strong style={{ color: 'var(--color-warning)' }}>{(Number(d.metrics?.effective_supply || 100000000) - Number(d.metrics?.total_staked || 0)).toLocaleString()}</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Autonomous Cron Jobs */}
              <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
                <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-success)' }}>/// AUTONOMOUS CRON JOBS [{d.cronJobs?.length || 0}]</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(d.cronJobs || []).map((job, i) => (
                    <div key={i} className="mono text-xs" style={{ display: 'flex', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, background: 'var(--color-success)', display: 'inline-block', borderRadius: '50%', flexShrink: 0 }} />
                      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', width: '200px' }}>{job.name.toUpperCase()}</span>
                      <span style={{ color: 'var(--color-text-2)', width: '160px' }}>{job.schedule}</span>
                      <span className="text-tertiary" style={{ flex: 1 }}>{job.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staking Tiers */}
              <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
                <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: '#8b5cf6' }}>/// STAKING TIERS</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { tier: 'FREE', min: '0', yield: '0%', color: 'var(--color-text-3)' },
                    { tier: 'STARTER', min: '1+', yield: '0.5%/wk', color: 'var(--color-text-2)' },
                    { tier: 'PRO', min: '1,000', yield: '0.5%/wk + Priority', color: 'var(--color-warning)' },
                    { tier: 'ENTERPRISE', min: '10,000', yield: '0.5%/wk + Priority + Governance', color: '#8b5cf6' },
                  ].map(t => (
                    <div key={t.tier} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                      <span style={{ color: t.color, fontWeight: 'bold', width: '100px' }}>{t.tier}</span>
                      <span className="text-tertiary" style={{ width: '100px' }}>MIN: {t.min} OCUL</span>
                      <span style={{ color: 'var(--color-success)', flex: 1 }}>{t.yield}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reward Distributions */}
            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// REWARD DISTRIBUTIONS [{d.rewardDistributions?.length || 0}]</div>
              {(d.rewardDistributions || []).length === 0 ? (
                <div className="mono text-xs text-tertiary" style={{ padding: '24px', textAlign: 'center' }}>NO DISTRIBUTIONS YET. CRON JOBS WILL EXECUTE ON SCHEDULE.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {d.rewardDistributions.map(rd => (
                    <div key={rd.id} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', width: '60px' }}>E{rd.epoch}</span>
                      <span style={{ color: 'var(--color-warning)', width: '120px' }}>{rd.type.toUpperCase()}</span>
                      <span style={{ color: 'var(--color-success)' }}>{Number(rd.total_distributed).toLocaleString()} OCUL → {rd.recipients_count} recipients</span>
                      <span className="text-tertiary" style={{ marginLeft: 'auto' }}>{formatTime(rd.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Burns */}
            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-danger)' }}>🔥 BURN LEDGER [{d.recentBurns?.length || 0}]</div>
              {(d.recentBurns || []).length === 0 ? (
                <div className="mono text-xs text-tertiary" style={{ padding: '24px', textAlign: 'center' }}>NO BURNS RECORDED. 1% AUTO-BURN TRIGGERS ON SETTLEMENTS.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {d.recentBurns.map(b => (
                    <div key={b.id} className="mono text-xs" style={{ display: 'flex', gap: '16px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: b.status === 'executed' ? 'var(--color-danger)' : 'var(--color-warning)', fontWeight: 'bold', width: '80px' }}>[{b.status.toUpperCase()}]</span>
                      <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>-{Number(b.amount).toLocaleString()} OCUL</span>
                      <span className="text-tertiary" style={{ flex: 1 }}>{b.source.toUpperCase()}</span>
                      <span className="text-tertiary">{formatTime(b.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="mono text-xs text-tertiary" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 12, height: 12, border: '2px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          CONNECTING TO XRPL EVM SIDECHAIN...
        </div>
      </div>
    )
  }

  const TABS = ['overview', 'credits', 'escrow', 'deflation', 'wallets', 'settlements', 'transactions', 'audit', 'config']

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: '#000', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <span style={{ fontSize: '24px' }}>⛓</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--color-primary)', letterSpacing: '0.05em', lineHeight: '1' }}>BLOCKCHAIN LAB</h1>
            <span className="mono text-xs text-tertiary">OCULOPS CHAIN // XRPL EVM SIDECHAIN // {contracts.length} CONTRACTS LIVE</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="mono" onClick={refreshAll} disabled={refreshing} style={{ fontSize: '9px', padding: '6px 12px', background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', cursor: 'pointer' }}>
            {refreshing ? 'SYNCING...' : 'REFRESH CHAIN ↻'}
          </button>
          <div style={{ display: 'flex', gap: '2px' }}>
            {TABS.map(t => (
              <button key={t} className="mono" style={{ padding: '8px 14px', fontSize: '10px', background: activeTab === t ? 'var(--color-primary)' : 'transparent', color: activeTab === t ? '#000' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setActiveTab(t)}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'credits' && renderCredits()}
        {activeTab === 'escrow' && renderEscrow()}
        {activeTab === 'deflation' && renderDeflation()}
        {activeTab === 'wallets' && renderWallets()}
        {activeTab === 'settlements' && renderSettlements()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'audit' && renderAuditLog()}
        {activeTab === 'config' && renderConfig()}
      </div>
    </div>
  )
}

export default Lab
