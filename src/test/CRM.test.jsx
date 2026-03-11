import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockContacts, mockCompanies, mockDeals, mockActivities } = vi.hoisted(() => ({
    mockContacts: [
        { id: 'c1-abcd-1234', name: 'Alice Smith', email: 'alice@test.com', phone: '+34600', status: 'qualified', company: { name: 'Acme Corp' } },
        { id: 'c2-efgh-5678', name: 'Bob Jones', email: 'bob@test.com', phone: '+34601', status: 'raw', company: null },
    ],
    mockCompanies: [
        { id: 'co1-abcd-1234', name: 'Acme Corp', website: 'acme.com', industry: 'Tech', location: 'Madrid', status: 'active' },
    ],
    mockDeals: [
        { id: 'dl1-abcd-1234', title: 'Project Alpha', value: 5000, stage: 'lead', probability: 30, company: { name: 'Acme Corp' } },
    ],
    mockActivities: [
        { id: 'ac1-abcd-1234', type: 'call', subject: 'Follow up call', created_at: '2026-01-01T10:00:00Z' },
    ],
}))

vi.mock('../hooks/useContacts', () => ({
    useContacts: () => ({
        contacts: mockContacts, loading: false,
        addContact: vi.fn(), updateContact: vi.fn(), removeContact: vi.fn(), reload: vi.fn(),
    }),
}))
vi.mock('../hooks/useCompanies', () => ({
    useCompanies: () => ({
        companies: mockCompanies, loading: false,
        addCompany: vi.fn(), updateCompany: vi.fn(), removeCompany: vi.fn(), reload: vi.fn(),
    }),
}))
vi.mock('../hooks/useDeals', () => ({
    useDeals: () => ({
        deals: mockDeals, loading: false,
        addDeal: vi.fn(), updateDeal: vi.fn(), removeDeal: vi.fn(), reload: vi.fn(),
    }),
}))
vi.mock('../hooks/useActivities', () => ({
    useActivities: () => ({
        activities: mockActivities, loading: false,
        removeActivity: vi.fn(), reload: vi.fn(),
    }),
}))
vi.mock('../hooks/useAtlasCRM', () => ({
    useAtlasCRM: () => ({
        importingLeadId: null, bulkImporting: false, stagingKey: null, error: null,
    }),
}))
vi.mock('../lib/supabase', () => ({
    isSupabaseConfigured: true,
}))
vi.mock('../stores/useAppStore', () => ({
    useAppStore: (selector) => {
        const state = { toast: vi.fn() }
        return selector(state)
    },
}))

import CRM from '../components/modules/CRM'

describe('CRM', () => {
    it('renders the CRM header', () => {
        render(<CRM />)
        expect(screen.getByText('CRM')).toBeInTheDocument()
    })

    it('renders all tab buttons', () => {
        render(<CRM />)
        expect(screen.getByText('Contacts')).toBeInTheDocument()
        expect(screen.getByText('Companies')).toBeInTheDocument()
        expect(screen.getByText('Deals')).toBeInTheDocument()
        expect(screen.getByText('Activities')).toBeInTheDocument()
    })

    it('shows contacts count tab badge', () => {
        render(<CRM />)
        // The tab count badges show the number of records
        const countBadges = screen.getAllByText('2')
        expect(countBadges.length).toBeGreaterThanOrEqual(1)
    })

    it('renders contact names in table', () => {
        render(<CRM />)
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    })

    it('renders contact company name', () => {
        render(<CRM />)
        expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    it('shows contact statuses', () => {
        render(<CRM />)
        expect(screen.getByText('qualified')).toBeInTheDocument()
        expect(screen.getByText('raw')).toBeInTheDocument()
    })

    it('switches to companies tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('Companies'))
        // Company name should now be visible in the table
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1)
    })

    it('switches to deals tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('Deals'))
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    })

    it('switches to activities tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('Activities'))
        expect(screen.getByText('Follow up call')).toBeInTheDocument()
    })

    it('renders system status as Connected', () => {
        render(<CRM />)
        expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('renders Sync button', () => {
        render(<CRM />)
        expect(screen.getByText(/\bSync\b/)).toBeInTheDocument()
    })

    it('renders New button', () => {
        render(<CRM />)
        expect(screen.getByText(/\bNew\b/)).toBeInTheDocument()
    })

    it('has a search input for contacts', () => {
        render(<CRM />)
        expect(screen.getByPlaceholderText('Search by name, email, company...')).toBeInTheDocument()
    })

    it('search placeholder changes when switching to companies tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('Companies'))
        expect(screen.getByPlaceholderText('Search by name, industry, location...')).toBeInTheDocument()
    })
})
