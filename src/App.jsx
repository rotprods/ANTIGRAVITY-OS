import React, { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useOrg } from './hooks/useOrg'
import Sidebar from './components/Sidebar'
import OnboardingSetup from './components/OnboardingSetup'
import Auth from './components/Auth'
import ParticleField from './components/ui/ParticleField'
import { Toaster } from 'react-hot-toast'

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
    <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center font-mono">
      <div className="animate-spin h-10 w-10 border-4 border-[#1a1a1a] border-t-[#FFD400] rounded-full mb-4" />
      <div className="text-xs tracking-[0.2em] text-[#FFD400] animate-pulse">INITIALIZING OCULOPS v2...</div>
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

  if (authLoading || (session && orgLoading)) return <><ParticleField /><LoadingOS /></>
  if (!session)    return <><ParticleField /><Auth /></>
  if (!currentOrg) return <><ParticleField /><OnboardingSetup /></>

  return (
    <div className="flex h-screen bg-[#000000] text-white overflow-hidden" style={{ fontFamily: 'var(--font-sans)' }}>
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

      <ParticleField />

      <Sidebar />

      <main className="flex-1 ml-[220px] h-full overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-[#6b7280] font-mono text-xs">
              LOADING MODULE...
            </div>
          }>
            <Routes>
              <Route path="/" element={<Navigate to="/control-tower" replace />} />

              {/* Core */}
              <Route path="/control-tower"  element={<ControlTower />} />
              <Route path="/pipeline"       element={<Pipeline />} />
              <Route path="/crm"            element={<CRM />} />
              <Route path="/intelligence"   element={<Intelligence />} />
              <Route path="/execution"      element={<Execution />} />
              <Route path="/finance"        element={<Finance />} />

              {/* Intelligence */}
              <Route path="/markets"        element={<Markets />} />
              <Route path="/analytics"      element={<Analytics />} />
              <Route path="/opportunities"  element={<Opportunities />} />
              <Route path="/reports"        element={<Reports />} />

              {/* Agents */}
              <Route path="/agents"         element={<Agents />} />
              <Route path="/herald"         element={<HeraldAgent />} />
              <Route path="/prospector"     element={<ProspectorHub />} />
              <Route path="/automation"     element={<Automation />} />
              <Route path="/flight-deck"    element={<FlightDeck />} />

              {/* Growth */}
              <Route path="/gtm"            element={<GTM />} />
              <Route path="/messaging"      element={<Messaging />} />
              <Route path="/creative"       element={<CreativeStudio />} />
              <Route path="/niches"         element={<Niches />} />

              {/* Ops */}
              <Route path="/knowledge"      element={<Knowledge />} />
              <Route path="/decisions"      element={<Decisions />} />
              <Route path="/experiments"    element={<Experiments />} />
              <Route path="/simulation"     element={<Simulation />} />
              <Route path="/studies"        element={<StudyHub />} />

              {/* System */}
              <Route path="/command-center" element={<CommandCenter />} />
              <Route path="/watchtower"     element={<Watchtower />} />
              <Route path="/world-monitor"  element={<WorldMonitor />} />
              <Route path="/portfolio"      element={<Portfolio />} />
              <Route path="/lab"            element={<Lab />} />
              <Route path="/billing"        element={<Billing />} />
              <Route path="/team-settings"  element={<TeamSettings />} />
              <Route path="/settings"       element={<Settings />} />

              <Route path="*" element={
                <div className="flex flex-col items-center justify-center h-full text-[#6b7280]">
                  <div className="font-mono text-xs">MODULE NOT FOUND</div>
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
