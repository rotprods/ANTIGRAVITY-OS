import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

import ControlTower from '../components/modules/ControlTower'

describe('ControlTower', () => {
    it('renders the main header', () => {
        render(<ControlTower />)
        expect(screen.getByText('SYSTEM INTELLIGENCE PANEL')).toBeInTheDocument()
    })

    it('shows OPERATIONAL status when not loading', () => {
        render(<ControlTower />)
        expect(screen.getByText('OPERATIONAL')).toBeInTheDocument()
    })

    it('renders KPI labels', () => {
        render(<ControlTower />)
        expect(screen.getByText('CONTACTS')).toBeInTheDocument()
        expect(screen.getByText('COMPANIES')).toBeInTheDocument()
        expect(screen.getByText('PIPELINE VALUATION')).toBeInTheDocument()
        expect(screen.getByText('WEIGHTED PIPELINE')).toBeInTheDocument()
        expect(screen.getByText('ACTIVITIES (7D)')).toBeInTheDocument()
        expect(screen.getByText('SIGNAL INTERCEPTS')).toBeInTheDocument()
    })

    it('renders pipeline valuation from totalValue', () => {
        render(<ControlTower />)
        // jsdom toLocaleString may or may not add commas
        expect(screen.getByText(/15.?000/)).toBeInTheDocument()
    })

    it('renders agent network nodes', () => {
        render(<ControlTower />)
        // ATLAS appears in both cortex network bar and health matrix
        expect(screen.getAllByText('ATLAS').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('HUNTER').length).toBeGreaterThanOrEqual(1)
    })

    it('renders agent stats in health matrix header', () => {
        render(<ControlTower />)
        expect(screen.getByText('1 ONLINE')).toBeInTheDocument()
        expect(screen.getByText('1 RUNNING')).toBeInTheDocument()
        expect(screen.getByText('0 ERROR')).toBeInTheDocument()
    })

    it('renders critical signals', () => {
        render(<ControlTower />)
        expect(screen.getByText('AI COST DROP')).toBeInTheDocument()
        expect(screen.getByText('TIKTOK EU')).toBeInTheDocument()
    })

    it('renders cortex network label', () => {
        render(<ControlTower />)
        expect(screen.getByText('CORTEX NETWORK:')).toBeInTheDocument()
    })

    it('renders health telemetry section', () => {
        render(<ControlTower />)
        expect(screen.getByText('/// HEALTH TELEMETRY')).toBeInTheDocument()
        expect(screen.getByText('AGGREGATE HEALTH SCORE')).toBeInTheDocument()
    })

    it('renders health score number', () => {
        render(<ControlTower />)
        // healthScore = round((min(15000/500,100)*0.5) + ((1/2)*100*0.3) + (min(2*10,100)*0.2))
        // = round(30*0.5 + 50*0.3 + 20*0.2) = round(15 + 15 + 4) = 34
        expect(screen.getByText('34')).toBeInTheDocument()
    })
})
