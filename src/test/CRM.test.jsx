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
        expect(screen.getByText('CORTEX CRM VAULT')).toBeInTheDocument()
    })

    it('renders all tab buttons', () => {
        render(<CRM />)
        expect(screen.getByText('01. PERSONNEL')).toBeInTheDocument()
        expect(screen.getByText('02. COMPANIES')).toBeInTheDocument()
        expect(screen.getByText('03. DEAL FLOW')).toBeInTheDocument()
        expect(screen.getByText('04. ACTIVITY LOG')).toBeInTheDocument()
    })

    it('shows contacts table by default with count', () => {
        render(<CRM />)
        expect(screen.getByText(/IDENTIFIED PERSONNEL \[2\]/)).toBeInTheDocument()
    })

    it('renders contact names in table', () => {
        render(<CRM />)
        expect(screen.getByText('ALICE SMITH')).toBeInTheDocument()
        expect(screen.getByText('BOB JONES')).toBeInTheDocument()
    })

    it('renders contact company name', () => {
        render(<CRM />)
        expect(screen.getByText('ACME CORP')).toBeInTheDocument()
    })

    it('shows contact statuses', () => {
        render(<CRM />)
        expect(screen.getByText('QUALIFIED')).toBeInTheDocument()
        expect(screen.getByText('RAW')).toBeInTheDocument()
    })

    it('switches to companies tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('02. COMPANIES'))
        expect(screen.getByText(/CORPORATE ENTITIES \[1\]/)).toBeInTheDocument()
    })

    it('switches to deals tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('03. DEAL FLOW'))
        expect(screen.getByText(/ONGOING OPERATIONS \[1\]/)).toBeInTheDocument()
        expect(screen.getByText('PROJECT ALPHA')).toBeInTheDocument()
    })

    it('switches to activities tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('04. ACTIVITY LOG'))
        expect(screen.getByText(/ACTIVITY LOG ENTRY \[1\]/)).toBeInTheDocument()
        expect(screen.getByText('FOLLOW UP CALL')).toBeInTheDocument()
    })

    it('renders system status as SECURE', () => {
        render(<CRM />)
        expect(screen.getByText(/SECURE/)).toBeInTheDocument()
    })

    it('renders ATLAS DB as CONNECTED', () => {
        render(<CRM />)
        expect(screen.getByText(/CONNECTED/)).toBeInTheDocument()
    })

    it('renders + NEW button', () => {
        render(<CRM />)
        expect(screen.getByText('+ NEW')).toBeInTheDocument()
    })

    it('renders FORCE DB SYNC button', () => {
        render(<CRM />)
        expect(screen.getByText('FORCE DB SYNC')).toBeInTheDocument()
    })

    it('has a search input for contacts', () => {
        render(<CRM />)
        expect(screen.getByPlaceholderText('SEARCH PERSONNEL BY NAME, EMAIL, COMPANY...')).toBeInTheDocument()
    })

    it('search placeholder changes when switching to companies tab', () => {
        render(<CRM />)
        fireEvent.click(screen.getByText('02. COMPANIES'))
        expect(screen.getByPlaceholderText('SEARCH ENTITIES BY NAME, INDUSTRY, LOCATION...')).toBeInTheDocument()
    })
})
