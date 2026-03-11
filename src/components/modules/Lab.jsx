// ═══════════════════════════════════════════════════
// OCULOPS — Blockchain Lab v11.0
// XRPL EVM Sidechain Dashboard
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { callSupabaseFunction, supabase } from '../../lib/supabase'
import { useCredits } from '../../hooks/useCredits'
import { ArrowPathIcon, LinkIcon } from '@heroicons/react/24/outline'
import ModulePage from '../ui/ModulePage'
import './Lab.css'

const EXPLORER_URL = 'https://explorer.testnet.xrplevm.org'

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
  return new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function statusClass(status) {
  if (status === 'confirmed' || status === 'active' || status === 'executed') return 'lab-log-status--confirmed'
  if (status === 'failed' || status === 'cancelled') return 'lab-log-status--failed'
  return 'lab-log-status--pending'
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

  const fetchChainStatus = useCallback(async () => {
    try {
      const data = await callSupabaseFunction('chain-bridge?action=status', { method: 'GET' })
      setChainStatus(data)
    } catch (e) {
      setChainStatus({ status: 'offline', error: e.message })
    }
  }, [])

  const fetchSupabaseData = useCallback(async () => {
    const [c, cf, w, s, b, tx, a, e, m] = await Promise.all([
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
    setContracts(c.data || []); setConfig(cf.data || []); setWallets(w.data || [])
    setSettlements(s.data || []); setBatches(b.data || []); setTransactions(tx.data || [])
    setAuditLog(a.data || []); setEscrows(e.data || []); setEscrowMilestones(m.data || [])
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

  const isOnline = chainStatus?.status === 'operational'
  const supply = chainStatus?.onchain?.tokenSupply
  const treasuryBal = chainStatus?.onchain?.treasuryBalance
  const rewardsBal = chainStatus?.onchain?.rewardsBalance

  // ── Shared KPI Strip ──
  const KPIStrip = ({ items, cols = 4 }) => (
    <div className={`kpi-strip kpi-strip-${cols}`}>
      {items.map(k => (
        <div key={k.label} className="kpi-strip-cell">
          <span className="mono text-xs text-tertiary">{k.label}</span>
          <span className="mono text-lg font-bold" style={{ color: k.color || 'var(--text-primary)' }}>{k.value}</span>
          {k.sub && <span className="mono text-xs text-tertiary">{k.sub}</span>}
        </div>
      ))}
    </div>
  )

  // ── Shared Panel ──
  const Panel = ({ title, count, color, children, headerRight }) => (
    <div className="lab-panel">
      <div className="lab-panel-header" style={color ? { color } : undefined}>
        <span>{title}{count != null ? ` [${count}]` : ''}</span>
        {headerRight}
      </div>
      {children}
    </div>
  )

  // ═══ TAB: OVERVIEW ═══
  const renderOverview = () => (
    <div className="lab-col-layout">
      {/* Chain status */}
      <div className={`lab-chain-banner ${isOnline ? 'lab-chain-banner--online' : 'lab-chain-banner--offline'}`}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <span className={`lab-chain-tag ${isOnline ? 'lab-chain-tag--online' : 'lab-chain-tag--offline'}`}>
            {isOnline ? 'Chain online' : 'Chain offline'}
          </span>
          <div>
            <div className="mono font-bold text-sm">XRPL EVM Sidechain — Testnet</div>
            <div className="mono text-xs text-tertiary">Chain ID: {chainStatus?.chainId || '1449000'} · RPC: {chainStatus?.rpc || '—'}</div>
          </div>
        </div>
        <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost mono">Explorer ↗</a>
      </div>

      {/* Onchain KPIs */}
      <KPIStrip items={[
        { label: 'Total supply', value: `${hexToDecimal(supply)} OCUL`, color: 'var(--accent-primary)' },
        { label: 'Treasury vault', value: `${hexToDecimal(treasuryBal)} OCUL`, color: 'var(--color-success)' },
        { label: 'Rewards pool', value: `${hexToDecimal(rewardsBal)} OCUL`, color: 'var(--color-warning)' },
        { label: 'Circulating', value: `${supply !== 'error' && treasuryBal !== 'error' && rewardsBal !== 'error' ? (hexToDecimal(supply) !== '—' ? `${(Number(hexToDecimal(supply).replace(/,/g, '')) - Number(hexToDecimal(treasuryBal).replace(/,/g, '')) - Number(hexToDecimal(rewardsBal).replace(/,/g, ''))).toLocaleString()}` : '—') : '—'} OCUL`, color: 'var(--color-info)' },
      ]} />

      {/* Token distribution */}
      <Panel title="Token distribution">
        <div className="ct-section-body">
          <div className="lab-dist-bar">
            {[
              { w: '40%', bg: 'var(--color-success)', label: 'Treasury 40%' },
              { w: '25%', bg: 'var(--color-warning)', label: 'Rewards 25%' },
              { w: '20%', bg: 'var(--accent-primary)', label: 'Team 20%' },
              { w: '10%', bg: 'var(--color-info)', label: 'Reserve' },
              { w: '5%', bg: '#8b5cf6', label: 'AD' },
            ].map(s => <div key={s.label} className="lab-dist-segment" style={{ width: s.w, background: s.bg }}><span>{s.label}</span></div>)}
          </div>
          <div className="lab-dist-legend">
            {[
              { label: 'Treasury', pct: '40%', amount: '40,000,000', color: 'var(--color-success)' },
              { label: 'Rewards', pct: '25%', amount: '25,000,000', color: 'var(--color-warning)' },
              { label: 'Team/Founder', pct: '20%', amount: '20,000,000', color: 'var(--accent-primary)' },
              { label: 'Reserve', pct: '10%', amount: '10,000,000', color: 'var(--color-info)' },
              { label: 'Airdrop', pct: '5%', amount: '5,000,000', color: '#8b5cf6' },
            ].map(d => (
              <div key={d.label} className="lab-dist-legend-item">
                <div className="lab-legend-dot" style={{ background: d.color }} />
                <span style={{ color: d.color, fontWeight: 'bold' }}>{d.label}</span>
                <span className="text-tertiary">{d.pct} ({d.amount})</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Contracts */}
      <div className="lab-grid-2">
        {contracts.map(c => (
          <div key={c.id} className="lab-contract-card">
            <div className="lab-contract-header">
              <span className="mono text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{c.name}</span>
              <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="lab-contract-address">
              <span className="text-tertiary">Address:</span>
              <a href={`${EXPLORER_URL}/address/${c.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)' }}>{shortAddr(c.address)}</a>
              <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(c.address)}>Copy</button>
            </div>
            <div className="lab-contract-meta">
              <span>Chain: <strong className="text-secondary">{c.chain_name}</strong></span>
              <span>Ver: <strong className="text-secondary">{c.version}</strong></span>
            </div>
            <div className="mono text-xs text-tertiary">Deployed: {formatTime(c.deployed_at)}</div>
          </div>
        ))}
      </div>
    </div>
  )

  // ═══ TAB: WALLETS ═══
  const renderWallets = () => (
    <Panel title="Chain wallets" count={wallets.length}>
      {wallets.length === 0 ? (
        <div className="lab-panel-empty">No wallets registered. Deploy creates the first.</div>
      ) : (
        <table className="lab-table">
          <thead><tr>{['Address', 'Type', 'Label', 'Status', 'Created'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {wallets.map(w => (
              <tr key={w.id}>
                <td><a href={`${EXPLORER_URL}/address/${w.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)' }}>{shortAddr(w.address)}</a></td>
                <td><span className="badge">{w.wallet_type}</span></td>
                <td>{w.label || '—'}</td>
                <td><span style={{ color: w.is_active ? 'var(--color-success)' : 'var(--color-danger)' }}>{w.is_active ? 'Active' : 'Disabled'}</span></td>
                <td className="text-tertiary">{formatTime(w.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )

  // ═══ TAB: SETTLEMENTS ═══
  const renderSettlements = () => (
    <div className="lab-col-layout">
      <KPIStrip items={[
        { label: 'Total settlements', value: settlements.length, color: 'var(--accent-primary)' },
        { label: 'Batches recorded', value: batches.length, color: 'var(--color-success)' },
        { label: 'Confirmed onchain', value: batches.filter(b => b.status === 'confirmed').length, color: 'var(--color-info)' },
        { label: 'Total volume', value: `${batches.reduce((s, b) => s + Number(b.total_amount || 0), 0).toLocaleString()} OCUL`, color: 'var(--color-warning)' },
      ]} />

      <Panel title="Settlement batches" count={batches.length}>
        {batches.length === 0 ? <div className="lab-panel-empty">No batches yet</div> : (
          <div>{batches.map(b => (
            <div key={b.id} className="lab-log-row">
              <span className={`lab-log-status ${statusClass(b.status)}`}>{b.status}</span>
              <span className="text-secondary" style={{ flex: 1 }}>{shortAddr(b.batch_hash || '')}</span>
              <span className="text-tertiary">{b.settlement_count} settlements</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{Number(b.total_amount || 0).toLocaleString()} OCUL</span>
              <span className="text-tertiary">{formatTime(b.created_at)}</span>
            </div>
          ))}</div>
        )}
      </Panel>

      <Panel title="Settlement log" count={settlements.length}>
        {settlements.length === 0 ? <div className="lab-panel-empty">No settlements recorded</div> : (
          <div>{settlements.map(s => (
            <div key={s.id} className="lab-log-row">
              <span className={`lab-log-status ${statusClass(s.status)}`}>{s.status}</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{Number(s.amount || 0).toLocaleString()} {s.currency}</span>
              <span className="text-tertiary" style={{ flex: 1 }}>{s.correlation_type ? `${s.correlation_type} · ${s.correlation_id || '—'}` : 'Unlinked'}</span>
              <span className="text-tertiary">{formatTime(s.created_at)}</span>
            </div>
          ))}</div>
        )}
      </Panel>
    </div>
  )

  // ═══ TAB: TRANSACTIONS ═══
  const renderTransactions = () => (
    <Panel title="Chain transactions" count={transactions.length}>
      {transactions.length === 0 ? <div className="lab-panel-empty">No transactions logged</div> : (
        <div>{transactions.map(tx => (
          <div key={tx.id} className="lab-log-row">
            <span className={`lab-log-status ${statusClass(tx.status)}`}>{tx.status}</span>
            <a href={`${EXPLORER_URL}/tx/${tx.tx_hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', width: 120 }}>{shortAddr(tx.tx_hash)}</a>
            <span style={{ flex: 1 }}>{tx.function_name || 'transfer'}</span>
            <span className="text-tertiary">From: {shortAddr(tx.from_address)}</span>
            <span className="text-tertiary">To: {shortAddr(tx.to_address)}</span>
            <span className="text-tertiary">{formatTime(tx.created_at)}</span>
          </div>
        ))}</div>
      )}
    </Panel>
  )

  // ═══ TAB: AUDIT ═══
  const renderAuditLog = () => (
    <Panel title="Chain audit log" count={auditLog.length}>
      {auditLog.length === 0 ? <div className="lab-panel-empty">Audit trail empty</div> : (
        <div>{auditLog.map(log => (
          <div key={log.id} className="lab-log-row">
            <span className="text-tertiary" style={{ width: 120 }}>{formatTime(log.created_at)}</span>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', width: 160 }}>{log.event_type}</span>
            <span className="text-secondary" style={{ flex: 1 }}>{log.entity_type} · {shortAddr(log.entity_id)}</span>
            <span className="text-tertiary">{log.actor_address ? shortAddr(log.actor_address) : '—'}</span>
          </div>
        ))}</div>
      )}
    </Panel>
  )

  // ═══ TAB: CONFIG ═══
  const renderConfig = () => (
    <Panel title="Chain configuration" count={config.length}>
      <table className="lab-table">
        <thead><tr>{['Key', 'Value', 'Description'].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {config.map(c => (
            <tr key={c.key}>
              <td style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{c.key}</td>
              <td style={{ wordBreak: 'break-all' }}>{typeof c.value === 'string' ? c.value : JSON.stringify(c.value)}</td>
              <td className="text-tertiary">{c.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )

  // ═══ TAB: CREDITS ═══
  const CATEGORY_COLORS = { ai_agent: 'var(--color-info)', intelligence: '#8b5cf6', creative: 'var(--color-success)', execution: 'var(--color-warning)', reports: 'var(--text-secondary)', platform: 'var(--text-tertiary)', settlement: 'var(--accent-primary)', escrow: '#ec4899' }

  const renderCredits = () => (
    <div className="lab-col-layout">
      <KPIStrip cols={5} items={[
        { label: 'Your balance', value: `${credits.balance.toLocaleString()} OCUL`, color: 'var(--accent-primary)' },
        { label: 'Tier', value: credits.tier, color: 'var(--color-warning)' },
        { label: 'Exchange rate', value: '1€ = 100 OCUL' },
        { label: 'Signup bonus', value: '100 OCUL', color: 'var(--color-success)' },
        { label: 'Active pricing', value: `${credits.pricing.length} actions`, color: 'var(--color-info)' },
      ]} />

      <div className="lab-grid-2-asym">
        <Panel title="Credit pricing table">
          <div>{credits.pricing.map(p => (
            <div key={p.action} className="lab-log-row">
              <span style={{ color: CATEGORY_COLORS[p.category] || 'var(--text-primary)', fontWeight: 'bold', width: 180 }}>{p.action.replace(/_/g, ' ')}</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', width: 80 }}>{p.cost > 0 ? `${p.cost} OCUL` : 'Variable'}</span>
              <span className="text-tertiary" style={{ flex: 1 }}>{p.description}</span>
              <span className="badge" style={{ color: CATEGORY_COLORS[p.category], borderColor: CATEGORY_COLORS[p.category] }}>{p.category}</span>
            </div>
          ))}</div>
        </Panel>

        <div className="lab-col-layout">
          <Panel title="Purchase OCUL credits">
            <div className="ct-section-body lab-col-layout">
              <div className="mono text-xs text-tertiary">Rate: 1 EUR = 100 OCUL (fixed Phase 1)</div>
              {[10, 50, 100, 500].map(amt => (
                <button key={amt} className="lab-purchase-btn" onClick={() => credits.purchase(amt)}>
                  <span>€{amt}</span>
                  <span className="text-secondary">→ {(amt * 100).toLocaleString()} OCUL</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Credit history" headerRight={
            <button className="btn btn-sm btn-ghost" onClick={() => credits.refreshHistory()}>Load</button>
          }>
            {credits.history.length === 0 ? <div className="lab-panel-empty">Click load to fetch history</div> : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {credits.history.slice(0, 20).map(tx => (
                  <div key={tx.id} className="lab-log-row">
                    <span className={`lab-log-status ${tx.type === 'debit' ? 'lab-log-status--debit' : 'lab-log-status--credit'}`} style={{ width: 60 }}>{tx.type === 'debit' ? '-' : '+'}{tx.amount}</span>
                    <span style={{ flex: 1 }}>{tx.action.replace(/_/g, ' ')}</span>
                    <span className="text-tertiary">{formatTime(tx.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )

  // ═══ TAB: ESCROW ═══
  const renderEscrow = () => {
    const activeEscrows = escrows.filter(e => e.status === 'active')
    const totalLocked = activeEscrows.reduce((s, e) => s + Number(e.total_amount || 0) - Number(e.amount_released || 0), 0)
    return (
      <div className="lab-col-layout">
        <KPIStrip items={[
          { label: 'Total escrows', value: escrows.length, color: 'var(--accent-primary)' },
          { label: 'Active', value: activeEscrows.length, color: 'var(--color-warning)' },
          { label: 'OCUL locked', value: totalLocked.toLocaleString(), color: 'var(--color-success)' },
          { label: 'Contract', value: <a href={`${EXPLORER_URL}/address/0xfb7E3A09312b3664eddD71c427bc657f4638A866`} target="_blank" rel="noreferrer" className="mono text-xs" style={{ color: 'var(--color-info)' }}>0xfb7E···A866 ↗</a> },
        ]} />

        <div className="lab-escrow-banner">
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <span className="lab-chain-tag lab-chain-tag--online" style={{ background: 'var(--accent-primary)' }}>Escrow engine</span>
            <div>
              <div className="mono font-bold text-sm">Oculops Escrow v1.0</div>
              <div className="mono text-xs text-tertiary">Milestone-based · Admin-managed · Fee: 1% creation + 2% release</div>
            </div>
          </div>
          <div className="mono text-xs" style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <span className="text-tertiary">Admin: <strong style={{ color: 'var(--accent-primary)' }}>Deployer</strong></span>
            <span className="text-tertiary">Max MS: <strong>20</strong></span>
          </div>
        </div>

        <Panel title="Escrow registry" count={escrows.length}>
          {escrows.length === 0 ? <div className="lab-panel-empty">No escrows created yet</div> : (
            <div>{escrows.map(e => {
              const ms = escrowMilestones.filter(m => m.escrow_id === e.id)
              return (
                <div key={e.id} className="ct-section-body" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="lab-log-row" style={{ padding: 0, borderBottom: 'none', marginBottom: 'var(--space-2)' }}>
                    <span className={`lab-log-status ${statusClass(e.status)}`}>{e.status}</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{Number(e.total_amount || 0).toLocaleString()} OCUL</span>
                    <span className="text-tertiary">{e.milestone_count} milestones · {e.milestones_released || 0} released</span>
                    <span className="text-tertiary" style={{ marginLeft: 'auto' }}>{formatTime(e.created_at)}</span>
                  </div>
                  {e.description && <div className="mono text-xs text-tertiary" style={{ marginBottom: 'var(--space-2)' }}>{e.description}</div>}
                  <div className="lab-milestone-bar">
                    {Array.from({ length: e.milestone_count }).map((_, i) => (
                      <div key={i} className={`lab-milestone-segment ${i < (e.milestones_released || 0) ? 'lab-milestone-segment--done' : 'lab-milestone-segment--pending'}`} />
                    ))}
                  </div>
                  {ms.length > 0 && (
                    <div className="lab-milestone-tags">
                      {ms.map(m => (
                        <span key={m.id} className={`badge ${m.status === 'released' ? 'badge-success' : ''}`}>
                          MS{m.milestone_index}: {m.title || `Milestone ${m.milestone_index}`} — {Number(m.amount || 0).toLocaleString()} OCUL
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}</div>
          )}
        </Panel>
      </div>
    )
  }

  // ═══ TAB: DEFLATION ═══
  const renderDeflation = () => {
    const d = credits.deflation
    const burnPct = d?.metrics?.total_burned && d?.metrics?.max_supply ? ((d.metrics.total_burned / d.metrics.max_supply) * 100).toFixed(4) : '0.0000'
    return (
      <div className="lab-col-layout">
        {!d ? (
          <div className="lab-panel"><div className="lab-panel-empty">
            <button className="btn btn-primary" onClick={credits.refreshDeflation}>Load deflation metrics</button>
          </div></div>
        ) : (
          <>
            <KPIStrip cols={5} items={[
              { label: 'Total burned', value: `${Number(d.metrics?.total_burned || 0).toLocaleString()} OCUL`, color: 'var(--color-danger)', sub: `${burnPct}% of max supply` },
              { label: 'Pending burns', value: Number(d.metrics?.pending_burns || 0).toLocaleString(), color: 'var(--color-warning)' },
              { label: 'Effective supply', value: Number(d.metrics?.effective_supply || 100000000).toLocaleString(), color: 'var(--accent-primary)' },
              { label: 'Total staked', value: Number(d.metrics?.total_staked || 0).toLocaleString(), color: 'var(--color-success)', sub: `${d.metrics?.stakers_count || 0} stakers` },
              { label: 'Premium users', value: (d.metrics?.pro_users || 0) + (d.metrics?.enterprise_users || 0), color: '#8b5cf6', sub: `${d.metrics?.pro_users || 0} Pro / ${d.metrics?.enterprise_users || 0} Ent` },
            ]} />

            <Panel title="Deflationary supply model" color="var(--color-danger)">
              <div className="ct-section-body">
                <div className="lab-supply-bar">
                  <div style={{ width: `${100 - Number(burnPct)}%`, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', paddingLeft: 'var(--space-2)', transition: 'width 0.5s' }}>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--surface-base)', fontWeight: 'bold' }}>Circulating: {Number(d.metrics?.effective_supply || 100000000).toLocaleString()}</span>
                  </div>
                  {Number(burnPct) > 0 && <div style={{ flex: 1, background: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="mono" style={{ fontSize: 8, color: 'var(--surface-base)', fontWeight: 'bold' }}>Burned</span>
                  </div>}
                </div>
                <div className="lab-supply-metrics">
                  <span>Max supply: <strong>{100000000 .toLocaleString()}</strong></span>
                  <span>Burned: <strong style={{ color: 'var(--color-danger)' }}>{Number(d.metrics?.total_burned || 0).toLocaleString()}</strong></span>
                  <span>Staked: <strong style={{ color: 'var(--color-success)' }}>{Number(d.metrics?.total_staked || 0).toLocaleString()}</strong></span>
                  <span>Free float: <strong style={{ color: 'var(--color-warning)' }}>{(Number(d.metrics?.effective_supply || 100000000) - Number(d.metrics?.total_staked || 0)).toLocaleString()}</strong></span>
                </div>
              </div>
            </Panel>

            <div className="lab-grid-2-asym">
              <Panel title={`Autonomous cron jobs [${d.cronJobs?.length || 0}]`} color="var(--color-success)">
                <div>{(d.cronJobs || []).map((job, i) => (
                  <div key={i} className="lab-log-row">
                    <span style={{ width: 8, height: 8, background: 'var(--color-success)', borderRadius: '50%', flexShrink: 0 }} />
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', width: 200 }}>{job.name}</span>
                    <span className="text-secondary" style={{ width: 160 }}>{job.schedule}</span>
                    <span className="text-tertiary" style={{ flex: 1 }}>{job.description}</span>
                  </div>
                ))}</div>
              </Panel>

              <Panel title="Staking tiers" color="#8b5cf6">
                <div>{[
                  { tier: 'Free', min: '0', yield: '0%', color: 'var(--text-tertiary)' },
                  { tier: 'Starter', min: '1+', yield: '0.5%/wk', color: 'var(--text-secondary)' },
                  { tier: 'Pro', min: '1,000', yield: '0.5%/wk + Priority', color: 'var(--color-warning)' },
                  { tier: 'Enterprise', min: '10,000', yield: '0.5%/wk + Priority + Governance', color: '#8b5cf6' },
                ].map(t => (
                  <div key={t.tier} className="lab-log-row">
                    <span style={{ color: t.color, fontWeight: 'bold', width: 100 }}>{t.tier}</span>
                    <span className="text-tertiary" style={{ width: 100 }}>Min: {t.min} OCUL</span>
                    <span style={{ color: 'var(--color-success)', flex: 1 }}>{t.yield}</span>
                  </div>
                ))}</div>
              </Panel>
            </div>

            <Panel title={`Reward distributions [${d.rewardDistributions?.length || 0}]`}>
              {(d.rewardDistributions || []).length === 0 ? <div className="lab-panel-empty">No distributions yet</div> : (
                <div>{d.rewardDistributions.map(rd => (
                  <div key={rd.id} className="lab-log-row">
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', width: 60 }}>E{rd.epoch}</span>
                    <span style={{ color: 'var(--color-warning)', width: 120 }}>{rd.type}</span>
                    <span style={{ color: 'var(--color-success)' }}>{Number(rd.total_distributed).toLocaleString()} OCUL → {rd.recipients_count} recipients</span>
                    <span className="text-tertiary" style={{ marginLeft: 'auto' }}>{formatTime(rd.created_at)}</span>
                  </div>
                ))}</div>
              )}
            </Panel>

            <Panel title={`Burn ledger [${d.recentBurns?.length || 0}]`} color="var(--color-danger)">
              {(d.recentBurns || []).length === 0 ? <div className="lab-panel-empty">No burns recorded. 1% auto-burn triggers on settlements.</div> : (
                <div>{d.recentBurns.map(b => (
                  <div key={b.id} className="lab-log-row">
                    <span className={`lab-log-status ${statusClass(b.status)}`}>{b.status}</span>
                    <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>-{Number(b.amount).toLocaleString()} OCUL</span>
                    <span className="text-tertiary" style={{ flex: 1 }}>{b.source}</span>
                    <span className="text-tertiary">{formatTime(b.created_at)}</span>
                  </div>
                ))}</div>
              )}
            </Panel>
          </>
        )}
      </div>
    )
  }

  // ═══ LOADING ═══
  if (loading) {
    return (
      <div className="lab-loading fade-in">
        <div className="lab-loading-inner">
          <div className="spin" style={{ width: 12, height: 12, border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
          Connecting to XRPL EVM Sidechain...
        </div>
      </div>
    )
  }

  const TABS = ['overview', 'credits', 'escrow', 'deflation', 'wallets', 'settlements', 'transactions', 'audit', 'config']

  return (
    <ModulePage
      title="Blockchain Lab"
      subtitle={`Oculops Chain · XRPL EVM Sidechain · ${contracts.length} contracts live`}
      actions={
        <>
          <button className="btn btn-sm btn-ghost" onClick={refreshAll} disabled={refreshing}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
          <div className="lab-tabs">
            {TABS.map(t => (
              <button key={t} className={`lab-tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </>
      }
    >
      <div className="lab-content">
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
    </ModulePage>
  )
}

export default Lab
