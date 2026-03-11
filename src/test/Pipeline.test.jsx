import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockDeals } = vi.hoisted(() => ({
    mockDeals: [
        { id: 'd1', title: 'Alpha Project', value: '5000', probability: 30, stage: 'lead', company: 'Acme', contact_person: 'Smith' },
        { id: 'd2', title: 'Beta Project', value: '10000', probability: 60, stage: 'proposal', company: 'Wayne Corp' },
        { id: 'd3', title: 'Gamma Project', value: '3000', probability: 40, stage: 'lead' },
    ],
}))

vi.mock('../hooks/useDeals', () => ({
    useDeals: () => ({
        deals: mockDeals,
        loading: false,
        addDeal: vi.fn(),
        updateDeal: vi.fn(),
        removeDeal: vi.fn(),
        pipelineView: {
            lead: mockDeals.filter(d => d.stage === 'lead'),
            proposal: mockDeals.filter(d => d.stage === 'proposal'),
        },
        totalValue: 18000,
        weightedValue: 8700,
    }),
}))

vi.mock('../stores/usePipelineStore', () => ({
    usePipelineStore: (selector) => {
        const state = {
            showClosedLost: false,
            toggleClosedLost: vi.fn(),
            selectedDeal: null,
            setSelectedDeal: vi.fn(),
        }
        return selector(state)
    },
}))

vi.mock('../stores/useAppStore', () => ({
    useAppStore: (selector) => {
        const state = { toast: vi.fn() }
        return selector(state)
    },
}))

vi.mock('../lib/charts', () => ({
    Charts: {
        funnel: () => '<div>FUNNEL</div>',
    },
}))

// Mock @dnd-kit so DealCard/KanbanColumn render without DnD context issues
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }) => <div>{children}</div>,
    DragOverlay: ({ children }) => <div>{children}</div>,
    PointerSensor: class {},
    useSensor: () => ({}),
    useSensors: () => [],
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
    useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null }),
}))

vi.mock('@dnd-kit/utilities', () => ({
    CSS: { Translate: { toString: () => null } },
}))

import Pipeline from '../components/modules/Pipeline'

describe('Pipeline', () => {
    it('renders the pipeline header', () => {
        render(<Pipeline />)
        expect(screen.getByText('PIPELINE ORCHESTRATION')).toBeInTheDocument()
    })

    it('shows deal count in subtitle', () => {
        render(<Pipeline />)
        expect(screen.getByText(/ACTIVE NODES: 3/)).toBeInTheDocument()
    })

    it('renders KPI card labels', () => {
        render(<Pipeline />)
        expect(screen.getByText('[ GLOBAL ENTITIES ]')).toBeInTheDocument()
        expect(screen.getByText('[ PIPELINE VOLUME ]')).toBeInTheDocument()
        expect(screen.getByText('[ WEIGHTED INDEX ]')).toBeInTheDocument()
    })

    it('renders pipeline volume value', () => {
        render(<Pipeline />)
        // Value appears in subtitle + KPI card; jsdom locale may use . or , as separator
        const matches = screen.getAllByText(/EUR 18.?000/)
        expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    it('renders kanban columns for visible stages', () => {
        render(<Pipeline />)
        expect(screen.getByText(/^LEAD/)).toBeInTheDocument()
        expect(screen.getByText(/^CONTACTED/)).toBeInTheDocument()
        expect(screen.getByText(/^MEETING/)).toBeInTheDocument()
        expect(screen.getByText(/^PROPOSAL/)).toBeInTheDocument()
        expect(screen.getByText(/^CLOSED WON/)).toBeInTheDocument()
    })

    it('renders deal cards with titles', () => {
        render(<Pipeline />)
        // CSS textTransform: uppercase — DOM text stays as-is
        expect(screen.getByText('Alpha Project')).toBeInTheDocument()
        expect(screen.getByText('Beta Project')).toBeInTheDocument()
        expect(screen.getByText('Gamma Project')).toBeInTheDocument()
    })

    it('shows deal values on cards', () => {
        render(<Pipeline />)
        // Multiple elements may match (subtitle + KPI + card)
        expect(screen.getAllByText(/EUR 5.?000/).length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(/EUR 10.?000/).length).toBeGreaterThanOrEqual(1)
    })

    it('renders INTEL CAPTURE button', () => {
        render(<Pipeline />)
        expect(screen.getByText('[ INTEL CAPTURE ]')).toBeInTheDocument()
    })

    it('toggles new deal form when INTEL CAPTURE is clicked', () => {
        render(<Pipeline />)
        fireEvent.click(screen.getByText('[ INTEL CAPTURE ]'))
        expect(screen.getByText('/// NEW DEAL DIRECTIVE')).toBeInTheDocument()
    })

    it('renders SHOW LOST toggle button', () => {
        render(<Pipeline />)
        expect(screen.getByText('[ SHOW LOST ]')).toBeInTheDocument()
    })

    it('renders kanban matrix header', () => {
        render(<Pipeline />)
        expect(screen.getByText('/// KANBAN MATRIX')).toBeInTheDocument()
    })

    it('renders conversion flow section', () => {
        render(<Pipeline />)
        expect(screen.getByText('/// CONVERSION FLOW')).toBeInTheDocument()
    })

    it('shows PURGE buttons on deal cards', () => {
        render(<Pipeline />)
        const purgeButtons = screen.getAllByText('[ PURGE ]')
        expect(purgeButtons.length).toBe(3)
    })
})
