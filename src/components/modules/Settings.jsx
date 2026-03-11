// ═══════════════════════════════════════════════════
// OCULOPS — Settings v11.0
// Account, agency, integrations & system
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { supabase, getCurrentUserId } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAppStore } from '../../stores/useAppStore'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import ModulePage from '../ui/ModulePage'
import './Settings.css'

const AGENCY_DEFAULTS = { name: 'Oculops Agency', website: '', email: '', phone: '', icp: 'SMB 10-200 employees — e-commerce, clinics, real estate, B2B SaaS', services: 'AI chatbots, automation, Meta ads, auto-prospecting' }

function maskKey(key) {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

function formatPublicValue(key, value) {
  if (!value) return 'Not configured'
  if (key === 'VITE_SUPABASE_URL') { try { return new URL(value).origin } catch { return value } }
  return maskKey(value)
}

function Settings() {
  const [agency, setAgency] = useState(AGENCY_DEFAULTS)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('account')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '', company: '', role_title: '' })
  const [profileSaved, setProfileSaved] = useState(false)
  const [passwordFields, setPasswordFields] = useState({ current: '', new: '', confirm: '' })
  const [passwordMsg, setPasswordMsg] = useState(null)
  
  const { currentOrg } = useOrg()
  const { toast } = useAppStore()
  const [billingMode, setBillingMode] = useState('managed')
  const [credits, setCredits] = useState(0)
  const [customKeyOpenAI, setCustomKeyOpenAI] = useState('')
  const [savingCredits, setSavingCredits] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      if (!supabase) { setLoadingProfile(false); return }
      const userId = await getCurrentUserId()
      if (!userId) { setLoadingProfile(false); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) {
        setProfile({ full_name: data.full_name || '', email: data.email || '', phone: data.phone || '', company: data.company || '', role_title: data.role_title || '' })
        if (data.settings?.agency) setAgency(prev => ({ ...prev, ...data.settings.agency }))
      }
      setLoadingProfile(false)
    }
    loadSettings()
  }, [])

  useEffect(() => {
    async function loadBilling() {
      if (!currentOrg?.id) return
      
      const { data: bal } = await supabase.from('credit_balances').select('available_credits, billing_mode').eq('org_id', currentOrg.id).single()
      if (bal) {
        setCredits(bal.available_credits)
        setBillingMode(bal.billing_mode)
      }
      
      const { data: k } = await supabase.from('custom_api_keys').select('encrypted_key').eq('org_id', currentOrg.id).eq('provider', 'openai').eq('is_active', true).maybeSingle()
      if (k) setCustomKeyOpenAI(k.encrypted_key)
    }
    loadBilling()
  }, [currentOrg?.id])

  const saveBillingSettings = async () => {
    if (!currentOrg?.id) return
    setSavingCredits(true)
    try {
      await supabase.from('credit_balances').update({ billing_mode: billingMode }).eq('org_id', currentOrg.id)
      
      if (customKeyOpenAI) {
        const { data: existing } = await supabase.from('custom_api_keys').select('id').eq('org_id', currentOrg.id).eq('provider', 'openai').maybeSingle()
        if (existing) {
          await supabase.from('custom_api_keys').update({ encrypted_key: customKeyOpenAI, is_active: true, key_hint: maskKey(customKeyOpenAI) }).eq('id', existing.id)
        } else {
          await supabase.from('custom_api_keys').insert({ org_id: currentOrg.id, provider: 'openai', encrypted_key: customKeyOpenAI, is_active: true, key_hint: maskKey(customKeyOpenAI) })
        }
      } else {
        await supabase.from('custom_api_keys').update({ is_active: false }).eq('org_id', currentOrg.id).eq('provider', 'openai')
      }
      toast('Billing & API settings saved', 'success')
    } catch(e) {
      console.error(e)
      toast('Failed to save settings', 'error')
    }
    setSavingCredits(false)
  }

  const publicEnvKeys = [
    { label: 'Supabase URL', key: 'VITE_SUPABASE_URL' },
    { label: 'Supabase anon key', key: 'VITE_SUPABASE_ANON_KEY' },
  ]

  const protectedIntegrations = [
    { label: 'OpenAI', location: 'Supabase Edge Functions / private env' },
    { label: 'Anthropic Claude', location: 'Supabase Edge Functions / private env' },
    { label: 'Meta Graph API', location: 'Supabase Secrets / private backend' },
    { label: 'Meta WhatsApp', location: 'Private webhooks / secrets' },
  ]

  const saveAgency = useCallback(async () => {
    if (supabase) {
      const userId = await getCurrentUserId()
      if (userId) {
        const { data: p } = await supabase.from('profiles').select('settings').eq('id', userId).single()
        await supabase.from('profiles').update({ settings: { ...(p?.settings || {}), agency }, updated_at: new Date().toISOString() }).eq('id', userId)
      }
    }
    localStorage.setItem('ag_agency', JSON.stringify(agency))
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }, [agency])

  const clearCache = () => {
    Object.keys(localStorage).filter(k => k.startsWith('ag_') || k.startsWith('oculops')).forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  const saveProfile = useCallback(async () => {
    const userId = await getCurrentUserId()
    if (!userId) return
    await supabase.from('profiles').update({ full_name: profile.full_name, phone: profile.phone || null, company: profile.company || null, role_title: profile.role_title || null, updated_at: new Date().toISOString() }).eq('id', userId)
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000)
  }, [profile])

  const changePassword = useCallback(async () => {
    setPasswordMsg(null)
    if (passwordFields.new.length < 6) return setPasswordMsg({ type: 'error', text: 'Minimum 6 characters' })
    if (passwordFields.new !== passwordFields.confirm) return setPasswordMsg({ type: 'error', text: 'Passwords do not match' })
    const { error } = await supabase.auth.updateUser({ password: passwordFields.new })
    if (error) return setPasswordMsg({ type: 'error', text: error.message })
    setPasswordMsg({ type: 'success', text: 'Password updated' })
    setPasswordFields({ current: '', new: '', confirm: '' })
    setTimeout(() => setPasswordMsg(null), 3000)
  }, [passwordFields])

  const tabs = [
    { id: 'account', label: 'Account' },
    { id: 'agency', label: 'Agency profile' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'credits', label: 'Credits & API Keys' },
    { id: 'system', label: 'System' },
  ]

  return (
    <ModulePage
      title="Settings"
      subtitle="Account, agency, integrations & system"
      actions={
        <div className="lab-tabs">
          {tabs.map(t => <button key={t.id} className={`lab-tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>)}
        </div>
      }
    >
      <div className="lab-content">
        {activeTab === 'account' && (
          <div className="settings-grid-2">
            <div className="lab-panel">
              <div className="lab-panel-header">Profile</div>
              <div className="ct-section-body">
                <div className="form-grid">
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Full name</label><input className="form-input" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} /></div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Email</label><input className="form-input" value={profile.email} disabled style={{ opacity: 0.5 }} /><span className="mono text-xs text-tertiary">Managed by Supabase Auth</span></div>
                  <div className="form-field"><label className="form-label">Phone</label><input className="form-input" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+34 600 000 000" /></div>
                  <div className="form-field"><label className="form-label">Role</label><input className="form-input" value={profile.role_title} onChange={e => setProfile(p => ({ ...p, role_title: e.target.value }))} placeholder="CEO, CTO..." /></div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Company</label><input className="form-input" value={profile.company} onChange={e => setProfile(p => ({ ...p, company: e.target.value }))} /></div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                  <button className={`btn ${profileSaved ? 'btn-primary' : 'btn-ghost'}`} onClick={saveProfile}>{profileSaved ? 'Saved!' : 'Save profile'}</button>
                </div>
              </div>
            </div>

            <div className="lab-panel">
              <div className="lab-panel-header" style={{ color: 'var(--color-warning)' }}>Change password</div>
              <div className="ct-section-body">
                <div className="form-grid">
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">New password</label><input className="form-input" type="password" value={passwordFields.new} onChange={e => setPasswordFields(p => ({ ...p, new: e.target.value }))} placeholder="Minimum 6 characters" /></div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Confirm password</label><input className="form-input" type="password" value={passwordFields.confirm} onChange={e => setPasswordFields(p => ({ ...p, confirm: e.target.value }))} /></div>
                </div>
                {passwordMsg && <div className={`settings-msg ${passwordMsg.type === 'error' ? 'settings-msg--error' : 'settings-msg--success'}`}>{passwordMsg.text}</div>}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                  <button className="btn btn-ghost" style={{ color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }} onClick={changePassword} disabled={!passwordFields.new}>Update password</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agency' && (
          <div className="lab-panel">
            <div className="lab-panel-header">Agency settings</div>
            <div className="ct-section-body">
              <div className="form-grid">
                <div className="form-field"><label className="form-label">Agency name</label><input className="form-input" value={agency.name} onChange={e => setAgency(a => ({ ...a, name: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Website</label><input className="form-input" value={agency.website} onChange={e => setAgency(a => ({ ...a, website: e.target.value }))} placeholder="https://domain.com" /></div>
                <div className="form-field"><label className="form-label">Email</label><input className="form-input" type="email" value={agency.email} onChange={e => setAgency(a => ({ ...a, email: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Phone</label><input className="form-input" value={agency.phone} onChange={e => setAgency(a => ({ ...a, phone: e.target.value }))} /></div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Ideal customer profile</label><textarea className="form-input" rows={2} value={agency.icp} onChange={e => setAgency(a => ({ ...a, icp: e.target.value }))} /></div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Services offered</label><textarea className="form-input" rows={2} value={agency.services} onChange={e => setAgency(a => ({ ...a, services: e.target.value }))} /></div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <button className={`btn ${saved ? 'btn-primary' : 'btn-ghost'}`} onClick={saveAgency}>{saved ? 'Saved!' : 'Save settings'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="lab-col-layout">
            <div className="lab-panel">
              <div className="lab-panel-header"><span>Public runtime variables</span><span className="mono text-xs" style={{ color: 'var(--color-info)', fontWeight: 'normal' }}>Read only</span></div>
              <div className="ct-section-body">
                <p className="mono text-xs text-tertiary" style={{ lineHeight: 1.4, marginBottom: 'var(--space-4)' }}>Client-safe variables only. Vendor secrets must not be exposed via VITE_*.</p>
                <table className="lab-table">
                  <tbody>
                    {publicEnvKeys.map(({ label, key }) => {
                      const val = import.meta.env[key]
                      return (
                        <tr key={key}>
                          <td><div className="font-bold">{label}</div><div className="text-tertiary">{key}</div></td>
                          <td style={{ textAlign: 'right', color: val ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatPublicValue(key, val)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lab-panel">
              <div className="lab-panel-header" style={{ color: 'var(--color-warning)' }}><span>Protected integrations</span><span className="mono text-xs" style={{ color: 'var(--color-danger)', fontWeight: 'normal' }}>Backend only</span></div>
              <div className="ct-section-body">
                <p className="mono text-xs text-tertiary" style={{ lineHeight: 1.4, marginBottom: 'var(--space-4)' }}>Credentials secured in Supabase Secrets or server-side env.</p>
                <table className="lab-table">
                  <tbody>
                    {protectedIntegrations.map(({ label, location }) => (
                      <tr key={label}>
                        <td><div className="font-bold">{label}</div><div className="text-secondary">{location}</div></td>
                        <td className="text-tertiary" style={{ textAlign: 'right' }}>Not visible</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'credits' && (
          <div className="lab-col-layout">
            <div className="lab-panel">
              <div className="lab-panel-header">Platform Credits</div>
              <div className="ct-section-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                  <div>
                    <div className="mono text-2xl font-bold" style={{ color: credits > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{credits.toFixed(2)}</div>
                    <div className="mono text-xs text-tertiary">Available OCUL Credits (1 cr = $0.01)</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => toast('Top-up integration coming soon', 'info')}>Add Credits</button>
                </div>
                
                <h4 className="form-label" style={{ marginBottom: 'var(--space-3)' }}>Billing Mode</h4>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                  <button 
                    className={`btn ${billingMode === 'managed' ? 'btn-primary' : 'btn-ghost'}`} 
                    onClick={() => setBillingMode('managed')}
                    style={{ flex: 1, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', gap: 4 }}
                  >
                    <div className="font-bold">Managed Mode</div>
                    <div className="text-xs" style={{ opacity: 0.8 }}>OCULOPS provides models. Costs deducted from your credits.</div>
                  </button>
                  <button 
                    className={`btn ${billingMode === 'developer' ? 'btn-primary' : 'btn-ghost'}`} 
                    onClick={() => setBillingMode('developer')}
                    style={{ flex: 1, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', gap: 4 }}
                  >
                    <div className="font-bold">Developer Mode</div>
                    <div className="text-xs" style={{ opacity: 0.8 }}>Provide your own API keys. 0.1 cr orchestration fee per request.</div>
                  </button>
                </div>
              </div>
            </div>

            {billingMode === 'developer' && (
              <div className="lab-panel" style={{ border: '1px solid var(--accent-primary)' }}>
                <div className="lab-panel-header" style={{ color: 'var(--accent-primary)' }}>Developer API Keys</div>
                <div className="ct-section-body">
                  <p className="mono text-xs text-secondary" style={{ marginBottom: 'var(--space-4)', lineHeight: 1.4 }}>Keys are encrypted via Supabase Vault AES-256-GCM and only used by your organization's sub-agents.</p>
                  <div className="form-grid">
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">OpenAI API Key (sk-proj-...)</label>
                      <input 
                        className="form-input" 
                        type="password"
                        placeholder="sk-proj-..." 
                        value={customKeyOpenAI} 
                        onChange={e => setCustomKeyOpenAI(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <button className="btn btn-primary" onClick={saveBillingSettings} disabled={savingCredits}>
                {savingCredits ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="settings-grid-asym">
            <div className="lab-panel">
              <div className="lab-panel-header">System overview</div>
              <table className="lab-table">
                <tbody>
                  {[
                    { label: 'OS version', value: 'v11.0 (Alpha)' },
                    { label: 'Runtime', value: 'React 19 + Vite 7' },
                    { label: 'Database', value: 'Supabase PostgreSQL / Edge' },
                    { label: 'Mode', value: import.meta.env.MODE },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="text-secondary">{label}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lab-panel">
              <div className="lab-panel-header" style={{ color: 'var(--color-warning)' }}>Local storage</div>
              <div className="ct-section-body">
                <p className="mono text-xs text-tertiary" style={{ lineHeight: 1.4, marginBottom: 'var(--space-4)' }}>Wipe local browser cache. Active database layer is unaffected.</p>
                <button className="btn btn-danger" onClick={clearCache}>Clear local cache</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModulePage>
  )
}

export default Settings
