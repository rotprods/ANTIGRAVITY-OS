import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockContacts, mockCompanies, mockDeals, mockActivities, mockSignals, mockAgents, mockAgentStats } = vi.hoisted(() => ({
    mockContacts: [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
    ],
    mockCompanies: [
        { id: 'c1', name: 'Acme Corp' },
    ],
    mockDeals: [
        { id: 'd1', title: 'Deal Alpha', value: '5000', probability: 30, stage: 'lead' },
        { id: 'd2', title: 'Deal Beta', value: '10000', probability: 60, stage: 'proposal' },
    ],
    mockActivities: [
        { id: 'a1', type: 'call', subject: 'Follow up', created_at: new Date().toISOString() },
    ],
    mockSignals: [
        { id: 's1', title: 'AI Cost Drop', category: 'tech', indicator: 'downward', impact: 80, status: 'active' },
        { id: 's2', title: 'TikTok EU', category: 'market', indicator: 'upward', impact: 60, status: 'active' },
    ],
    mockAgents: [
        { id: 'ag1', name: 'Atlas', code_name: 'ATLAS', status: 'online', role: 'Prospecting', total_runs: 42 },
        { id: 'ag2', name: 'Hunter', code_name: 'HUNTER', status: 'running', role: 'Lead capture', total_runs: 18 },
    ],
    mockAgentStats: { total: 2, online: 1, running: 1, error: 0 },
}))

vi.mock('../hooks/useContacts', () => ({
    useContacts: () => ({ contacts: mockContacts, loading: false }),
}))
vi.mock('../hooks/useCompanies', () => ({
    useCompanies: () => ({ companies: mockCompanies, loading: false }),
}))
vi.mock('../hooks/useDeals', () => ({
    useDeals: () => ({
        deals: mockDeals, loading: false, totalValue: 15000, weightedValue: 7500,
    }),
}))
vi.mock('../hooks/useActivities', () => ({
    useActivities: () => ({ activities: mockActivities, loading: false }),
}))
vi.mock('../hooks/useSignals', () => ({
    useSignals: () => ({
        signals: mockSignals,
        activeSignals: mockSignals.filter(s => s.status === 'active'),
        loading: false,
    }),
}))
vi.mock('../hooks/useAgents', () => ({
    default: () => ({ agents: mockAgents, stats: mockAgentStats }),
}))
vi.mock('../hooks/usePipelineRuns', () => ({
    usePipelineRuns: () => ({ runs: [], stats: { total: 0, running: 0, completed: 0, failed: 0 }, loading: false }),
    default: () => ({ runs: [], stats: { total: 0, running: 0, completed: 0, failed: 0 }, loading: false }),
}))
vi.mock('../hooks/useEcosystemReadiness', () => ({
    useEcosystemReadiness: () => ({
        readiness: {
            generated_at: new Date().toISOString(),
            records: [
                {
                    module_key: 'variable_control_plane_v2',
                    state: 'simulated',
                    state_reason_text: 'Synthetic validation active.',
                },
            ],
        },
        loading: false,
        refresh: vi.fn(),
        runTrace: null,
        getRunTrace: vi.fn(),
        clearRunTrace: vi.fn(),
    }),
}))

import ControlTower from '../components/modules/ControlTower'

function renderControlTower(initialPath = '/control-tower') {
    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <ControlTower />
        </MemoryRouter>
    )
}

describe('ControlTower', () => {
    it('renders the main header', () => {
        renderControlTower()
        expect(screen.getByText('ANTIGRAVITY OS')).toBeInTheDocument()
        expect(screen.getByText('Higgsfield Edition')).toBeInTheDocument()
    })

    it('shows advisor section with live status badge', () => {
        renderControlTower()
        expect(screen.getByText('Strategy Advisor & Gates')).toBeInTheDocument()
        expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('renders KPI labels', () => {
        renderControlTower()
        expect(screen.getByText('Health Score')).toBeInTheDocument()
        expect(screen.getByText('Pipeline Value')).toBeInTheDocument()
        expect(screen.getByText('Active Agents')).toBeInTheDocument()
        expect(screen.getByText('Action Center')).toBeInTheDocument()
    })

    it('renders pipeline value summary', () => {
        renderControlTower()
        expect(screen.getByText('€15.0k')).toBeInTheDocument()
    })

    it('renders signals in latest signals section', () => {
        renderControlTower()
        expect(screen.getByText('AI Cost Drop')).toBeInTheDocument()
        expect(screen.getByText('TikTok EU')).toBeInTheDocument()
    })

    it('renders intel feed section', () => {
        renderControlTower()
        expect(screen.getByText('Intel Feed')).toBeInTheDocument()
    })

    it('renders readiness panel with variable status', () => {
        renderControlTower()
        expect(screen.getByText('Readiness State')).toBeInTheDocument()
        expect(screen.getByText('V2 Variables:')).toBeInTheDocument()
        expect(screen.getByText('simulated')).toBeInTheDocument()
    })

    it('renders health score number', () => {
        renderControlTower()
        // healthScore = round((min(15000/500,100)*0.5) + ((1/2)*100*0.3) + (min(2*10,100)*0.2))
        // = round(30*0.5 + 50*0.3 + 20*0.2) = round(15 + 15 + 4) = 34
        expect(screen.getByText('34%')).toBeInTheDocument()
    })
})
