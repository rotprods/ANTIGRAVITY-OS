// ═══════════════════════════════════════════════════
// OCULOPS — Finance v12.0 (STITCH V2 IVORY)
// Financial Dashboard — Aligned w/ Stitch Final
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useFinance } from '../../hooks/useFinance'
import { useFinanceStore } from '../../stores/useFinanceStore'
import VaultAgentPanel from '../ui/VaultAgentPanel'
import ModuleSkeleton from '../ui/ModuleSkeleton'
import './Finance.css'

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
    <div className="module-page fin fade-in">
      {/* ── Hero Banner (Stitch V2) ── */}
      <div className="fin-hero">
        <div>
          <h1 className="fin-hero-title">Financial Overview</h1>
          <p className="fin-hero-subtitle">Revenue, expenses, and margin analytics.</p>
        </div>
        <div className="fin-live-pill">
          <span className="fin-live-dot" />
          <span>LIVE</span>
        </div>
      </div>

      {/* ── KPI Grid (4 cards — Stitch V2) ── */}
      <div className="fin-kpi-grid">
        <div className="fin-kpi fin-kpi--accent">
          <div className="fin-kpi-label">Monthly Revenue</div>
          <div className="fin-kpi-value" style={{ color: '#34C759' }}>€{revenue.toLocaleString()}</div>
          <div className="fin-kpi-bar">
            <div className="fin-kpi-bar-fill" style={{ width: '75%', background: '#34C759' }} />
          </div>
        </div>
        <div className="fin-kpi">
          <div className="fin-kpi-label">Expenses</div>
          <div className="fin-kpi-value" style={{ color: '#FF3B30' }}>€{expenses.toLocaleString()}</div>
          <div className="fin-kpi-bar">
            <div className="fin-kpi-bar-fill" style={{ width: revenue > 0 ? `${Math.min(100, Math.round((expenses / revenue) * 100))}%` : '0%', background: '#FF3B30' }} />
          </div>
        </div>
        <div className="fin-kpi">
          <div className="fin-kpi-label">Net Profit</div>
          <div className="fin-kpi-value" style={{ color: profit >= 0 ? '#34C759' : '#FF3B30' }}>€{profit.toLocaleString()}</div>
          <div className="fin-kpi-bar">
            <div className="fin-kpi-bar-fill" style={{ width: `${Math.abs(margin)}%` }} />
          </div>
        </div>
        <div className="fin-kpi">
          <div className="fin-kpi-label">Profit Margin</div>
          <div className="fin-kpi-value">{margin}%</div>
          <div className="fin-kpi-bar">
            <div className="fin-kpi-bar-fill" style={{ width: `${Math.max(0, margin)}%` }} />
          </div>
        </div>
      </div>

      {/* ── Content Grid: Transactions + New Entry ── */}
      <div className="fin-content-grid">
        {/* Transactions Table Card */}
        <div className="fin-card">
          <div className="fin-card-header">
            <span className="fin-card-title">Recent Transactions</span>
            <div className="fin-filter-group">
              {['all', 'revenue', 'expense'].map(f => (
                <button key={f} className={`fin-filter-btn ${filter === f ? 'fin-filter-active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'revenue' ? 'Revenue' : 'Expenses'}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="fin-empty">No transactions yet.</div>
          ) : (
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th className="fin-th-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="fin-td-muted">{e.date}</td>
                    <td className="fin-td-bold">{e.description || ''}</td>
                    <td>
                      <span className="fin-badge">{e.category || ''}</span>
                    </td>
                    <td>
                      <span className={`fin-type-pill ${e.type === 'revenue' ? 'fin-type-revenue' : 'fin-type-expense'}`}>
                        {e.type === 'revenue' ? 'Revenue' : 'Expense'}
                      </span>
                    </td>
                    <td className={`fin-td-amount ${e.type === 'revenue' ? 'fin-amount-green' : 'fin-amount-red'}`}>
                      {e.type === 'revenue' ? '+' : '-'}€{(parseFloat(e.amount) || 0).toLocaleString()}
                    </td>
                    <td>
                      <button className="fin-delete-btn" onClick={() => removeEntry(e.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* New Transaction Form Card */}
        <div className="fin-form-card">
          <div className="fin-card-header">
            <span className="fin-card-title">New Transaction</span>
          </div>
          <div className="fin-form-body">
            <div className="fin-form-field">
              <label>Type</label>
              <select className="fin-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div className="fin-form-field">
              <label>Category</label>
              <select className="fin-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="servicio">Service</option>
                <option value="producto">Product</option>
                <option value="herramienta">SaaS / Tools</option>
                <option value="marketing">Marketing</option>
                <option value="equipo">Team / HR</option>
                <option value="admin">Legal / Admin</option>
                <option value="otro">Other</option>
              </select>
            </div>
            <div className="fin-form-field">
              <label>Description</label>
              <input className="fin-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. V0 Server Costs" />
            </div>
            <div className="fin-form-field">
              <label>Amount (€)</label>
              <input className="fin-input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500" />
            </div>
            <div className="fin-form-field">
              <label>Date</label>
              <input className="fin-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="fin-form-field">
              <label>Recurrence</label>
              <select className="fin-input" value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <button className="fin-submit-btn" onClick={handleAdd} disabled={saving}>
              {saving ? 'Processing...' : 'Add Transaction'}
            </button>
          </div>
        </div>
      </div>

      <VaultAgentPanel title="FINANCE INTELLIGENCE" namespaces={['data', 'product']} />
    </div>
  )
}

export default Finance
