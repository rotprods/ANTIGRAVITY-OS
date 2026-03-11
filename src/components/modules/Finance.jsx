// ═══════════════════════════════════════════════════
// OCULOPS — Finance Module
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useFinance } from '../../hooks/useFinance'
import { useFinanceStore } from '../../stores/useFinanceStore'
import ModuleSkeleton from '../ui/ModuleSkeleton'

const emptyForm = { type: 'revenue', category: 'servicio', description: '', amount: '', date: new Date().toISOString().split('T')[0], recurrence: 'one_time' }

function Finance() {
  const { entries, loading, addEntry, removeEntry } = useFinance()
  const { filter, setFilter } = useFinanceStore()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const revenue = entries.filter(e => e.type === 'revenue').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const expenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const profit = revenue - expenses
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

  const handleAdd = async () => {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    await addEntry({ ...form, amount: parseFloat(form.amount), is_recurring: form.recurrence !== 'one_time' })
    setForm(emptyForm)
    setSaving(false)
  }

  const filtered = entries
    .filter(e => filter === 'all' || e.type === filter)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  if (loading) return <ModuleSkeleton variant="kpi" rows={4} />

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>CASHFLOW MATRICES</h1>
          <span className="mono text-xs text-tertiary">REVENUE VELOCITY, NET BURN & MARGIN LEDGERS</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>

        {/* ── KPI STRIP ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ background: '#000', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="mono text-xs text-tertiary">GROSS REVENUE</span>
              <span style={{ fontSize: '14px', color: 'var(--color-success)' }}>💰</span>
            </div>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>€{revenue.toLocaleString()}</span>
          </div>
          <div style={{ background: '#000', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="mono text-xs text-tertiary">CASH BURN</span>
              <span style={{ fontSize: '14px', color: 'var(--color-danger)' }}>💸</span>
            </div>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-danger)' }}>€{expenses.toLocaleString()}</span>
          </div>
          <div style={{ background: '#000', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="mono text-xs text-tertiary">NET PROFIT</span>
              <span style={{ fontSize: '14px', color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>📊</span>
            </div>
            <span className="mono text-lg font-bold" style={{ color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>€{profit.toLocaleString()}</span>
          </div>
          <div style={{ background: '#000', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="mono text-xs text-tertiary">PROFIT MARGIN</span>
              <span style={{ fontSize: '14px', color: 'var(--color-primary)' }}>📈</span>
            </div>
            <span className="mono text-lg font-bold" style={{ color: 'var(--color-text)' }}>{margin}%</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div style={{ border: '1px solid var(--border-subtle)', background: '#000', display: 'flex', flexDirection: 'column' }}>
            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'rgba(255,212,0,0.05)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>/// FISCAL LOG [{filtered.length}]</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['all', 'revenue', 'expense'].map(f => (
                  <button key={f} className="mono" style={{ fontSize: '9px', padding: '4px 8px', background: filter === f ? 'var(--color-primary)' : 'transparent', color: filter === f ? '#000' : 'var(--color-text)', border: filter === f ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)', cursor: 'pointer' }} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'FULL LOG' : f === 'revenue' ? 'INFLOW' : 'BURN'}
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO FISCAL MOVEMENTS DETECTED.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: '#000', color: 'var(--text-tertiary)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>T-MINUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>DESCRIPTOR</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>CATEGORY</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>VECTOR</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>CAPITAL</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>CMD</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, idx) => (
                    <tr key={e.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: idx % 2 === 0 ? 'transparent' : '#000' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>{e.date}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-text)', fontWeight: 'bold' }}>{e.description.toUpperCase()}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)' }}>{e.category.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '9px', padding: '2px 6px', border: `1px solid var(--color-${e.type === 'revenue' ? 'success' : 'danger'})`, color: `var(--color-${e.type === 'revenue' ? 'success' : 'danger'})` }}>
                          {e.type === 'revenue' ? 'INFLOW' : 'BURN'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: e.type === 'revenue' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        €{(parseFloat(e.amount) || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '2px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => removeEntry(e.id)}>DEL</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ border: '1px solid var(--color-primary)', background: '#000', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--color-primary)', color: '#000' }}>
                        /// EXECUTE CASH TRANSFER
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="input-group">
                <label className="mono text-xs">DIRECTIONAL VECTOR</label>
                <select className="input mono text-xs" style={{ background: '#000', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px', color: 'var(--color-text)', outline: 'none' }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="revenue">INFLOW (REVENUE)</option>
                  <option value="expense">BURN (EXPENSE)</option>
                </select>
              </div>
              <div className="input-group">
                <label className="mono text-xs">INTERNAL CLASSIFICATION</label>
                <select className="input mono text-xs" style={{ background: '#000', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px', color: 'var(--color-text)', outline: 'none' }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="servicio">SERVICE RETAINER</option>
                  <option value="producto">PRODUCT SALES</option>
                  <option value="herramienta">SaaS INFRASTRUCTURE</option>
                  <option value="marketing">ADVERTISING / MKT</option>
                  <option value="equipo">HUMAN CAPITAL</option>
                  <option value="admin">LEGAL / ADMIN</option>
                  <option value="otro">UNCLASSIFIED</option>
                </select>
              </div>
              <div className="input-group">
                <label className="mono text-xs">DESCRIPTOR</label>
                <input className="input mono text-xs" style={{ background: '#000', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px', color: 'var(--color-text)', outline: 'none' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="EX: V0 SERVER COSTS" />
              </div>
              <div className="input-group">
                <label className="mono text-xs">CAPITAL COMMITTED (€)</label>
                <input className="input mono text-xs" type="number" style={{ background: '#000', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px', color: 'var(--color-text)', outline: 'none' }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500" />
              </div>
              <div className="input-group">
                <label className="mono text-xs">EXECUTION DATE</label>
                <input className="input mono text-xs" type="date" style={{ background: '#000', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px', color: 'var(--color-text)', outline: 'none' }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="mono text-xs">AUTO-RENEWAL</label>
                <select className="input mono text-xs" style={{ background: '#000', border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px', color: 'var(--color-text)', outline: 'none' }} value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>
                  <option value="one_time">STATIC (ONE-OFF)</option>
                  <option value="monthly">MONTHLY CYCLE</option>
                  <option value="weekly">WEEKLY CYCLE</option>
                </select>
              </div>
              <button className="btn btn-primary mono" style={{ marginTop: '16px', borderRadius: 0, padding: '12px' }} onClick={handleAdd} disabled={saving}>
                {saving ? 'COMMITTING...' : 'REGISTER TRANSFER'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Finance
