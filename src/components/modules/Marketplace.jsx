// ═══════════════════════════════════════════════════
// OCULOPS — Agent Marketplace
// Browse, activate, and run vault agents
// ═══════════════════════════════════════════════════

import { useState, useMemo } from 'react'
import { useAgentVault } from '../../hooks/useAgentVault'
import {
  N8N_AIRDROP_INTEL,
  N8N_EXPERT_PACKS,
  N8N_SUGGESTED_COMBOS,
  N8N_TOP_WORKFLOW_CATEGORIES,
} from '../../data/n8nAirdropIntel'

const SEVERITY_COLOR = { critical: 'var(--color-danger)', warning: 'var(--color-warning)', info: 'var(--color-info)' }

function AgentCard({ agent, onToggle, onRun, running }) {
  const isRunning = running === agent.code_name
  const tags = (agent.tags || []).slice(0, 3)

  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: `1px solid ${agent.is_active ? 'var(--border-active)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      transition: 'border-color var(--transition-fast)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-wide)' }}>
            {agent.display_name || agent.code_name}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {agent.code_name}
          </div>
        </div>
        <span style={{
          fontSize: 'var(--text-2xs)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--accent-primary-muted)',
          color: 'var(--accent-primary)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 'var(--weight-semibold)',
          whiteSpace: 'nowrap',
        }}>
          {(agent.namespace || 'unknown').toUpperCase()}
        </span>
      </div>

      {/* Description */}
      {agent.description && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
          {agent.description.slice(0, 80)}{agent.description.length > 80 ? '...' : ''}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <span key={tag} style={{
              fontSize: 'var(--text-2xs)',
              padding: '1px 5px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--border-subtle)',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: toggle + run */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', alignItems: 'center' }}>
        <button
          onClick={() => onToggle(agent.id, agent.is_active)}
          style={{
            fontSize: 'var(--text-xs)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-xs)',
            border: `1px solid ${agent.is_active ? 'var(--color-success)' : 'var(--border-default)'}`,
            background: agent.is_active ? 'var(--color-success-muted)' : 'transparent',
            color: agent.is_active ? 'var(--color-success)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'all var(--transition-fast)',
          }}
        >
          {agent.is_active ? 'ACTIVE' : 'INACTIVE'}
        </button>
        <button
          onClick={() => onRun(agent)}
          disabled={isRunning}
          style={{
            flex: 1,
            fontSize: 'var(--text-xs)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--accent-primary)',
            background: isRunning ? 'var(--accent-primary-muted)' : 'transparent',
            color: 'var(--accent-primary)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'all var(--transition-fast)',
          }}
        >
          {isRunning ? '[ RUNNING... ]' : '▶ RUN'}
        </button>
      </div>

      {/* Stats */}
      {(agent.total_runs > 0 || agent.last_run_at) && (
        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>
          {agent.total_runs || 0} runs{agent.last_run_at ? ` · last ${new Date(agent.last_run_at).toLocaleDateString()}` : ''}
        </div>
      )}
    </div>
  )
}

function RunModal({ agent, onClose, onSubmit, loading, result }) {
  const [goal, setGoal] = useState('')

  const handleSubmit = () => {
    if (!goal.trim()) return
    onSubmit(agent.code_name, goal)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 'var(--z-modal)', padding: 'var(--space-4)',
    }}>
      <div style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: 560,
        padding: 'var(--space-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
              RUN // {agent.display_name || agent.code_name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', marginTop: 2 }}>
              {agent.namespace?.toUpperCase()}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-2)' }}>
            MISSION DIRECTIVE
          </label>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Describe the goal for this agent..."
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface-inset)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-3)',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {result && (
          <div style={{
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: result.error ? 'var(--color-danger)' : 'var(--text-secondary)',
            maxHeight: 160,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}>
            {result.error
              ? `ERROR: ${result.error}`
              : typeof result.output === 'string'
                ? result.output.slice(0, 800)
                : JSON.stringify(result, null, 2).slice(0, 800)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn">ABORT</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !goal.trim()}
            className="btn btn-primary"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {loading ? '[ EXECUTING... ]' : '[ COMMIT ]'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Marketplace() {
  const {
    agents, allAgents, namespaces, loading, error,
    filters, setNamespace, setSearch, toggleActive,
    runAgent, runningAgent, totalAgents, activeCount,
  } = useAgentVault()

  const [selectedAgent, setSelectedAgent] = useState(null)
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [copiedSkill, setCopiedSkill] = useState('')

  const namespaceCounts = useMemo(() => {
    const counts = {}
    allAgents.forEach(a => { counts[a.namespace] = (counts[a.namespace] || 0) + 1 })
    return counts
  }, [allAgents])

  const handleRun = (agent) => {
    setSelectedAgent(agent)
    setRunResult(null)
  }

  const handleRunSubmit = async (codeName, goal) => {
    setRunning(true)
    const result = await runAgent(codeName, goal)
    setRunResult(result)
    setRunning(false)
  }

  const copySkillInvoke = async (invoke) => {
    const prompt = `Use ${invoke} to`
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedSkill(invoke)
      window.setTimeout(() => setCopiedSkill(''), 1400)
    } catch {
      // Clipboard availability differs per browser context.
      setCopiedSkill('')
    }
  }

  return (
    <div className="fade-in" style={{ padding: 'var(--space-6)', height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', margin: 0 }}>
            AGENT MARKETPLACE
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            VAULT BROWSER // AGENT ACTIVATION & DEPLOYMENT TERMINAL
          </p>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {[
            { label: 'TOTAL', value: totalAgents },
            { label: 'ACTIVE', value: activeCount, color: 'var(--color-success)' },
            { label: 'NS', value: namespaces.length, color: 'var(--accent-primary)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2) var(--space-3)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: stat.color || 'var(--text-primary)' }}>
                {loading ? '–' : stat.value}
              </div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search agents by name, namespace or capability..."
        value={filters.search}
        onChange={e => setSearch(e.target.value)}
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
          padding: 'var(--space-3) var(--space-4)',
          outline: 'none',
          width: '100%', boxSizing: 'border-box',
        }}
      />

      {/* n8n Airdrop Intel */}
      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
              N8N AIRDROP INTEL
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              MAP DATE {N8N_AIRDROP_INTEL.generatedAt}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {[
              { label: 'EXPERT PACKS', value: N8N_AIRDROP_INTEL.stats.expertPacks },
              { label: 'UNIQUE FLOWS', value: N8N_AIRDROP_INTEL.stats.uniqueWorkflows },
              { label: 'JSON TOTAL', value: N8N_AIRDROP_INTEL.stats.workflowJsons },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  minWidth: 94,
                  textAlign: 'center',
                  background: 'var(--surface-raised)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--accent-primary)' }}>
                  {stat.value}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr)', gap: 'var(--space-3)' }}>
          <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', background: 'var(--surface-raised)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-quaternary)', marginBottom: 'var(--space-2)' }}>
              7 EXPERT SKILL PACKS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {N8N_EXPERT_PACKS.map((pack) => (
                <button
                  key={pack.invoke}
                  onClick={() => copySkillInvoke(pack.invoke)}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: copiedSkill === pack.invoke ? 'var(--accent-primary-muted)' : 'transparent',
                    borderRadius: 'var(--radius-xs)',
                    padding: '6px 8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>{pack.invoke}</div>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{pack.teaches}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', background: 'var(--surface-raised)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-quaternary)', marginBottom: 'var(--space-2)' }}>
              TOP WORKFLOW CATEGORIES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {N8N_TOP_WORKFLOW_CATEGORIES.slice(0, 6).map((item) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', minWidth: 74 }}>{item.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>{item.count}</span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{item.bestUse}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', background: 'var(--surface-raised)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-quaternary)', marginBottom: 'var(--space-2)' }}>
              RECOMMENDED COMBOS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {N8N_SUGGESTED_COMBOS.map((combo) => (
                <div key={combo.task} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', padding: '6px 8px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>{combo.task}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)', marginTop: 3 }}>
                    {combo.skills.join(' + ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={{ flex: 1, display: 'flex', gap: 'var(--space-4)', minHeight: 0 }}>

        {/* Namespace filter rail */}
        <div style={{
          width: 180, flexShrink: 0,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
          overflowY: 'auto',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--text-quaternary)', padding: '4px var(--space-2)', letterSpacing: 'var(--tracking-wider)' }}>
            NAMESPACE
          </div>
          {['all', ...namespaces].map(ns => (
            <button
              key={ns}
              onClick={() => setNamespace(ns)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px var(--space-2)',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                background: filters.namespace === ns ? 'var(--accent-primary-muted)' : 'transparent',
                color: filters.namespace === ns ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                textAlign: 'left',
                transition: 'all var(--transition-fast)',
                borderLeft: filters.namespace === ns ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              <span>{ns === 'all' ? 'ALL' : ns}</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-quaternary)' }}>
                {ns === 'all' ? totalAgents : (namespaceCounts[ns] || 0)}
              </span>
            </button>
          ))}
        </div>

        {/* Agent grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', padding: 'var(--space-4)' }}>
              ERR: {error}
            </div>
          )}
          {loading ? (
            <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', padding: 'var(--space-8)', textAlign: 'center' }}>
              LOADING VAULT...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', padding: 'var(--space-8)', textAlign: 'center' }}>
              NO AGENTS MATCH FILTER
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onToggle={toggleActive}
                  onRun={handleRun}
                  running={runningAgent}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Run Modal */}
      {selectedAgent && (
        <RunModal
          agent={selectedAgent}
          onClose={() => { setSelectedAgent(null); setRunResult(null) }}
          onSubmit={handleRunSubmit}
          loading={running}
          result={runResult}
        />
      )}
    </div>
  )
}
