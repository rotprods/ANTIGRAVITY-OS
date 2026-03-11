// ═══════════════════════════════════════════════════
// OCULOPS — VaultAgentPanel
// Shared vault agent list component used across 8+ modules
// ═══════════════════════════════════════════════════

import { useMemo } from 'react'
import { useAgentVaultContext } from '../../contexts/AgentVaultContext'

const DEFAULT_COLOR_MAP = {
    data: 'var(--color-info)',
    research: 'var(--color-info)',
    product: 'var(--color-warning)',
    orchestration: 'var(--color-warning)',
    'ml-ai': 'var(--color-primary)',
    'api-design': 'var(--color-primary)',
}

/**
 * @param {Object} props
 * @param {string} props.title - Section title (e.g. "EXPERIMENT INTELLIGENCE")
 * @param {string[]} props.namespaces - Namespace filter (e.g. ['data', 'research'])
 * @param {number} [props.maxAgents=10] - Max agents to display
 * @param {Object} [props.colorMap] - Namespace to CSS color map override
 * @param {number} [props.capSlice=3] - Number of capabilities to show
 */
export default function VaultAgentPanel({ title, namespaces, maxAgents = 10, colorMap, capSlice = 3 }) {
    const { agents: allVaultAgents } = useAgentVaultContext()
    const colors = colorMap || DEFAULT_COLOR_MAP

    const filtered = useMemo(() =>
        allVaultAgents
            .filter(a => namespaces.includes(a.namespace))
            .slice(0, maxAgents),
        [allVaultAgents, namespaces, maxAgents]
    )

    if (filtered.length === 0) return null

    return (
        <div style={{ border: '1px solid var(--color-border)', background: '#000', display: 'flex', flexDirection: 'column' }}>
            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
                /// {title} — VAULT AGENTS [{filtered.length}]
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filtered.map((va, idx) => (
                    <div key={va.name} className="mono text-xs" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-2)' }}>
                        <div style={{ width: 6, height: 6, background: colors[va.namespace] || 'var(--color-primary)' }} />
                        <span style={{ width: '200px', fontWeight: 'bold', color: 'var(--color-text)' }}>{va.name.toUpperCase()}</span>
                        <span style={{ fontSize: '9px', padding: '1px 5px', border: '1px solid var(--border-subtle)', color: 'var(--color-text-3)' }}>{va.namespace.toUpperCase()}</span>
                        <span style={{ flex: 1, color: 'var(--text-tertiary)', fontSize: '9px' }}>{(va.capabilities || []).slice(0, capSlice).join(' / ').toUpperCase()}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
