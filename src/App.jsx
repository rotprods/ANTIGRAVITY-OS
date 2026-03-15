import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useOrg } from './hooks/useOrg'
import Sidebar from './components/Sidebar'
import OnboardingSetup from './components/OnboardingSetup'
import Auth from './components/Auth'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { SentryErrorBoundary } from './components/ui/SentryErrorBoundary'
import ModuleSkeleton, { RouteAwareSkeleton } from './components/ui/ModuleSkeleton'
import { Toaster } from 'react-hot-toast'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import CopilotPanel from './components/ui/CopilotPanel'
import { AgentVaultProvider } from './contexts/AgentVaultContext'
import { isSupabaseConfigured } from './lib/supabase'

// Lightweight ambient background
function AmbientBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(255,215,0,0.02) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(255,215,0,0.01) 0%, transparent 50%)',
    }} />
  )
}

// ─── Module guard ─────────────────────────────────────────────────────────────
const guard = (component) => (
  <ErrorBoundary>
    {React.createElement(component)}
  </ErrorBoundary>
)

// ─── Lazy Load — ALL modules ──────────────────────────────────────────────────
const ControlTower   = lazy(() => import('./components/modules/ControlTower'))
const Pipeline       = lazy(() => import('./components/modules/Pipeline'))
const CRM            = lazy(() => import('./components/modules/CRM'))
const Intelligence   = lazy(() => import('./components/modules/Intelligence'))
const Execution      = lazy(() => import('./components/modules/Execution'))
const Finance        = lazy(() => import('./components/modules/Finance'))
const Agents         = lazy(() => import('./components/modules/Agents'))
const Knowledge      = lazy(() => import('./components/modules/Knowledge'))
const Watchtower     = lazy(() => import('./components/modules/Watchtower'))
const Lab            = lazy(() => import('./components/modules/Lab'))
const TeamSettings   = lazy(() => import('./components/modules/TeamSettings'))
const ProspectorHub  = lazy(() => import('./components/modules/ProspectorHub'))
const HeraldAgent    = lazy(() => import('./components/modules/HeraldAgent'))
const GTM            = lazy(() => import('./components/modules/GTM'))
const StudyHub       = lazy(() => import('./components/modules/StudyHub'))
const WorldMonitor   = lazy(() => import('./components/modules/WorldMonitor'))
const Messaging      = lazy(() => import('./components/modules/Messaging'))
const Automation     = lazy(() => import('./components/modules/Automation'))
const Experiments    = lazy(() => import('./components/modules/Experiments'))
const Opportunities  = lazy(() => import('./components/modules/Opportunities'))
const Decisions      = lazy(() => import('./components/modules/Decisions'))
const Niches         = lazy(() => import('./components/modules/Niches'))
const Portfolio      = lazy(() => import('./components/modules/Portfolio'))
const Simulation     = lazy(() => import('./components/modules/Simulation'))
const Settings       = lazy(() => import('./components/modules/Settings'))
const CreativeStudio = lazy(() => import('./components/modules/CreativeStudio'))
const Reports        = lazy(() => import('./components/modules/Reports'))
const Billing        = lazy(() => import('./components/modules/Billing'))
const Analytics      = lazy(() => import('./components/modules/Analytics'))
const Markets        = lazy(() => import('./components/modules/Markets'))
const FlightDeck     = lazy(() => import('./components/modules/FlightDeck'))
const CommandCenter  = lazy(() => import('./components/modules/CommandCenter'))
const PixelOffice    = lazy(() => import('./components/modules/PixelOffice'))
const Marketplace    = lazy(() => import('./components/modules/Marketplace'))

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingOS() {
  return (
    <div style={{
      height: '100vh', width: '100vw', background: 'var(--surface-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', position: 'relative', zIndex: 2,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid var(--border-default)', borderTopColor: 'var(--accent-primary)',
        animation: 'spin 1s linear infinite', marginBottom: 16,
      }} />
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>
        Initializing Oculops...
      </div>
    </div>
  )
}

// ─── Inner app ────────────────────────────────────────────────────────────────
function AppContent() {
  const { session, loading: authLoading } = useAuth()
  const { currentOrg, loading: orgLoading } = useOrg()
  const [copilotOpen, setCopilotOpen] = useState(false)
  const isOfflineDevMode = import.meta.env.DEV && !isSupabaseConfigured

  // Track if user explicitly completed/skipped onboarding this session.
  // Use a ref so it doesn't cause re-renders, and localStorage so it survives
  // brief unmounts during auth state transitions.
  const [onboardingDone, setOnboardingDoneState] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('oculops_onboarding_done') === '1'
  )

  const markOnboardingDone = useCallback(() => {
    localStorage.setItem('oculops_onboarding_done', '1')
    setOnboardingDoneState(true)
  }, [])

  // Clear onboarding flag on sign-out so new users see it again
  useEffect(() => {
    if (!session) {
      localStorage.removeItem('oculops_onboarding_done')
      setOnboardingDoneState(false)
    }
  }, [session])

  // Cmd+K / Ctrl+K to toggle Copilot
  const handleGlobalKey = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCopilotOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [handleGlobalKey])

  // ── Gate logic ──────────────────────────────────────────────────────────────
  // Show loading while auth resolves or while org is loading for logged-in users.
  // Cap org loading wait to avoid infinite spinner if Supabase is slow.
  const isLoading = authLoading || (session && orgLoading)

  // User needs onboarding if: logged in, org resolved, no org found, and hasn't
  // completed/skipped onboarding yet in this browser.
  const needsOnboarding = session && !orgLoading && !currentOrg && !onboardingDone

  const content = (() => {
    if (isLoading)       return <LoadingOS />
    if (!session && !isOfflineDevMode) return <Auth />
    if (needsOnboarding && !isOfflineDevMode) return <OnboardingSetup onComplete={markOnboardingDone} />
    return null
  })()

  if (content) {
    return (
      <>
        <AmbientBackground />
        {content}
      </>
    )
  }

  // ── Main app ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: '100vh', background: 'var(--surface-base)',
      color: 'var(--text-primary)', overflow: 'hidden', fontFamily: 'var(--font-sans)',
      position: 'relative',
    }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: 'var(--accent-primary)', secondary: 'var(--surface-base)' } },
        }}
      />

      <Sidebar />

      {/* Copilot Floating Button */}
      <button
        onClick={() => setCopilotOpen(true)}
        title="Open Copilot (⌘K)"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 900,
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--accent-primary)', border: 'none',
          color: '#000', fontSize: 20, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 4px 20px rgba(255,215,0,0.3)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(255,215,0,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,215,0,0.3)' }}
      >
        ⚡
      </button>

      <CopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      <VercelAnalytics />
      <SpeedInsights />

      <AgentVaultProvider>
      <main style={{
        flex: 1, marginLeft: 240, height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2,
      }}>
        {isOfflineDevMode && (
          <div className="mono text-xs" style={{
            padding: '8px 14px',
            borderBottom: '1px solid var(--border-default)',
            background: 'rgba(255, 215, 0, 0.08)',
            color: 'var(--accent-primary)',
          }}>
            OFFLINE DEV MODE ACTIVE · Supabase auth bypassed for local runtime testing
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Suspense fallback={<RouteAwareSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/control-tower" replace />} />

              {/* Core */}
              <Route path="/control-tower"  element={guard(ControlTower)} />
              <Route path="/pipeline"       element={guard(Pipeline)} />
              <Route path="/crm"            element={guard(CRM)} />
              <Route path="/intelligence"   element={guard(Intelligence)} />
              <Route path="/execution"      element={guard(Execution)} />
              <Route path="/finance"        element={guard(Finance)} />

              {/* Intelligence */}
              <Route path="/markets"        element={guard(Markets)} />
              <Route path="/analytics"      element={guard(Analytics)} />
              <Route path="/opportunities"  element={guard(Opportunities)} />
              <Route path="/reports"        element={guard(Reports)} />

              {/* Agents */}
              <Route path="/agents"         element={guard(Agents)} />
              <Route path="/herald"         element={guard(HeraldAgent)} />
              <Route path="/prospector"     element={guard(ProspectorHub)} />
              <Route path="/automation"     element={guard(Automation)} />
              <Route path="/flight-deck"    element={guard(FlightDeck)} />
              <Route path="/marketplace"    element={guard(Marketplace)} />
              <Route path="/pixel-office"   element={guard(PixelOffice)} />

              {/* Growth */}
              <Route path="/gtm"            element={guard(GTM)} />
              <Route path="/messaging"      element={guard(Messaging)} />
              <Route path="/creative"       element={guard(CreativeStudio)} />
              <Route path="/niches"         element={guard(Niches)} />

              {/* Ops */}
              <Route path="/knowledge"      element={guard(Knowledge)} />
              <Route path="/decisions"      element={guard(Decisions)} />
              <Route path="/experiments"    element={guard(Experiments)} />
              <Route path="/simulation"     element={guard(Simulation)} />
              <Route path="/studies"        element={guard(StudyHub)} />

              {/* System */}
              <Route path="/command-center" element={guard(CommandCenter)} />
              <Route path="/watchtower"     element={guard(Watchtower)} />
              <Route path="/world-monitor"  element={guard(WorldMonitor)} />
              <Route path="/portfolio"      element={guard(Portfolio)} />
              <Route path="/lab"            element={guard(Lab)} />
              <Route path="/billing"        element={guard(Billing)} />
              <Route path="/team-settings"  element={guard(TeamSettings)} />
              <Route path="/settings"       element={guard(Settings)} />

              <Route path="*" element={
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)',
                }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500 }}>Module not found</div>
                </div>
              } />
            </Routes>
          </Suspense>
        </div>
      </main>
      </AgentVaultProvider>
    </div>
  )
}

export default function App() {
  return (
    <SentryErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </SentryErrorBoundary>
  )
}
