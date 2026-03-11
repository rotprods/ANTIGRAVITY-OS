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
vi.mock('../hooks/usePipelineRuns', () => ({
    usePipelineRuns: () => ({ runs: [], stats: { total: 0, running: 0, completed: 0, failed: 0 }, loading: false }),
    default: () => ({ runs: [], stats: { total: 0, running: 0, completed: 0, failed: 0 }, loading: false }),
}))

import ControlTower from '../components/modules/ControlTower'

describe('ControlTower', () => {
    it('renders the main header', () => {
        render(<ControlTower />)
        expect(screen.getByText('Control Tower')).toBeInTheDocument()
    })

    it('shows Operational status when not loading', () => {
        render(<ControlTower />)
        expect(screen.getByText('Operational')).toBeInTheDocument()
    })

    it('renders KPI labels', () => {
        render(<ControlTower />)
        expect(screen.getByText('Contacts')).toBeInTheDocument()
        expect(screen.getByText('Companies')).toBeInTheDocument()
        expect(screen.getByText('Pipeline')).toBeInTheDocument()
        expect(screen.getByText('Weighted')).toBeInTheDocument()
        expect(screen.getByText('Activities (7d)')).toBeInTheDocument()
        expect(screen.getByText('Active signals')).toBeInTheDocument()
    })

    it('renders pipeline value from totalValue', () => {
        render(<ControlTower />)
        // Rendered as €15,000 (toLocaleString in jsdom may use . or , as thousands sep)
        expect(screen.getByText(/15.?000/)).toBeInTheDocument()
    })

    it('renders agent network nodes', () => {
        render(<ControlTower />)
        // ATLAS appears in agent bar and agent matrix
        expect(screen.getAllByText('ATLAS').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('HUNTER').length).toBeGreaterThanOrEqual(1)
    })

    it('renders agent stats in agent network section', () => {
        render(<ControlTower />)
        // Stats appear as "1 online", "1 running", "0 error"
        expect(screen.getAllByText(/1 online/i).length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(/1 running/i).length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(/0 error/i).length).toBeGreaterThanOrEqual(1)
    })

    it('renders signals in latest signals section', () => {
        render(<ControlTower />)
        expect(screen.getByText('AI Cost Drop')).toBeInTheDocument()
        expect(screen.getByText('TikTok EU')).toBeInTheDocument()
    })

    it('renders agents bar label', () => {
        render(<ControlTower />)
        expect(screen.getByText('Agents')).toBeInTheDocument()
    })

    it('renders system health section', () => {
        render(<ControlTower />)
        expect(screen.getByText('System health')).toBeInTheDocument()
    })

    it('renders health score number', () => {
        render(<ControlTower />)
        // healthScore = round((min(15000/500,100)*0.5) + ((1/2)*100*0.3) + (min(2*10,100)*0.2))
        // = round(30*0.5 + 50*0.3 + 20*0.2) = round(15 + 15 + 4) = 34
        expect(screen.getByText('34')).toBeInTheDocument()
    })

    it('renders latest signals section header', () => {
        render(<ControlTower />)
        expect(screen.getByText('Latest signals')).toBeInTheDocument()
    })

    it('renders agent network section header', () => {
        render(<ControlTower />)
        expect(screen.getByText('Agent network')).toBeInTheDocument()
    })
})
