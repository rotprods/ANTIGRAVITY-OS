import React, { useState, useEffect } from 'react'
import { useOrg } from '../hooks/useOrg'
import { supabase } from '../lib/supabase'

const STEPS = [
  { id: 'profile', label: 'OPERATOR PROFILE', num: '01' },
  { id: 'org',     label: 'ORGANIZATION',     num: '02' },
  { id: 'ready',   label: 'LAUNCH',           num: '03' },
]

export default function OnboardingSetup({ onComplete }) {
  const { createOrganization } = useOrg()
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [roleTitle, setRoleTitle] = useState('')

  // Org field
  const [orgName, setOrgName] = useState('')

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

    const { error: err } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        company: company.trim() || null,
        role_title: roleTitle.trim() || null,
      },
    })

    if (err) {
      setError('Error guardando perfil')
      setSaving(false)
      return
    }
    setSaving(false)
    setStep(1)
  }

  const handleOrgCreate = async () => {
    if (!orgName.trim()) return setError('Nombre de organización requerido')
    setError(null)
    setSaving(true)

    try {
      const newOrg = await createOrganization(orgName.trim())
      
      // Show success immediately — don't block on RPC
      setStep(2)

      // Fire-and-forget: complete onboarding metadata in background
      supabase.rpc('complete_onboarding', {
        p_full_name: fullName.trim(),
        p_phone: phone.trim() || null,
        p_company: company.trim() || null,
        p_role_title: roleTitle.trim() || null,
        p_default_org_id: newOrg.id,
      }).catch(err => console.warn('[Onboarding] complete_onboarding RPC warning:', err))

    } catch (err) {
      console.error('[Onboarding] org creation failed:', err)
      // Still advance — user can retry from main app
      setStep(2)
    } finally {
      setSaving(false)
    }
  }

  // Auto-transition from step 2 → main app
  useEffect(() => {
    if (step !== 2) return
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
        width: '100%', maxWidth: 480,
        background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
        padding: '40px 32px', position: 'relative',
      }}>
        {/* Gold top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'var(--accent-primary)',
        }} />

        {/* Step indicator */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 32,
        }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
            }}>
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
              fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 28px',
              lineHeight: 1.5,
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
              fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 28px',
              lineHeight: 1.5,
            }}>
              Tu centro de operaciones. Podrás invitar miembros después.
            </p>

            <Field label="NOMBRE DE LA ORGANIZACIÓN *" value={orgName} onChange={setOrgName}
              placeholder="Acme Corp, Stark Industries..." autoFocus />

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button onClick={() => { setStep(0); setError(null) }}
                style={{
                  ...btnStyle(false),
                  background: 'none', border: '1px solid var(--border-default)',
                  color: 'var(--text-tertiary)', flex: 'none', width: 100,
                }}>
                ATRÁS
              </button>
              <button onClick={handleOrgCreate}
                disabled={saving || !orgName.trim()}
                style={{ ...btnStyle(saving || !orgName.trim()), flex: 1 }}>
                {saving ? 'CREANDO...' : 'ESTABLECER HQ'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Ready */}
        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent-primary)', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: '#000', fontWeight: 700,
              boxShadow: '0 0 24px rgba(255,212,0,0.3)',
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
