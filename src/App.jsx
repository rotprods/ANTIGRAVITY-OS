// ═══════════════════════════════════════════════════
// ANTIGRAVITY OS v10 — Root App Component
// ═══════════════════════════════════════════════════

import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import Auth from './components/Auth'
import { NotificationCenter } from './components/ui/NotificationCenter'

// DEV MODE: skip auth gate but keep Supabase data connection
// Default false — must be explicitly set to 'true' in .env to activate
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

console.log('🚀 [ANTIGRAVITY] Booting OS...', { devMode: DEV_MODE })

// ─── Lazy-loaded modules — each becomes a separate chunk ───────────────────

// CORE
const ControlTower = lazy(() => import('./components/modules/ControlTower'))
const CRM = lazy(() => import('./components/modules/CRM'))
const Pipeline = lazy(() => import('./components/modules/Pipeline'))
const Execution = lazy(() => import('./components/modules/Execution'))

// INTELLIGENCE
const Intelligence = lazy(() => import('./components/modules/Intelligence'))
const Markets = lazy(() => import('./components/modules/Markets'))
const ProspectorHub = lazy(() => import('./components/modules/ProspectorHub'))
const Watchtower = lazy(() => import('./components/modules/Watchtower'))
const Niches = lazy(() => import('./components/modules/Niches'))
const Opportunities = lazy(() => import('./components/modules/Opportunities'))

// AUTOMATION
const Agents = lazy(() => import('./components/modules/Agents'))
const Automation = lazy(() => import('./components/modules/Automation'))
const Messaging = lazy(() => import('./components/modules/Messaging'))

// ANALYTICS
const Finance = lazy(() => import('./components/modules/Finance'))
const Experiments = lazy(() => import('./components/modules/Experiments'))
const Decisions = lazy(() => import('./components/modules/Decisions'))

// KNOWLEDGE
const Knowledge = lazy(() => import('./components/modules/Knowledge'))
const StudyHub = lazy(() => import('./components/modules/StudyHub'))
const HeraldAgent = lazy(() => import('./components/modules/HeraldAgent'))

// WORLD
const WorldMonitor = lazy(() => import('./components/modules/WorldMonitor'))
const GTM = lazy(() => import('./components/modules/GTM'))
const Portfolio = lazy(() => import('./components/modules/Portfolio'))
const Simulation = lazy(() => import('./components/modules/Simulation'))
const MiniAppLauncher = lazy(() => import('./components/miniapps/MiniAppLauncher'))

// SETTINGS & OPERATIONS
const Settings = lazy(() => import('./components/modules/Settings'))
const Reports = lazy(() => import('./components/modules/Reports'))
const CreativeStudio = lazy(() => import('./components/modules/CreativeStudio'))
const Analytics = lazy(() => import('./components/modules/Analytics'))
const Billing = lazy(() => import('./components/modules/Billing'))

// ─── Module Fallback ────────────────────────────────────────────────────────

function ModuleFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-2)', fontSize: '13px', gap: '8px' }}>
      <span style={{ fontSize: '1.2rem' }}>⚡</span> Loading...
    </div>
  )
}

// ─── Module Registry ────────────────────────────────────────────────────────
// Order within each group determines sidebar order

const modules = [
  // CORE — war room + revenue operations
  { id: 'control-tower', label: 'Control Tower', icon: '⚡', component: ControlTower, group: 'CORE' },
  { id: 'crm', label: 'CRM', icon: '👥', component: CRM, group: 'CORE' },
  { id: 'pipeline', label: 'Pipeline', icon: '💎', component: Pipeline, group: 'CORE' },
  { id: 'execution', label: 'Execution', icon: '🚀', component: Execution, group: 'CORE' },

  // INTELLIGENCE — signals + prospecting + market
  { id: 'intelligence', label: 'Intelligence', icon: '🧠', component: Intelligence, group: 'INTELLIGENCE' },
  { id: 'markets', label: 'Markets', icon: '📈', component: Markets, group: 'INTELLIGENCE' },
  { id: 'prospector', label: 'Prospector', icon: '🔭', component: ProspectorHub, group: 'INTELLIGENCE' },
  { id: 'watchtower', label: 'Watchtower', icon: '🗼', component: Watchtower, group: 'INTELLIGENCE' },
  { id: 'niches', label: 'Niches', icon: '🧬', component: Niches, group: 'INTELLIGENCE' },
  { id: 'opportunities', label: 'Scanner', icon: '📡', component: Opportunities, group: 'INTELLIGENCE' },

  // AUTOMATION — agents + workflows + comms
  { id: 'agents', label: 'AI Agents', icon: '🤖', component: Agents, group: 'AUTOMATION' },
  { id: 'automation', label: 'Automation', icon: '⚙️', component: Automation, group: 'AUTOMATION' },
  { id: 'messaging', label: 'Messaging', icon: '💬', component: Messaging, group: 'AUTOMATION' },

  // ANALYTICS — finance + experiments + decisions
  { id: 'finance', label: 'Finance', icon: '💰', component: Finance, group: 'ANALYTICS' },
  { id: 'experiments', label: 'Lab', icon: '🧪', component: Experiments, group: 'ANALYTICS' },
  { id: 'decisions', label: 'Decisions', icon: '⚖️', component: Decisions, group: 'ANALYTICS' },

  // KNOWLEDGE — docs + learning + content
  { id: 'knowledge', label: 'Knowledge', icon: '📚', component: Knowledge, group: 'KNOWLEDGE' },
  { id: 'study-hub', label: 'Study Hub', icon: '📖', component: StudyHub, group: 'KNOWLEDGE' },
  { id: 'herald', label: 'HERALD', icon: '📱', component: HeraldAgent, group: 'KNOWLEDGE' },

  // WORLD — macro signals + gtm + portfolio + simulation
  { id: 'world-monitor', label: 'World Monitor', icon: '🌍', component: WorldMonitor, group: 'WORLD' },
  { id: 'gtm', label: 'GTM Machine', icon: '🎯', component: GTM, group: 'WORLD' },
  { id: 'portfolio', label: 'Portfolio', icon: '🎰', component: Portfolio, group: 'WORLD' },
  { id: 'simulation', label: 'Simulation', icon: '🎲', component: Simulation, group: 'WORLD' },
  { id: 'api-network', label: 'API Network', icon: '🕸️', component: MiniAppLauncher, group: 'WORLD' },

  // OPERATIONS — settings, reports, studio, analytics, billing
  { id: 'settings', label: 'Configuracion', icon: '⚙', component: Settings, group: 'OPERATIONS' },
  { id: 'reports', label: 'Reportes', icon: '📊', component: Reports, group: 'OPERATIONS' },
  { id: 'creative-studio', label: 'Creative Studio', icon: '🎨', component: CreativeStudio, group: 'OPERATIONS' },
  { id: 'analytics', label: 'Analytics', icon: '📉', component: Analytics, group: 'OPERATIONS' },
  { id: 'billing', label: 'Facturacion', icon: '🧾', component: Billing, group: 'OPERATIONS' },
]

// ─── AppRoutes ───────────────────────────────────────────────────────────────

function AppRoutes({ user, profile }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <Layout
      modules={modules}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      user={user}
      profile={profile}
    >
      <Suspense fallback={<ModuleFallback />}>
        <Routes>
          {modules.map(mod => (
            <Route
              key={mod.id}
              path={`/${mod.id}`}
              element={<mod.component />}
            />
          ))}
          <Route path="/" element={<Navigate to="/control-tower" replace />} />
          <Route path="*" element={<Navigate to="/control-tower" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

// ─── Root App ────────────────────────────────────────────────────────────────

function App() {
  const { session, user, profile, loading } = useAuth()

  // Diagnostic log
  console.log('🛡️ [Auth] State update:', { loading, hasSession: !!session, user: user?.email })

  return (
    <ErrorBoundary>
      <Suspense fallback={<ModuleFallback />}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--color-bg)',
            color: 'var(--color-primary)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '1rem',
            gap: '1rem',
            letterSpacing: '-0.01em',
          }}>
            <span style={{ fontSize: '2rem', animation: 'spin 2s linear infinite' }}>⚡</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>INITIALIZING</span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-3)', letterSpacing: '2px' }}>ANTIGRAVITY OS v10.3</span>
            </div>
          </div>
        ) : DEV_MODE ? (
          <BrowserRouter>
            <NotificationCenter />
            <AppRoutes
              user={{ email: 'dev@antigravity.os', id: 'dev' }}
              profile={{ full_name: 'Roberto Ortega' }}
            />
          </BrowserRouter>
        ) : !session ? (
          <Auth />
        ) : (
          <BrowserRouter>
            <NotificationCenter />
            <AppRoutes user={user} profile={profile} />
          </BrowserRouter>
        )}
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
