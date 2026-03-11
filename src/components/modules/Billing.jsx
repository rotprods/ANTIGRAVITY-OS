// ═══════════════════════════════════════════════════
// OCULOPS — Billing v11.0
// Recurring revenue, invoices & subscription plans
// ═══════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { useDeals } from '../../hooks/useDeals'
import { useFinance } from '../../hooks/useFinance'
import { useAppStore } from '../../stores/useAppStore'
import { supabase } from '../../lib/supabase'
import { PlusIcon } from '@heroicons/react/24/outline'
import ModulePage from '../ui/ModulePage'
import ModuleSkeleton from '../ui/ModuleSkeleton'
import './Billing.css'

const PLANS = [
  { id: 'free', name: 'Free', price: 0, features: ['1 user', '100 contacts', '3 agents', 'Basic CRM'] },
  { id: 'starter', name: 'Starter', price: 49, features: ['5 users', '5,000 contacts', '7 agents', 'Full CRM + Pipeline', 'Email automation', 'Basic analytics'] },
  { id: 'pro', name: 'Pro', price: 149, features: ['20 users', '50,000 contacts', '13 agents', 'Full automation suite', 'AI prospecting', 'Custom workflows', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 499, features: ['Unlimited users', 'Unlimited contacts', 'All agents + custom', 'White-label', 'Dedicated infra', 'SLA + onboarding', 'API access'] },
]

function Billing() {
  const { pipelineView, loading: dealsLoading } = useDeals()
  const { entries, mrr, totalRevenue, totalExpenses, addEntry, loading: financeLoading } = useFinance()
  const { toast } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], status: 'pending', client: '' })
  const [saving, setSaving] = useState(false)
  const [upgrading, setUpgrading] = useState(null)

  const handleUpgrade = useCallback(async (planId) => {
    setUpgrading(planId)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { plan: planId, org_id: 'default' } })
      if (error) throw new Error(error.message)
      if (data?.url) { window.open(data.url, '_blank'); toast('Redirecting to Stripe checkout...', 'success') }
      else toast('Stripe not configured. Set STRIPE_SECRET_KEY in Supabase secrets.', 'warning')
    } catch (err) { toast(err.message || 'Checkout failed', 'warning') }
    setUpgrading(null)
  }, [toast])

  const loading = dealsLoading || financeLoading
  const wonDeals = pipelineView['closed_won'] || []
  const clientsMRR = wonDeals.map(d => ({ id: d.id, name: d.contact?.name || d.company?.name || 'Unknown', company: d.company?.name || '', value: parseFloat(d.value) || 0 })).filter(c => c.value > 0)
  const invoices = entries.filter(e => e.type === 'revenue').sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  const handleAddInvoice = async () => {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    await addEntry({ type: 'revenue', category: 'factura', description: form.client ? `[${form.client}] ${form.description}` : form.description, amount: parseFloat(form.amount), date: form.date, is_recurring: false })
    setForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], status: 'pending', client: '' })
    setShowForm(false); setSaving(false)
  }

  if (loading) return <ModuleSkeleton variant="kpi" rows={4} />

  return (
    <ModulePage
      title="Billing"
      subtitle="Recurring revenue, invoices & plans"
      actions={<button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><PlusIcon style={{ width: 16, height: 16 }} />{showForm ? 'Cancel' : 'New invoice'}</button>}
    >
      <div className="lab-content">
        {/* KPIs */}
        <div className="kpi-strip kpi-strip-4">
          <div className="kpi-strip-cell"><span className="mono text-xs text-tertiary">MRR</span><span className="mono text-lg font-bold">€{mrr.toLocaleString()}</span></div>
          <div className="kpi-strip-cell"><span className="mono text-xs text-tertiary">Total revenue</span><span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>€{totalRevenue.toLocaleString()}</span></div>
          <div className="kpi-strip-cell"><span className="mono text-xs text-tertiary">Active clients</span><span className="mono text-lg font-bold" style={{ color: 'var(--color-info)' }}>{clientsMRR.length}</span></div>
          <div className="kpi-strip-cell"><span className="mono text-xs text-tertiary">Expenses</span><span className="mono text-lg font-bold" style={{ color: 'var(--color-danger)' }}>€{totalExpenses.toLocaleString()}</span></div>
        </div>

        {/* Plans */}
        <div className="billing-plans">
          {PLANS.map(plan => {
            const isCurrent = plan.id === 'free'
            return (
              <div key={plan.id} className={`billing-plan-card ${isCurrent ? 'current' : ''}`}>
                <div>
                  <div className="mono text-xs font-bold" style={{ color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: 4 }}>{plan.name}</div>
                  <div className="mono font-bold" style={{ fontSize: 24 }}>{plan.price === 0 ? 'Free' : `€${plan.price}`}{plan.price > 0 && <span className="mono text-xs text-tertiary">/mo</span>}</div>
                </div>
                <div className="billing-feature-list">
                  {plan.features.map(f => <div key={f} className="mono text-xs text-secondary">+ {f}</div>)}
                </div>
                {isCurrent ? (
                  <div className="mono text-xs font-bold" style={{ color: 'var(--accent-primary)', textAlign: 'center', padding: 'var(--space-2)' }}>Current plan</div>
                ) : (
                  <button className={`btn ${plan.id === 'pro' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleUpgrade(plan.id)} disabled={upgrading === plan.id}>
                    {upgrading === plan.id ? 'Processing...' : 'Upgrade'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Invoice form */}
        {showForm && (
          <div className="auto-form-panel">
            <div className="form-grid">
              <div className="form-field"><label className="form-label">Client</label><input className="form-input" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Acme Corp" /></div>
              <div className="form-field"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly retainer" /></div>
              <div className="form-field"><label className="form-label">Amount (€)</label><input className="form-input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="5000" /></div>
              <div className="form-field"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            </div>
            <button className="btn btn-primary" onClick={handleAddInvoice} disabled={saving}>{saving ? 'Saving...' : 'Create invoice'}</button>
          </div>
        )}

        {/* Invoice ledger + Client MRR */}
        <div className="billing-split">
          <div className="lab-panel">
            <div className="lab-panel-header">Invoices ({invoices.length})</div>
            {invoices.length === 0 ? <div className="lab-panel-empty">No invoices recorded</div> : (
              <table className="lab-table">
                <thead><tr><th>Date</th><th>Description</th><th>Value</th><th>Type</th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="text-tertiary">{inv.date}</td>
                      <td className="font-bold">{inv.description}</td>
                      <td className="font-bold" style={{ color: 'var(--color-success)' }}>€{(parseFloat(inv.amount) || 0).toLocaleString()}</td>
                      <td><span className="badge" style={{ color: inv.is_recurring ? 'var(--color-success)' : 'var(--text-secondary)', borderColor: inv.is_recurring ? 'var(--color-success)' : 'var(--border-subtle)' }}>{inv.is_recurring ? 'Recurring' : 'One-off'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="lab-panel">
            <div className="lab-panel-header">Client MRR portfolio</div>
            {clientsMRR.length === 0 ? <div className="lab-panel-empty">No recurring clients</div> : (
              <div>{clientsMRR.map((c) => {
                const maxVal = Math.max(...clientsMRR.map(x => x.value))
                const barPct = Math.round((c.value / maxVal) * 100)
                const mrrPct = mrr > 0 ? Math.round((c.value / mrr) * 100) : 0
                return (
                  <div key={c.id} className="lab-log-row" style={{ flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div><div className="mono text-sm font-bold">{c.name}</div><div className="mono text-xs text-tertiary">{c.company || 'N/A'}</div></div>
                      <div className="mono text-sm font-bold" style={{ color: 'var(--color-success)' }}>€{c.value.toLocaleString()}</div>
                    </div>
                    <div className="billing-client-bar">
                      <div className="billing-bar-track"><div className="billing-bar-fill" style={{ width: `${barPct}%` }} /></div>
                      <span className="mono text-xs text-secondary">{mrrPct}%</span>
                    </div>
                  </div>
                )
              })}</div>
            )}
          </div>
        </div>
      </div>
    </ModulePage>
  )
}

export default Billing
