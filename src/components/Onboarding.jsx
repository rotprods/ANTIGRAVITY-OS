// ═══════════════════════════════════════════════════
// OCULOPS — Onboarding Flow (3-Step Wizard)
// Shows after signup when user has no profile/org
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { insertRow, updateRow } from '../lib/supabase'

const INDUSTRIES = [
  'SaaS',
  'E-commerce',
  'Healthcare',
  'Real Estate',
  'Agency',
  'Consulting',
  'Other',
]

const TEAM_SIZES = ['Solo', '2-5', '6-20', '21-50', '50+']

const stepVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25 } },
}

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Shared styles ──────────────────────────────────

const s = {
  wrapper: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text)',
  },
  container: {
    width: '100%',
    maxWidth: 480,
    padding: '0 24px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
  },
  logo: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'var(--color-primary)',
    marginBottom: 8,
  },
  stepIndicator: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'var(--color-text-3)',
  },
  title: {
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 32,
    color: 'var(--color-text)',
  },
  label: {
    display: 'block',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'var(--color-text-3)',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#000',
    border: '1px solid var(--border-subtle)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    borderRadius: 0,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    background: '#000',
    border: '1px solid var(--border-subtle)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    borderRadius: 0,
    outline: 'none',
    boxSizing: 'border-box',
    appearance: 'none',
    cursor: 'pointer',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    background: 'var(--color-primary)',
    color: '#000',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: 'uppercase',
    border: 'none',
    cursor: 'pointer',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  error: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--color-danger)',
    marginTop: 8,
  },
  progressBar: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressDot: (active) => ({
    width: 32,
    height: 3,
    background: active ? 'var(--color-primary)' : 'var(--color-border)',
    transition: 'background 0.3s',
  }),
}

// ─── Step 1: Profile Setup ──────────────────────────

function StepProfile({ user, data, setData, onNext }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = data.fullName.trim() && data.company.trim() && data.roleTitle.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await updateRow('profiles', user.id, {
        full_name: data.fullName.trim(),
        company: data.company.trim(),
        role_title: data.roleTitle.trim(),
        phone: data.phone?.trim() || null,
      })
      onNext()
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Motion.form
      key="step-profile"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onSubmit={handleSubmit}
    >
      <h2 style={s.title}>Configura tu perfil</h2>

      <div style={s.fieldGroup}>
        <label style={s.label}>Nombre completo</label>
        <input
          style={s.input}
          type="text"
          value={data.fullName}
          onChange={(e) => setData({ ...data, fullName: e.target.value })}
          placeholder="Roberto Ortega"
          autoFocus
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Empresa</label>
        <input
          style={s.input}
          type="text"
          value={data.company}
          onChange={(e) => setData({ ...data, company: e.target.value })}
          placeholder="Mi Empresa S.L."
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Cargo</label>
        <input
          style={s.input}
          type="text"
          value={data.roleTitle}
          onChange={(e) => setData({ ...data, roleTitle: e.target.value })}
          placeholder="CEO"
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Telefono (opcional)</label>
        <input
          style={s.input}
          type="tel"
          value={data.phone || ''}
          onChange={(e) => setData({ ...data, phone: e.target.value })}
          placeholder="+34 600 000 000"
        />
      </div>

      {error && <div style={s.error}>{error}</div>}

      <button
        type="submit"
        style={{ ...s.button, ...((!canSubmit || loading) ? s.buttonDisabled : {}) }}
        disabled={!canSubmit || loading}
      >
        {loading ? 'GUARDANDO...' : 'CONFIGURAR IDENTIDAD'}
      </button>
    </Motion.form>
  )
}

// ─── Step 2: Workspace Creation ─────────────────────

function StepWorkspace({ user, data, setData, onNext }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = data.orgName.trim() && data.slug.trim() && data.industry && data.teamSize

  function handleOrgNameChange(val) {
    const newSlug = data.slugEdited ? data.slug : slugify(val)
    setData({ ...data, orgName: val, slug: newSlug })
  }

  function handleSlugChange(val) {
    setData({ ...data, slug: slugify(val), slugEdited: true })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const org = await insertRow('organizations', {
        name: data.orgName.trim(),
        slug: data.slug.trim(),
        owner_id: user.id,
        settings: {
          industry: data.industry,
          team_size: data.teamSize,
        },
      })
      if (org?.id) {
        await insertRow('org_members', {
          org_id: org.id,
          user_id: user.id,
          role: 'owner',
        })
        await updateRow('profiles', user.id, {
          default_org_id: org.id,
          onboarding_completed: true,
        })
      }
      onNext()
    } catch (err) {
      setError(err.message || 'Error al crear workspace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Motion.form
      key="step-workspace"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onSubmit={handleSubmit}
    >
      <h2 style={s.title}>Crea tu workspace</h2>

      <div style={s.fieldGroup}>
        <label style={s.label}>Nombre de la organizacion</label>
        <input
          style={s.input}
          type="text"
          value={data.orgName}
          onChange={(e) => handleOrgNameChange(e.target.value)}
          placeholder="Acme Corp"
          autoFocus
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Slug</label>
        <input
          style={s.input}
          type="text"
          value={data.slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          placeholder="acme-corp"
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Industria</label>
        <select
          style={s.select}
          value={data.industry}
          onChange={(e) => setData({ ...data, industry: e.target.value })}
        >
          <option value="" disabled>Selecciona industria</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Equipo</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {TEAM_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setData({ ...data, teamSize: size })}
              style={{
                flex: 1,
                padding: '8px 0',
                background: data.teamSize === size ? 'var(--color-primary)' : '#000',
                color: data.teamSize === size ? '#000' : 'var(--color-text-3)',
                border: `1px solid ${data.teamSize === size ? 'var(--color-primary)' : 'var(--color-border)'}`,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={s.error}>{error}</div>}

      <button
        type="submit"
        style={{ ...s.button, ...((!canSubmit || loading) ? s.buttonDisabled : {}) }}
        disabled={!canSubmit || loading}
      >
        {loading ? 'INICIALIZANDO...' : 'CREAR WORKSPACE'}
      </button>
    </Motion.form>
  )
}

// ─── Step 3: Activation ─────────────────────────────

const checkmarkVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i) => ({
    pathLength: 1,
    opacity: 1,
    transition: { delay: i * 0.3, duration: 0.5, ease: 'easeOut' },
  }),
}

function AnimatedCheckmark({ delay = 0 }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <Motion.path
        d="M5 12l5 5L19 7"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={checkmarkVariants}
        initial="hidden"
        animate="visible"
        custom={delay}
      />
    </svg>
  )
}

function StepActivation({ onComplete }) {
  const [typedText, setTypedText] = useState('')
  const welcomeMsg = 'Bienvenido a OCULOPS. Soy tu Copilot de inteligencia artificial. Estoy listo para gestionar tu pipeline, analizar mercados, y automatizar tu crecimiento. Escribe lo que necesites en el chat.'

  useState(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i < welcomeMsg.length) {
        setTypedText(welcomeMsg.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, 25)
    return () => clearInterval(interval)
  })

  const checks = [
    { label: 'Perfil configurado', delay: 0 },
    { label: 'Workspace creado', delay: 1 },
    { label: 'Agentes IA activados', delay: 2 },
  ]

  return (
    <Motion.div
      key="step-activation"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ textAlign: 'center' }}
    >
      <h2 style={{ ...s.title, marginBottom: 16 }}>Sistema Online</h2>

      <div style={{
        padding: '16px 20px',
        border: '1px solid var(--color-primary)',
        background: 'rgba(255, 212, 0, 0.03)',
        marginBottom: 32,
        textAlign: 'left',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: 'var(--color-primary)',
          marginBottom: 8,
        }}>
          COPILOT
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--color-text-2)',
          lineHeight: 1.6,
          margin: 0,
          minHeight: 60,
        }}>
          {typedText}<span style={{ opacity: typedText.length < welcomeMsg.length ? 1 : 0, animation: 'blink 1s step-end infinite' }}>|</span>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
        {checks.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              border: '1px solid var(--color-border)',
              textAlign: 'left',
            }}
          >
            <AnimatedCheckmark delay={item.delay} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: 1,
              color: 'var(--color-text-2)',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        style={s.button}
        onClick={onComplete}
      >
        ENTRAR A OCULOPS
      </button>
    </Motion.div>
  )
}

// ─── Main Onboarding Component ──────────────────────

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(1)
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
    company: '',
    roleTitle: '',
    phone: '',
  })
  const [workspaceData, setWorkspaceData] = useState({
    orgName: '',
    slug: '',
    slugEdited: false,
    industry: '',
    teamSize: '',
  })

  function handleProfileDone() {
    // Pre-fill org name from company
    if (!workspaceData.orgName && profileData.company) {
      setWorkspaceData((prev) => ({
        ...prev,
        orgName: profileData.company,
        slug: prev.slugEdited ? prev.slug : slugify(profileData.company),
      }))
    }
    setStep(2)
  }

  return (
    <div style={s.wrapper}>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logo}>OCULOPS</div>
          <div style={s.stepIndicator}>Step {step} of 3</div>
        </div>

        {/* Progress bar */}
        <div style={s.progressBar}>
          <div style={s.progressDot(step >= 1)} />
          <div style={s.progressDot(step >= 2)} />
          <div style={s.progressDot(step >= 3)} />
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <StepProfile
              user={user}
              data={profileData}
              setData={setProfileData}
              onNext={handleProfileDone}
            />
          )}
          {step === 2 && (
            <StepWorkspace
              user={user}
              data={workspaceData}
              setData={setWorkspaceData}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepActivation onComplete={onComplete} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
