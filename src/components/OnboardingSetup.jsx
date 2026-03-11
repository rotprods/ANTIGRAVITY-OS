import React, { useState, useEffect, useCallback } from 'react'
import { useOrg } from '../hooks/useOrg'
import { supabase } from '../lib/supabase'

const STEPS = [
  { id: 'profile', label: 'OPERATOR PROFILE', num: '01' },
  { id: 'org',     label: 'ORGANIZATION',     num: '02' },
  { id: 'agents',  label: 'YOUR AGENTS',       num: '03' },
  { id: 'ready',   label: 'LAUNCH',            num: '04' },
]

const INDUSTRIES = ['SaaS', 'E-commerce', 'Healthcare', 'Real Estate', 'Agency', 'Consulting', 'Other']
const TEAM_SIZES = ['Solo', '2-5', '6-20', '21-50', '50+']

// ── Vault agents available for import ──
const VAULT_AGENTS = [
  {
    code_name: 'sales-automator',
    name: 'SALES AUTOMATOR',
    icon: '⚡',
    namespace: 'product',
    description: 'Cold email sequences, follow-up cadences, proposal templates, conversion optimization.',
    model: 'gpt-4o',
    system_prompt: 'You are a sales automation specialist focused on conversions and relationships. You craft cold email sequences, follow-up campaigns, proposal templates, and sales scripts that convert.',
    allowed_skills: ['send_email', 'create_deal', 'update_contact'],
  },
  {
    code_name: 'market-research-analyst',
    name: 'MARKET RESEARCH',
    icon: '🔍',
    namespace: 'research',
    description: 'Comprehensive market intelligence, industry trends, competitive analysis, strategic insights.',
    model: 'gpt-4o',
    system_prompt: 'You are a Market Research Analyst. You conduct thorough market investigations, identify key players, analyze market dynamics, and deliver actionable intelligence reports.',
    allowed_skills: ['web_search', 'analyze_data', 'store_knowledge'],
  },
  {
    code_name: 'product-strategist',
    name: 'PRODUCT STRATEGIST',
    icon: '♟',
    namespace: 'product',
    description: 'Product positioning, competitive landscape, feature prioritization, go-to-market strategy.',
    model: 'gpt-4o',
    system_prompt: 'You are a product strategist specializing in transforming market insights into winning strategies. You excel at product positioning, competitive analysis, roadmaps, and go-to-market execution.',
    allowed_skills: ['analyze_data', 'web_search', 'store_knowledge'],
  },
  {
    code_name: 'competitive-analyst',
    name: 'COMPETITIVE ANALYST',
    icon: '🎯',
    namespace: 'research',
    description: 'Competitor monitoring, strategic analysis, market positioning, opportunity identification.',
    model: 'gpt-4o-mini',
    system_prompt: 'You are a competitive analyst. You monitor competitors, analyze their strategies, identify market gaps, and deliver intelligence that drives competitive advantage.',
    allowed_skills: ['web_search', 'analyze_data', 'store_knowledge'],
  },
  {
    code_name: 'customer-success-manager',
    name: 'CUSTOMER SUCCESS',
    icon: '🤝',
    namespace: 'product',
    description: 'Customer health scoring, churn prevention, upsell identification, onboarding sequences.',
    model: 'gpt-4o',
    system_prompt: 'You are a senior customer success manager. You assess customer health, build retention strategies, identify upsell opportunities, and maximize customer lifetime value.',
    allowed_skills: ['send_email', 'update_contact', 'analyze_data', 'create_deal'],
  },
]

// ── Industry → recommended vault agent codes ──
const INDUSTRY_RECS = {
  Agency:      ['sales-automator', 'market-research-analyst', 'competitive-analyst', 'product-strategist'],
  Consulting:  ['product-strategist', 'market-research-analyst', 'competitive-analyst', 'customer-success-manager'],
  SaaS:        ['product-strategist', 'competitive-analyst', 'customer-success-manager', 'market-research-analyst'],
  'E-commerce':['sales-automator', 'market-research-analyst', 'customer-success-manager', 'competitive-analyst'],
  Healthcare:  ['customer-success-manager', 'market-research-analyst', 'competitive-analyst', 'product-strategist'],
  'Real Estate':['sales-automator', 'market-research-analyst', 'customer-success-manager', 'competitive-analyst'],
  Other:       ['sales-automator', 'market-research-analyst', 'product-strategist', 'competitive-analyst'],
}

// ── Core OCULOPS agents (always active, not selectable) ──
const CORE_AGENTS = [
  { code_name: 'atlas',    name: 'ATLAS',    icon: '🌐', description: 'Market intelligence & prospecting' },
  { code_name: 'hunter',   name: 'HUNTER',   icon: '🎯', description: 'Lead capture & qualification' },
  { code_name: 'forge',    name: 'FORGE',    icon: '⚒',  description: 'Content & copy generation' },
]

export default function OnboardingSetup({ onComplete }) {
  const { createOrganization } = useOrg()
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newOrgId, setNewOrgId] = useState(null)

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [roleTitle, setRoleTitle] = useState('')

  // Org fields
  const [orgName, setOrgName] = useState('')
  const [industry, setIndustry] = useState('')
  const [teamSize, setTeamSize] = useState('')

  // Agent selection — pre-select recommended on industry change
  const [selectedAgents, setSelectedAgents] = useState(new Set())

  useEffect(() => {
    const recs = INDUSTRY_RECS[industry] || INDUSTRY_RECS.Other
    setSelectedAgents(new Set(recs))
  }, [industry])

  // Pre-fill from auth metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.user_metadata) return
      if (user.user_metadata.full_name) setFullName(user.user_metadata.full_name)
      if (user.user_metadata.phone) setPhone(user.user_metadata.phone)
      if (user.user_metadata.company) setCompany(user.user_metadata.company)
      if (user.user_metadata.role_title) setRoleTitle(user.user_metadata.role_title)
    })
  }, [])

  const handleProfileNext = async () => {
    if (!fullName.trim()) return setError('Nombre requerido')
    setSaving(true)
    setError(null)
    supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        company: company.trim() || null,
        role_title: roleTitle.trim() || null,
      },
    }).catch(err => console.warn('[Onboarding] profile update warning:', err))
    setSaving(false)
    setStep(1)
  }

  const handleOrgCreate = async () => {
    if (!orgName.trim()) return setError('Nombre de organización requerido')
    setError(null)
    setSaving(true)
    try {
      const newOrg = await createOrganization(orgName.trim(), {
        industry: industry || null,
        team_size: teamSize || null,
      })
      setNewOrgId(newOrg.id)
      setStep(2)
      supabase.rpc('complete_onboarding', {
        p_full_name: fullName.trim(),
        p_phone: phone.trim() || null,
        p_company: company.trim() || null,
        p_role_title: roleTitle.trim() || null,
        p_default_org_id: newOrg.id,
      }).catch(err => console.warn('[Onboarding] complete_onboarding RPC warning:', err))
    } catch (err) {
      console.error('[Onboarding] org creation failed:', err)
      setStep(2)
    } finally {
      setSaving(false)
    }
  }

  const handleAgentsActivate = useCallback(async () => {
    if (selectedAgents.size === 0) { setStep(3); return }
    setSaving(true)

    const toImport = VAULT_AGENTS.filter(a => selectedAgents.has(a.code_name))
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

    const rows = toImport.map(a => ({
      code_name:       a.code_name,
      name:            a.name,
      namespace:       a.namespace,
      description:     a.description,
      model:           a.model,
      system_prompt:   a.system_prompt,
      allowed_skills:  a.allowed_skills,
      restricted_skills: [],
      safe_mode:       true,
      max_rounds:      4,
      max_spend_usd:   1.0,
      is_active:       true,
      org_id:          newOrgId || null,
      created_by:      user?.id || null,
      source:          'vault:onboarding',
    }))

    await supabase
      .from('agent_definitions')
      .upsert(rows, { onConflict: 'code_name', ignoreDuplicates: false })
      .catch(err => console.warn('[Onboarding] agent import warning:', err))

    setSaving(false)
    setStep(3)
  }, [selectedAgents, newOrgId])

  const toggleAgent = (code_name) => {
    setSelectedAgents(prev => {
      const next = new Set(prev)
      if (next.has(code_name)) next.delete(code_name)
      else next.add(code_name)
      return next
    })
  }

  // Auto-transition from step 3 → main app
  useEffect(() => {
    if (step !== 3) return
    const timer = setTimeout(() => {
      if (onComplete) onComplete()
    }, 2000)
    return () => clearTimeout(timer)
  }, [step, onComplete])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: step === 2 ? 560 : 480,
        background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
        padding: '40px 32px', position: 'relative',
        transition: 'max-width 0.3s',
      }}>
        {/* Accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'var(--accent-primary)',
        }} />

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                height: 2,
                background: i <= step ? 'var(--accent-primary)' : 'var(--border-default)',
                transition: 'background 0.3s',
              }} />
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)',
                color: i <= step ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                letterSpacing: '0.1em',
              }}>
                {s.num} {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Step 0: Profile */}
        {step === 0 && (
          <>
            <h1 style={{
              fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 6px', letterSpacing: '-0.02em',
            }}>
              Configura tu perfil
            </h1>
            <p style={{
              fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 28px', lineHeight: 1.5,
            }}>
              Información del operador principal del sistema.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="NOMBRE COMPLETO *" value={fullName} onChange={setFullName}
                placeholder="Roberto Ortega" autoFocus />
              <Field label="TELÉFONO" value={phone} onChange={setPhone}
                placeholder="+34 600 000 000" type="tel" />
              <Field label="EMPRESA" value={company} onChange={setCompany}
                placeholder="Tu empresa actual" />
              <Field label="CARGO" value={roleTitle} onChange={setRoleTitle}
                placeholder="CEO, CTO, Director..." />
            </div>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <button onClick={handleProfileNext} disabled={saving || !fullName.trim()}
              style={btnStyle(saving || !fullName.trim())}>
              {saving ? 'GUARDANDO...' : 'CONTINUAR'}
            </button>
          </>
        )}

        {/* Step 1: Organization */}
        {step === 1 && (
          <>
            <h1 style={{
              fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 6px', letterSpacing: '-0.02em',
            }}>
              Crea tu organización
            </h1>
            <p style={{
              fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 28px', lineHeight: 1.5,
            }}>
              Tu centro de operaciones. Podrás invitar miembros después.
            </p>
            <Field label="NOMBRE DE LA ORGANIZACIÓN *" value={orgName} onChange={setOrgName}
              placeholder="Acme Corp, Stark Industries..." autoFocus />
            <div>
              <label style={{
                display: 'block', fontSize: 9, fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)', letterSpacing: '0.12em',
                marginBottom: 6, textTransform: 'uppercase',
              }}>
                INDUSTRIA
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--surface-base)', border: '1px solid var(--border-default)',
                  color: industry ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none',
                  boxSizing: 'border-box', cursor: 'pointer', appearance: 'none',
                }}
              >
                <option value="">Selecciona industria</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{
                display: 'block', fontSize: 9, fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)', letterSpacing: '0.12em',
                marginBottom: 6, textTransform: 'uppercase',
              }}>
                TAMAÑO DE EQUIPO
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TEAM_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setTeamSize(size)}
                    style={{
                      flex: 1, padding: '9px 0',
                      background: teamSize === size ? 'var(--accent-primary)' : 'var(--surface-base)',
                      color: teamSize === size ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                      border: `1px solid ${teamSize === size ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                      cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.15s',
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button onClick={() => { setStep(0); setError(null) }}
                style={{
                  ...btnStyle(false),
                  background: 'none', border: '1px solid var(--border-default)',
                  color: 'var(--text-tertiary)', flex: '0 0 80px',
                }}>
                ATRÁS
              </button>
              <button onClick={handleOrgCreate} disabled={saving || !orgName.trim()}
                style={{ ...btnStyle(saving || !orgName.trim()), flex: 1 }}>
                {saving ? 'CREANDO...' : 'ESTABLECER HQ'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Agent Selection */}
        {step === 2 && (
          <>
            <h1 style={{
              fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 6px', letterSpacing: '-0.02em',
            }}>
              Activa tus agentes
            </h1>
            <p style={{
              fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 20px', lineHeight: 1.5,
            }}>
              {industry
                ? `Recomendados para ${industry}. Selecciona los que quieres activar.`
                : 'Selecciona los agentes vault que quieres activar.'}
            </p>

            {/* Core agents — always active */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                letterSpacing: '0.12em', marginBottom: 8, textTransform: 'uppercase',
              }}>
                CORE OCULOPS — SIEMPRE ACTIVOS
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {CORE_AGENTS.map(a => (
                  <div key={a.code_name} style={{
                    flex: 1, padding: '8px 10px',
                    background: 'rgba(123,140,255,0.08)',
                    border: '1px solid var(--accent-primary)',
                    opacity: 0.7,
                  }}>
                    <div style={{ fontSize: 14, marginBottom: 2 }}>{a.icon}</div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em' }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.3 }}>{a.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vault agents — selectable */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                letterSpacing: '0.12em', marginBottom: 8, textTransform: 'uppercase',
              }}>
                VAULT AGENTS — SELECCIONA
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {VAULT_AGENTS.map(a => {
                  const selected = selectedAgents.has(a.code_name)
                  return (
                    <button
                      key={a.code_name}
                      type="button"
                      onClick={() => toggleAgent(a.code_name)}
                      style={{
                        padding: '10px 12px', textAlign: 'left',
                        background: selected ? 'rgba(123,140,255,0.1)' : 'var(--surface-base)',
                        border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                        position: 'relative',
                      }}
                    >
                      {selected && (
                        <div style={{
                          position: 'absolute', top: 6, right: 8,
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--accent-primary)',
                        }} />
                      )}
                      <div style={{ fontSize: 14, marginBottom: 3 }}>{a.icon}</div>
                      <div style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: selected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        letterSpacing: '0.08em', marginBottom: 3,
                      }}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>
                        {a.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setStep(3)}
                style={{
                  ...btnStyle(false),
                  background: 'none', border: '1px solid var(--border-default)',
                  color: 'var(--text-tertiary)', flex: '0 0 80px', marginTop: 0,
                }}
              >
                OMITIR
              </button>
              <button
                onClick={handleAgentsActivate}
                disabled={saving}
                style={{ ...btnStyle(saving), flex: 1, marginTop: 0 }}
              >
                {saving
                  ? 'ACTIVANDO...'
                  : `ACTIVAR ${selectedAgents.size > 0 ? `${selectedAgents.size} AGENTES` : 'SELECCIÓN'}`}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Ready */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent-primary)', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: '#000', fontWeight: 700,
              boxShadow: '0 0 24px rgba(123,140,255,0.3)',
            }}>
              OC
            </div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}>
              Sistema operativo listo
            </h1>
            <p style={{
              fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 4px',
            }}>
              Entrando al centro de mando...
            </p>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '2px solid var(--border-default)',
              borderTopColor: 'var(--accent-primary)',
              animation: 'spin 1s linear infinite',
              margin: '20px auto 0',
            }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reusable field ──
function Field({ label, value, onChange, placeholder, type = 'text', autoFocus }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 9, fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)', letterSpacing: '0.12em',
        marginBottom: 6, textTransform: 'uppercase',
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--surface-base)', border: '1px solid var(--border-default)',
          color: 'var(--text-primary)', fontSize: 13,
          fontFamily: 'var(--font-sans)', outline: 'none',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
        onBlur={(e) => e.target.style.borderColor = 'var(--border-default)'}
      />
    </div>
  )
}

function ErrorMsg({ children }) {
  return (
    <div style={{
      marginTop: 12, padding: '8px 12px', fontSize: 11,
      color: 'var(--color-danger)', background: 'rgba(255,51,51,0.08)',
      border: '1px solid rgba(255,51,51,0.15)',
      fontFamily: 'var(--font-mono)',
    }}>
      {children}
    </div>
  )
}

function btnStyle(disabled) {
  return {
    width: '100%', padding: '12px 20px', marginTop: 24,
    background: disabled ? 'var(--surface-elevated)' : 'var(--accent-primary)',
    color: disabled ? 'var(--text-tertiary)' : '#000',
    border: 'none', fontSize: 12, fontWeight: 700,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  }
}
