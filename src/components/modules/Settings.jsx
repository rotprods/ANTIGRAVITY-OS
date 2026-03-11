// ═══════════════════════════════════════════════════
// OCULOPS — Settings Module
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { supabase, getCurrentUserId } from '../../lib/supabase'

const AGENCY_DEFAULTS = {
  name: 'OCULOPS AGENCY',
  website: '',
  email: '',
  phone: '',
  icp: 'SMB 10-200 EMPLOYEES — E-COMMERCE, CLINICS, REAL ESTATE, B2B SAAS',
  services: 'AI CHATBOTS, AUTOMATION, META ADS, AUTO-PROSPECTING',
}

function maskKey(key) {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

function formatPublicValue(key, value) {
  if (!value) return 'UNCONFIGURED [SYS_WARN]'
  if (key === 'VITE_SUPABASE_URL') {
    try {
      return new URL(value).origin
    } catch {
      return value
    }
  }
  return maskKey(value)
}

function Settings() {
  const [agency, setAgency] = useState(AGENCY_DEFAULTS)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('agency')
  const [loadingProfile, setLoadingProfile] = useState(true)

  // Load agency settings from Supabase profiles.settings
  useEffect(() => {
    async function loadSettings() {
      if (!supabase) { setLoadingProfile(false); return }
      const userId = await getCurrentUserId()
      if (!userId) { setLoadingProfile(false); return }
      const { data } = await supabase.from('profiles').select('settings').eq('id', userId).single()
      if (data?.settings?.agency) {
        setAgency(prev => ({ ...prev, ...data.settings.agency }))
      }
      setLoadingProfile(false)
    }
    loadSettings()
  }, [])

  const publicEnvKeys = [
    { label: 'SUPABASE URL', key: 'VITE_SUPABASE_URL' },
    { label: 'SUPABASE ANON KEY', key: 'VITE_SUPABASE_ANON_KEY' },
  ]

  const protectedIntegrations = [
    { label: 'OPENAI INGRESS', location: 'SUPABASE EDGE FUNCTIONS / PRIVATE ENV' },
    { label: 'ANTHROPIC CLAUDE', location: 'SUPABASE EDGE FUNCTIONS / PRIVATE ENV' },
    { label: 'META GRAPH API', location: 'SUPABASE SECRETS / PRIVATE BACKEND' },
    { label: 'META WHATSAPP', location: 'PRIVATE WEBHOOKS / SECRETS' },
  ]

  const saveAgency = useCallback(async () => {
    // Save to Supabase profiles.settings
    if (supabase) {
      const userId = await getCurrentUserId()
      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('settings').eq('id', userId).single()
        const existingSettings = profile?.settings || {}
        await supabase.from('profiles').update({
          settings: { ...existingSettings, agency },
          updated_at: new Date().toISOString(),
        }).eq('id', userId)
      }
    }
    // Also keep localStorage as fallback
    localStorage.setItem('ag_agency', JSON.stringify(agency))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [agency])

  const clearCache = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('ag_') || k.startsWith('oculops'))
    keys.forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  const tabs = [
    { id: 'agency', label: '01. DIRECTIVE PROFILE' },
    { id: 'integrations', label: '02. INTEGRATION MATRIX' },
    { id: 'system', label: '03. SYSTEM CORE' },
  ]

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>SYSTEM CONFIGURATION</h1>
          <span className="mono text-xs text-tertiary">AGENCY PROFILE, INTEGRATION SECRETS & SYSTEM CORE SETTINGS</span>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              className="mono"
              style={{ padding: '8px 16px', fontSize: '10px', background: activeTab === t.id ? 'var(--color-primary)' : 'transparent', color: activeTab === t.id ? '#000' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'agency' && (
          <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// CORE AGENCY PARAMETERS</div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(250px, 1fr)', gap: '16px' }}>
                <div className="input-group">
                  <label className="mono text-xs">AGENCY DESIGNATION</label>
                  <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={agency.name} onChange={e => setAgency(a => ({ ...a, name: e.target.value }))} placeholder="AGENCY OR ORG NAME" />
                </div>
                <div className="input-group">
                  <label className="mono text-xs">EXTERNAL DOMAIN / WEBSITE</label>
                  <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={agency.website} onChange={e => setAgency(a => ({ ...a, website: e.target.value }))} placeholder="HTTPS://DOMAIN.COM" />
                </div>
                <div className="input-group">
                  <label className="mono text-xs">PRIMARY COMMS (EMAIL)</label>
                  <input className="input mono text-xs" type="email" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={agency.email} onChange={e => setAgency(a => ({ ...a, email: e.target.value }))} placeholder="COMM@DOMAIN.COM" />
                </div>
                <div className="input-group">
                  <label className="mono text-xs">PRIMARY CONTACT (PHONE)</label>
                  <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={agency.phone} onChange={e => setAgency(a => ({ ...a, phone: e.target.value }))} placeholder="+1 555-000-0000" />
                </div>
              </div>

              <div className="input-group">
                <label className="mono text-xs">ICP (IDEAL CUSTOMER PROFILE) MATRIX</label>
                <textarea className="input mono text-xs" rows={2} style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={agency.icp} onChange={e => setAgency(a => ({ ...a, icp: e.target.value }))} />
              </div>

              <div className="input-group">
                <label className="mono text-xs">PRIMARY DEPLOYMENT SERVICES</label>
                <textarea className="input mono text-xs" rows={2} style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={agency.services} onChange={e => setAgency(a => ({ ...a, services: e.target.value }))} />
              </div>

              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button className="btn mono" style={{ border: '1px solid var(--color-primary)', background: saved ? 'var(--color-primary)' : '#000', color: saved ? '#000' : 'var(--color-primary)', borderRadius: 0, padding: '12px 24px' }} onClick={saveAgency}>
                  {saved ? 'PARAMETERS SECURED' : 'SECURE NEW PARAMETERS'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)', display: 'flex', gap: '16px' }}>
                <span>/// PUBLIC RUNTIME MATRIX</span>
                <span style={{ color: 'var(--color-info)' }}>[READ ONLY]</span>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="mono text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                  DISPLAYING CLIENT-SAFE VARIABLES ONLY. VENDOR SECRETS MUST NOT BE EXPOSED VIA `VITE_*`.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  <tbody>
                    {publicEnvKeys.map(({ label, key }) => {
                      const val = import.meta.env[key]
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '12px 0' }}>
                            <div style={{ fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '4px' }}>{label}</div>
                            <div style={{ color: 'var(--text-tertiary)' }}>{key}</div>
                          </td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: val ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {formatPublicValue(key, val)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-warning)', display: 'flex', gap: '16px' }}>
                <span>/// PROTECTED ASSETS</span>
                <span style={{ color: 'var(--color-danger)' }}>[BACKEND DEPLOYMENT ONLY]</span>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="mono text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                  CREDENTIALS SECURED IN SUPABASE SECRETS, PRIVATE WEBHOOKS, OR SERVER-SIDE ENV VARIABLES. UNREADABLE FROM CLOUD CLIENT.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  <tbody>
                    {protectedIntegrations.map(({ label, location }) => (
                      <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 0' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '4px' }}>{label}</div>
                          <div style={{ color: 'var(--color-text-2)' }}>{location}</div>
                        </td>
                        <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--text-tertiary)' }}>
                          NON_VISIBLE_CLIENT
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// CORE OVERVIEW</div>
              <div style={{ padding: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  <tbody>
                    {[
                      { label: 'OS VERSION', value: 'V10.3 (ALPHA)' },
                      { label: 'RUNTIME STACK', value: 'REACT 19 + VITE 7 + ELECTRON 35' },
                      { label: 'DB LAYER', value: 'SUPABASE POSTGRESQL // EDGE' },
                      { label: 'CURRENT MODE', value: import.meta.env.MODE === 'production' ? 'PRODUCTION' : 'DEVELOPMENT' },
                      { label: 'NODE ENVIRONMENT', value: import.meta.env.MODE.toUpperCase() },
                    ].map(({ label, value }) => (
                      <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 0', color: 'var(--color-text-2)' }}>{label}</td>
                        <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--color-primary)', fontWeight: 'bold' }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
              <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-warning)' }}>/// MEMORY CONTROL</div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p className="mono text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                  WIPE LOCAL BROWSER CACHE (LOCALSTORAGE). ACTIVE SUPABASE DB LAYER IS UNAFFECTED.
                </p>
                <button className="btn mono" style={{ border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', borderRadius: 0, padding: '12px' }} onClick={clearCache}>
                  PURGE LOCAL MEMORY
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings
