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
            contacted: [],
            meeting: [],
            closed_won: [],
            closed_lost: [],
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
        expect(screen.getByText('Pipeline')).toBeInTheDocument()
    })

    it('shows deal count in subtitle', () => {
        render(<Pipeline />)
        expect(screen.getByText(/3 deals/)).toBeInTheDocument()
    })

    it('renders KPI card labels', () => {
        render(<Pipeline />)
        expect(screen.getByText('Total deals')).toBeInTheDocument()
        expect(screen.getByText('Pipeline value')).toBeInTheDocument()
        expect(screen.getByText('Weighted value')).toBeInTheDocument()
    })

    it('renders pipeline volume value', () => {
        render(<Pipeline />)
        // Value appears as €18,000 (jsdom locale may use . or , as thousands sep)
        const matches = screen.getAllByText(/€18.?000/)
        expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    it('renders kanban columns for visible stages', () => {
        render(<Pipeline />)
        expect(screen.getByText('Lead')).toBeInTheDocument()
        expect(screen.getByText('Contacted')).toBeInTheDocument()
        expect(screen.getByText('Meeting')).toBeInTheDocument()
        expect(screen.getByText('Proposal')).toBeInTheDocument()
        expect(screen.getByText('Closed won')).toBeInTheDocument()
    })

    it('renders deal cards with titles', () => {
        render(<Pipeline />)
        expect(screen.getByText('Alpha Project')).toBeInTheDocument()
        expect(screen.getByText('Beta Project')).toBeInTheDocument()
        expect(screen.getByText('Gamma Project')).toBeInTheDocument()
    })

    it('shows deal values on cards', () => {
        render(<Pipeline />)
        // Values rendered as €5,000 and €10,000
        expect(screen.getAllByText(/€5.?000/).length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText(/€10.?000/).length).toBeGreaterThanOrEqual(1)
    })

    it('renders New deal button', () => {
        render(<Pipeline />)
        expect(screen.getByText(/New deal/)).toBeInTheDocument()
    })

    it('toggles new deal form when New deal is clicked', () => {
        render(<Pipeline />)
        fireEvent.click(screen.getByText(/New deal/))
        // The quick-add form has a submit button "Create deal"
        expect(screen.getByText('Create deal')).toBeInTheDocument()
    })

    it('renders Show lost toggle button', () => {
        render(<Pipeline />)
        expect(screen.getByText(/Show lost/)).toBeInTheDocument()
    })

    it('renders kanban board section header', () => {
        render(<Pipeline />)
        expect(screen.getByText('Kanban board')).toBeInTheDocument()
    })

    it('renders conversion funnel section', () => {
        render(<Pipeline />)
        expect(screen.getByText('Conversion funnel')).toBeInTheDocument()
    })

    it('shows Delete buttons on deal cards', () => {
        render(<Pipeline />)
        const deleteButtons = screen.getAllByText(/Delete/)
        expect(deleteButtons.length).toBe(3)
    })
})
