import React, { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useOrg } from './hooks/useOrg'
import Sidebar from './components/Sidebar'
import OnboardingSetup from './components/OnboardingSetup'
import Auth from './components/Auth'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { Toaster } from 'react-hot-toast'

// Full ParticleField (with data hooks) — only loaded when authenticated
const ParticleField = lazy(() => import('./components/ui/ParticleField'))

// Lightweight ambient background — no data hooks, no Supabase queries
function AmbientBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse at 50% 50%, rgba(255,212,0,0.03) 0%, transparent 70%)',
    }} />
  )
}

// ─── Module guard — wraps each route element in an ErrorBoundary ─────────────
const guard = (Component) => (
  <ErrorBoundary>
    <Component />
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

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingOS() {
  return (
    <div style={{
      height: '100vh', width: '100vw', background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', position: 'relative', zIndex: 2,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)',
        animation: 'spin 1s linear infinite', marginBottom: 16,
      }} />
      <div style={{
        fontSize: 11, letterSpacing: '0.2em', color: 'var(--color-primary)', opacity: 0.8,
      }}>INITIALIZING OCULOPS v2...</div>
    </div>
  )
}

// ─── Inner app (needs Router context) ────────────────────────────────────────
function AppContent() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { currentOrg, loading: orgLoading } = useOrg()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const content = (() => {
    if (authLoading || (session && orgLoading)) return <LoadingOS />
    if (!session)    return <Auth />
    if (!currentOrg) return <OnboardingSetup />
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

  return (
    <div style={{
      display: 'flex', height: '100vh', background: 'var(--color-bg)',
      color: 'var(--color-text)', overflow: 'hidden', fontFamily: 'var(--font-sans)',
      position: 'relative',
    }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
          },
          success: { iconTheme: { primary: 'var(--color-primary)', secondary: '#000' } },
        }}
      />

      <Suspense fallback={<AmbientBackground />}>
        <ParticleField />
      </Suspense>

      <Sidebar />

      <main style={{
        flex: 1, marginLeft: 220, height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2,
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Suspense fallback={
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--color-text-3)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
            }}>
              LOADING MODULE...
            </div>
          }>
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
                  justifyContent: 'center', height: '100%', color: 'var(--color-text-3)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>MODULE NOT FOUND</div>
                </div>
              } />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}
