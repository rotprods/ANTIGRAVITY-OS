import React, { memo, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import OrgSelector from './OrgSelector'
import UserMenu from './UserMenu'
import ActivityFeed from './ui/ActivityFeed'
import './Sidebar.css'
import {
  BoltIcon,
  RectangleStackIcon,
  UserGroupIcon,
  CheckCircleIcon,
  BanknotesIcon,
  GlobeAltIcon,
  ChartBarIcon,
  PresentationChartLineIcon,
  FlagIcon,
  DocumentChartBarIcon,
  CpuChipIcon,
  MegaphoneIcon,
  MagnifyingGlassIcon,
  CogIcon,
  PaperAirplaneIcon,
  RocketLaunchIcon,
  ChatBubbleLeftRightIcon,
  PaintBrushIcon,
  MapIcon,
  LightBulbIcon,
  ScaleIcon,
  BeakerIcon,
  CubeIcon,
  BookOpenIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  GlobeEuropeAfricaIcon,
  BriefcaseIcon,
  WrenchScrewdriverIcon,
  CreditCardIcon,
  UsersIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { path: '/control-tower', label: 'Control Tower', icon: BoltIcon },
      { path: '/pipeline',      label: 'Pipeline',      icon: RectangleStackIcon },
      { path: '/crm',           label: 'CRM / Network', icon: UserGroupIcon },
      { path: '/execution',     label: 'Execution',     icon: CheckCircleIcon },
      { path: '/finance',       label: 'Finance',       icon: BanknotesIcon },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { path: '/intelligence',  label: 'Intelligence',  icon: GlobeAltIcon },
      { path: '/markets',       label: 'Markets',       icon: ChartBarIcon },
      { path: '/analytics',     label: 'Analytics',     icon: PresentationChartLineIcon },
      { path: '/opportunities', label: 'Opportunities', icon: FlagIcon },
      { path: '/reports',       label: 'Reports',       icon: DocumentChartBarIcon },
    ],
  },
  {
    label: 'Agents',
    items: [
      { path: '/agents',        label: 'AI Agents',     icon: CpuChipIcon },
      { path: '/herald',        label: 'Herald',        icon: MegaphoneIcon },
      { path: '/prospector',    label: 'Prospector',    icon: MagnifyingGlassIcon },
      { path: '/automation',    label: 'Automation',    icon: CogIcon },
      { path: '/flight-deck',   label: 'Flight Deck',   icon: PaperAirplaneIcon },
    ],
  },
  {
    label: 'Growth',
    items: [
      { path: '/gtm',           label: 'GTM',           icon: RocketLaunchIcon },
      { path: '/messaging',     label: 'Messaging',     icon: ChatBubbleLeftRightIcon },
      { path: '/creative',      label: 'Creative',      icon: PaintBrushIcon },
      { path: '/niches',        label: 'Niches',        icon: MapIcon },
    ],
  },
  {
    label: 'Ops',
    items: [
      { path: '/knowledge',     label: 'Knowledge',     icon: LightBulbIcon },
      { path: '/decisions',     label: 'Decisions',     icon: ScaleIcon },
      { path: '/experiments',   label: 'Experiments',   icon: BeakerIcon },
      { path: '/simulation',    label: 'Simulation',    icon: CubeIcon },
      { path: '/studies',       label: 'Study Hub',     icon: BookOpenIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/command-center', label: 'Command Center', icon: CommandLineIcon },
      { path: '/watchtower',    label: 'Watchtower',    icon: ShieldCheckIcon },
      { path: '/world-monitor', label: 'World Monitor', icon: GlobeEuropeAfricaIcon },
      { path: '/portfolio',     label: 'Portfolio',     icon: BriefcaseIcon },
      { path: '/lab',           label: 'Laboratory',    icon: WrenchScrewdriverIcon },
      { path: '/billing',       label: 'Billing',       icon: CreditCardIcon },
      { path: '/team-settings', label: 'Team Settings', icon: UsersIcon },
      { path: '/settings',      label: 'Settings',      icon: Cog6ToothIcon },
    ],
  },
]

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentOrg } = useOrg()
  const [credits, setCredits] = useState(null)

  useEffect(() => {
    if (!currentOrg?.id) return
    let isMounted = true
    
    // Initial fetch
    supabase.from('credit_balances')
      .select('available_credits')
      .eq('org_id', currentOrg.id)
      .single()
      .then(({ data }) => {
        if (isMounted && data) setCredits(data.available_credits)
      })

    // Realtime subscription
    const sub = supabase.channel(`credits-${currentOrg.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'credit_balances', filter: `org_id=eq.${currentOrg.id}` }, 
        (payload) => {
          if (isMounted) setCredits(payload.new.available_credits)
        })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(sub)
    }
  }, [currentOrg?.id])

  return (
    <aside className="os-sidebar">

      {/* Header */}
      <div className="os-sidebar-header">
        <div className="os-sidebar-brand">
          <div className="os-sidebar-logo" />
          <h1 className="os-sidebar-title">
            OCULOPS <span className="os-sidebar-version">v2</span>
          </h1>
        </div>
        <OrgSelector />
      </div>

      {/* Navigation */}
      <nav className="os-sidebar-nav">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="os-sidebar-group">
            <div className="os-sidebar-group-label">
              {group.label}
            </div>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`os-sidebar-item${isActive ? ' active' : ''}`}
                >
                  <Icon className="os-sidebar-item-icon" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Live Activity Feed */}
      <div className="os-sidebar-feed">
        <ActivityFeed collapsed maxItems={15} />
      </div>

      {/* Credit Balance */}
      {credits !== null && (
        <div 
          onClick={() => navigate('/settings')} 
          style={{ padding: 'var(--space-2) var(--space-4)', margin: '0 var(--space-2) var(--space-2)', borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s ease' }}
          className="sidebar-credit-pill hover-glow-gold"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <BanknotesIcon style={{ width: 14, height: 14, color: 'var(--color-warning)' }} />
            <span className="mono text-xs text-secondary">Credits</span>
          </div>
          <span className="mono text-xs font-bold" style={{ color: credits > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {credits.toFixed(2)}
          </span>
        </div>
      )}

      {/* User Menu */}
      <div className="os-sidebar-footer">
        <UserMenu />
      </div>
    </aside>
  )
}

export default memo(Sidebar)
