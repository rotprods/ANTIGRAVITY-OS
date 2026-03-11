// ═══════════════════════════════════════════════════
// OCULOPS — Simulation Engine
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useFinance } from '../../hooks/useFinance'
import { useDeals } from '../../hooks/useDeals'
import { Charts } from '../../lib/charts'
import VaultAgentPanel from '../ui/VaultAgentPanel'

function simulate(params, startClients = 0, startMrr = 0, months = 3) {
  const { contactsPerWeek, responseRate, meetingRate, closeRate, avgTicket, churn, capacity } = params
  const weeksPerMonth = 4.33
  const results = []
  let activeClients = startClients
  let mrr = startMrr
  for (let month = 1; month <= months; month++) {
    const contactsMonth = contactsPerWeek * weeksPerMonth
    const responses = contactsMonth * (responseRate / 100)
    const meetings = responses * (meetingRate / 100)
    const closes = Math.min(meetings * (closeRate / 100), capacity - activeClients)
    const newClients = Math.max(0, Math.round(closes))
    const churned = Math.round(activeClients * (churn / 100))
    activeClients = Math.min(Math.max(0, activeClients + newClients - churned), capacity)
    mrr = activeClients * avgTicket
    results.push({ month, contacts: Math.round(contactsMonth), responses: Math.round(responses), meetings: Math.round(meetings), newClients, churned, totalClients: activeClients, mrr })
  }
  return results
}

function SliderRow({ label, min, max, step = 1, value, suffix = '', onChange }) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--color-primary)' }}>
          {value.toLocaleString()}{suffix}
        </span>
      </div>
      <div style={{ position: 'relative', height: '1px', background: 'var(--border-subtle)', overflow: 'visible' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${percentage}%`, background: 'var(--color-primary)' }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          style={{
            position: 'absolute', top: '-6px', left: 0, width: '100%', height: '12px', opacity: 0, cursor: 'ew-resize'
          }}
          onChange={e => onChange(parseInt(e.target.value))}
        />
        <div style={{
          position: 'absolute', top: '50%', left: `${percentage}%`, transform: 'translate(-50%, -50%)',
          width: '6px', height: '12px', background: 'var(--color-primary)',
          pointerEvents: 'none'
        }} />
      </div>
    </div>
  )
}

function Simulation() {
  const { data, updateData } = useAppStore()
  const { mrr: realMrr } = useFinance()
  const { pipelineView } = useDeals()
  const sim = data.simulation || {}
  const budget = data.meta?.budget || 3000

  const [vars, setVars] = useState({
    contactsPerWeek: sim.contactsPerWeek || 20,
    responseRate: sim.responseRate || 15,
    meetingRate: sim.meetingRate || 40,
    closeRate: sim.closeRate || 30,
    avgTicket: sim.avgTicket || 2500,
    churn: sim.churn || 5,
    capacity: sim.capacity || 8,
  })

  const setVar = (key, val) => {
    setVars(v => ({ ...v, [key]: val }))
    updateData(d => ({ ...d, simulation: { ...d.simulation, [key]: val } }))
  }

  // Real data from Supabase
  const startClients = (pipelineView['closed_won'] || []).length
  const startMrr = realMrr || 0

  const base = simulate(vars, startClients, startMrr)
  const opt = simulate({ ...vars, responseRate: Math.min(vars.responseRate * 1.5, 50), closeRate: Math.min(vars.closeRate * 1.3, 60), avgTicket: vars.avgTicket * 1.2 }, startClients, startMrr)
  const pess = simulate({ ...vars, responseRate: vars.responseRate * 0.6, closeRate: vars.closeRate * 0.7, churn: Math.min(vars.churn * 1.5, 30) }, startClients, startMrr)

  // NOTE: Charts.multiLine implementation assumes hex / color name variables, matching old interface logic temporarily
  const chartHtml = Charts.multiLine(
    [
      { data: [startMrr, ...opt.map(r => r.mrr)], color: '#34c759', dash: '5,5' },
      { data: [startMrr, ...base.map(r => r.mrr)], color: '#FFD700' },
      { data: [startMrr, ...pess.map(r => r.mrr)], color: '#ff3b30', dash: '5,5' },
    ],
    { labels: ['T0', 'M1', 'M2', 'M3'], ySuffix: '€', width: 500, height: 220 }
  )

  const monthlyExpenses = 500
  const runwayRows = []
  let cash = budget
  for (let m = 0; m <= 6; m++) {
    const rev = m > 0 && m <= 3 ? base[m - 1].mrr : (base[base.length - 1]?.mrr || 0)
    if (m > 0) cash = cash - monthlyExpenses + (m <= 3 ? base[m - 1]?.mrr || 0 : rev)
    runwayRows.push({ month: m, cash: Math.round(cash), mrr: m > 0 && m <= 3 ? base[m - 1].mrr : rev })
  }

  const scenarios = [
    { name: 'PESSIMISTIC_MODEL', data: pess, color: 'var(--color-danger)', icon: '[-]' },
    { name: 'BASE_NOMINAL', data: base, color: 'var(--color-primary)', icon: '[~]' },
    { name: 'OPTIMISTIC_LIFT', data: opt, color: 'var(--color-success)', icon: '[+]' },
  ]

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* ── HEADER ── */}
      <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>Simulation Engine</h1>
        <p className="mono text-xs text-tertiary" style={{ marginTop: '8px', letterSpacing: '0.05em' }}>/// MONTE CARLO PROJECTIONS // 30-60-90 DAY TRAJECTORY</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 2fr)', gap: '16px' }}>

        {/* Controls */}
        <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
          <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
              /// MODEL VARIABLES OVERRIDE
          </div>
          <div style={{ padding: '24px' }}>
            <SliderRow label="CONTACTS/WK" min={5} max={100} value={vars.contactsPerWeek} onChange={v => setVar('contactsPerWeek', v)} />
            <SliderRow label="RESPONSE RATE" min={1} max={50} value={vars.responseRate} suffix="%" onChange={v => setVar('responseRate', v)} />
            <SliderRow label="MEETING RATE" min={10} max={80} value={vars.meetingRate} suffix="%" onChange={v => setVar('meetingRate', v)} />
            <SliderRow label="CLOSE RATE" min={5} max={60} value={vars.closeRate} suffix="%" onChange={v => setVar('closeRate', v)} />
            <SliderRow label="AVG TICKET" min={500} max={10000} step={100} value={vars.avgTicket} suffix="€" onChange={v => setVar('avgTicket', v)} />
            <SliderRow label="CHURN/MO" min={0} max={30} value={vars.churn} suffix="%" onChange={v => setVar('churn', v)} />
            <SliderRow label="MAX CAPACITY" min={1} max={30} value={vars.capacity} onChange={v => setVar('capacity', v)} />
          </div>
        </div>

        {/* Results */}
        <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
          <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
              /// MRR PROJECTION
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div dangerouslySetInnerHTML={{ __html: chartHtml }} style={{ width: '100%', flex: 1 }} />
            <div style={{ height: '1px', background: 'var(--color-border)', margin: '24px 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)' }}>
              {base.map(r => (
                <div key={r.month} style={{ background: 'var(--color-bg-2)', padding: '16px', textAlign: 'center' }}>
                  <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>MONTH {r.month}</div>
                  <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{r.mrr.toLocaleString()}€</div>
                  <div className="mono text-2xs" style={{ color: 'var(--color-text-2)', marginTop: '8px' }}>{r.totalClients} ACT / +{r.newClients} NEW</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scenario comparison */}
      <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-border)' }}>
        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
            /// FORECAST SCENARIOS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
          {scenarios.map(sc => {
            const m3 = sc.data[2]
            return (
              <div key={sc.name} style={{ background: '#000', padding: '24px', textAlign: 'center' }}>
                <div className="mono" style={{ fontSize: '18px', marginBottom: '12px', color: sc.color }}>{sc.icon}</div>
                <div className="mono text-2xs" style={{ fontWeight: 'bold', marginBottom: '16px', color: sc.color }}>{sc.name}</div>
                <div className="mono" style={{ fontSize: '24px', fontWeight: 'bold', color: sc.color }}>{m3.mrr.toLocaleString()}€</div>
                <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)', marginTop: '8px' }}>M3 OUTLOOK</div>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '16px 0' }} />
                <div className="mono text-2xs" style={{ color: 'var(--color-text-2)' }}>ACT: {m3.totalClients} / TGT: {m3.contacts}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cash Runway */}
      <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-border)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>/// RUNWAY & BURN ANALYSIS</div>
          <div className="mono text-xs" style={{ color: 'var(--text-tertiary)' }}>BURN: {monthlyExpenses}€/MO</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <thead style={{ background: '#000', borderBottom: '1px solid var(--border-subtle)' }}>
              <tr>
                <th style={{ padding: '12px 16px', color: 'var(--color-primary)' }}>T-MINUS</th>
                <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>CAPITAL</th>
                <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>MRR</th>
                <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>BURN</th>
                <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>NET DIFF</th>
                <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>SYSTEM STATUS</th>
              </tr>
            </thead>
            <tbody>
              {runwayRows.map((r, idx) => {
                const net = r.mrr - monthlyExpenses
                return (
                  <tr key={r.month} style={{ borderBottom: idx < runwayRows.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: idx % 2 === 0 ? 'transparent' : '#000' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>M{r.month}</td>
                    <td style={{ padding: '12px 16px', color: r.cash > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>{r.cash.toLocaleString()}€</td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text)' }}>{r.mrr.toLocaleString()}€</td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-danger)' }}>-{monthlyExpenses}€</td>
                    <td style={{ padding: '12px 16px', color: net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{net >= 0 ? '+' : ''}{net.toLocaleString()}€</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '9px', padding: '2px 6px', border: `1px solid ${r.cash > 1000 ? 'var(--color-success)' : r.cash > 0 ? 'var(--color-warning)' : 'var(--color-danger)'}`, color: r.cash > 1000 ? 'var(--color-success)' : r.cash > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                        {r.cash > 1000 ? 'NOMINAL' : r.cash > 0 ? 'CRITICAL' : 'DEFAULT_DEAD'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <VaultAgentPanel title="SIMULATION INTELLIGENCE" namespaces={['data', 'research']} />
      </div>

    </div>
  )
}

export default Simulation
