import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import OrgSelector from './OrgSelector'
import UserMenu from './UserMenu'

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { path: '/control-tower', label: 'Control Tower', icon: '⚡' },
      { path: '/pipeline',      label: 'Pipeline',      icon: '🏗' },
      { path: '/crm',           label: 'CRM / Network', icon: '👥' },
      { path: '/execution',     label: 'Execution',     icon: '✅' },
      { path: '/finance',       label: 'Finance',       icon: '💰' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { path: '/intelligence',  label: 'Intelligence',  icon: '🌐' },
      { path: '/markets',       label: 'Markets',       icon: '📈' },
      { path: '/analytics',     label: 'Analytics',     icon: '📊' },
      { path: '/opportunities', label: 'Opportunities', icon: '🎯' },
      { path: '/reports',       label: 'Reports',       icon: '📋' },
    ],
  },
  {
    label: 'Agents',
    items: [
      { path: '/agents',        label: 'AI Agents',     icon: '🤖' },
      { path: '/herald',        label: 'Herald',        icon: '📰' },
      { path: '/prospector',    label: 'Prospector',    icon: '🔍' },
      { path: '/automation',    label: 'Automation',    icon: '⚙️' },
      { path: '/flight-deck',   label: 'Flight Deck',   icon: '🛩' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { path: '/gtm',           label: 'GTM',           icon: '🚀' },
      { path: '/messaging',     label: 'Messaging',     icon: '💬' },
      { path: '/creative',      label: 'Creative',      icon: '🎨' },
      { path: '/niches',        label: 'Niches',        icon: '🗺' },
    ],
  },
  {
    label: 'Ops',
    items: [
      { path: '/knowledge',     label: 'Knowledge',     icon: '🧠' },
      { path: '/decisions',     label: 'Decisions',     icon: '⚖️' },
      { path: '/experiments',   label: 'Experiments',   icon: '🧪' },
      { path: '/simulation',    label: 'Simulation',    icon: '🎲' },
      { path: '/studies',       label: 'Study Hub',     icon: '📚' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/command-center', label: 'Command Center', icon: '🖥' },
      { path: '/watchtower',    label: 'Watchtower',    icon: '🛡' },
      { path: '/world-monitor', label: 'World Monitor', icon: '🌍' },
      { path: '/portfolio',     label: 'Portfolio',     icon: '💼' },
      { path: '/lab',           label: 'Laboratory',    icon: '⚗️' },
      { path: '/billing',       label: 'Billing',       icon: '💳' },
      { path: '/team-settings', label: 'Team Settings', icon: '👥' },
      { path: '/settings',      label: 'Settings',      icon: '🔧' },
    ],
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside style={{
      width: 220,
      background: 'var(--color-bg-2)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 30,
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--color-primary)',
            boxShadow: '0 0 8px var(--color-primary)',
            flexShrink: 0,
          }} />
          <h1 style={{
            fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
            color: 'var(--color-text)', margin: 0,
            fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
          }}>
            OCULOPS{' '}
            <span style={{ color: 'var(--color-text-3)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 400 }}>v2</span>
          </h1>
        </div>
        <OrgSelector />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            <div style={{
              padding: '8px 14px 3px',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 14px',
                    background: isActive ? 'rgba(255,212,0,0.05)' : 'none',
                    border: 'none',
                    borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-3)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'color 0.15s',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User Menu */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        <UserMenu />
      </div>
    </aside>
  )
}
