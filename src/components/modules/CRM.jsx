// ═══════════════════════════════════════════════════
// OCULOPS — CRM v11.0
// Contacts, Companies, Deals, Activities
// ═══════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useContacts } from '../../hooks/useContacts'
import { useCompanies } from '../../hooks/useCompanies'
import { useDeals } from '../../hooks/useDeals'
import { useActivities } from '../../hooks/useActivities'
import { useAtlasCRM } from '../../hooks/useAtlasCRM'
import { useAppStore } from '../../stores/useAppStore'
import { useSheetsSync } from '../../hooks/useGoogleWorkspace'
import { isSupabaseConfigured } from '../../lib/supabase'
import Modal from '../ui/Modal'
import {
    UserGroupIcon,
    BuildingOfficeIcon,
    CurrencyEuroIcon,
    ClockIcon,
    PlusIcon,
    TrashIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    TableCellsIcon,
} from '@heroicons/react/24/outline'
import './CRM.css'

const TABS = [
    { id: 'contacts', label: 'Contacts', icon: UserGroupIcon },
    { id: 'companies', label: 'Companies', icon: BuildingOfficeIcon },
    { id: 'deals', label: 'Deals', icon: CurrencyEuroIcon },
    { id: 'activities', label: 'Activities', icon: ClockIcon },
]

const CONTACT_STATUSES = ['raw', 'contacted', 'qualified', 'nurturing', 'converted', 'lost']
const COMPANY_STATUSES = ['prospected', 'contacted', 'active', 'churned']
const DEAL_STAGES = ['lead', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0)
}

function formatDateTime(value) {
    if (!value) return '—'
    return new Date(value).toLocaleString()
}

// ── Search bar ──
function SearchBar({ value, onChange, placeholder, onAdd }) {
    return (
        <div className="crm-search">
            <div className="crm-search-field">
                <MagnifyingGlassIcon width={16} height={16} />
                <input className="crm-search-input" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAdd}>
                <PlusIcon width={14} height={14} /> New
            </button>
        </div>
    )
}

// ── Contact Modal ──
function ContactModal({ contact, companies, onSave, onDelete, onClose }) {
    const isNew = !contact.id
    const [form, setForm] = useState({
        name: contact.name || '', email: contact.email || '', phone: contact.phone || '',
        company_id: contact.company_id || '', status: contact.status || 'raw',
        position: contact.position || '', notes: contact.notes || '',
    })
    const handleSave = () => { if (form.name.trim()) onSave(form) }

    return (
        <Modal open title={isNew ? 'New contact' : 'Edit contact'} onClose={onClose} size="md" footer={
            <div className="modal-actions">
                <div>{!isNew && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => onDelete(contact.id)}><TrashIcon width={14} height={14} /> Delete</button>}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                </div>
            </div>
        }>
            <div className="form-grid">
                <div className="form-field"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Email</label><input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Position</label><input className="form-input" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} /></div>
                <div className="form-field">
                    <label className="form-label">Company</label>
                    <select className="form-input" value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                        <option value="">None</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="form-field">
                    <label className="form-label">Status</label>
                    <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                </div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" style={{ height: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
            </div>
        </Modal>
    )
}

// ── Company Modal ──
function CompanyModal({ company, onSave, onDelete, onClose }) {
    const isNew = !company.id
    const [form, setForm] = useState({
        name: company.name || '', website: company.website || '', industry: company.industry || '',
        location: company.location || '', status: company.status || 'prospected', notes: company.notes || '',
    })
    const handleSave = () => { if (form.name.trim()) onSave(form) }

    return (
        <Modal open title={isNew ? 'New company' : 'Edit company'} onClose={onClose} size="md" footer={
            <div className="modal-actions">
                <div>{!isNew && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => onDelete(company.id)}><TrashIcon width={14} height={14} /> Delete</button>}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                </div>
            </div>
        }>
            <div className="form-grid">
                <div className="form-field"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Website</label><input className="form-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Industry</label><input className="form-input" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                <div className="form-field">
                    <label className="form-label">Status</label>
                    <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        {COMPANY_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                </div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" style={{ height: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
            </div>
        </Modal>
    )
}

// ── Deal Modal ──
function DealModal({ deal, companies, onSave, onDelete, onClose }) {
    const isNew = !deal.id
    const [form, setForm] = useState({
        title: deal.title || '', company_id: deal.company_id || '', value: deal.value || 0,
        stage: deal.stage || 'lead', probability: deal.probability || 0,
        expected_close_date: deal.expected_close_date || '', notes: deal.notes || '',
    })
    const handleSave = () => { if (form.title.trim()) onSave({ ...form, value: Number(form.value) || 0, probability: Number(form.probability) || 0 }) }

    return (
        <Modal open title={isNew ? 'New deal' : 'Edit deal'} onClose={onClose} size="md" footer={
            <div className="modal-actions">
                <div>{!isNew && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => onDelete(deal.id)}><TrashIcon width={14} height={14} /> Delete</button>}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                </div>
            </div>
        }>
            <div className="form-grid">
                <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="form-field">
                    <label className="form-label">Company</label>
                    <select className="form-input" value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
                        <option value="">None</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="form-field"><label className="form-label">Value ($)</label><input className="form-input" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
                <div className="form-field">
                    <label className="form-label">Stage</label>
                    <select className="form-input" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                        {DEAL_STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                </div>
                <div className="form-field"><label className="form-label">Probability %</label><input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Expected close</label><input className="form-input" type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} /></div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" style={{ height: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
            </div>
        </Modal>
    )
}

function CRM() {
    const [activeTab, setActiveTab] = useState('contacts')
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState(null)
    const toast = useAppStore(s => s.toast)

    const { contacts, loading: contactsLoading, addContact, updateContact, removeContact, reload: reloadContacts } = useContacts()
    const { companies, loading: companiesLoading, addCompany, updateCompany, removeCompany, reload: reloadCompanies } = useCompanies()
    const { deals, loading: dealsLoading, addDeal, updateDeal, removeDeal, reload: reloadDeals } = useDeals()
    const { activities, loading: activitiesLoading, removeActivity, reload: reloadActivities } = useActivities()
    const { importingLeadId, bulkImporting, stagingKey, error: atlasError } = useAtlasCRM()
    const { exportCRM, busy: sheetsBusy } = useSheetsSync()

    const loading = contactsLoading || companiesLoading || dealsLoading || activitiesLoading
    const syncBusy = bulkImporting || Boolean(importingLeadId) || Boolean(stagingKey)

    const handleExportSheets = useCallback(async () => {
        try {
            const result = await exportCRM()
            if (result?.spreadsheetUrl) {
                toast('Exported to Google Sheets', 'success')
                window.open(result.spreadsheetUrl, '_blank', 'noopener,noreferrer')
            }
        } catch (err) {
            toast(err.message || 'Export failed', 'error')
        }
    }, [exportCRM, toast])
    const systemHealthy = isSupabaseConfigured && !atlasError

    const q = search.toLowerCase()
    const filteredContacts = useMemo(() => contacts.filter(c => !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.company?.name || '').toLowerCase().includes(q)), [contacts, q])
    const filteredCompanies = useMemo(() => companies.filter(c => !q || c.name.toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q) || (c.location || '').toLowerCase().includes(q)), [companies, q])
    const filteredDeals = useMemo(() => deals.filter(d => !q || (d.title || '').toLowerCase().includes(q) || (d.company?.name || '').toLowerCase().includes(q) || (d.stage || '').toLowerCase().includes(q)), [deals, q])
    const filteredActivities = useMemo(() => activities.filter(a => !q || (a.subject || a.description || '').toLowerCase().includes(q) || (a.type || '').toLowerCase().includes(q)), [activities, q])

    const handleSyncAtlas = useCallback(async () => {
        await Promise.all([reloadContacts(), reloadCompanies(), reloadDeals(), reloadActivities()])
    }, [reloadContacts, reloadCompanies, reloadDeals, reloadActivities])

    const openNew = useCallback((type) => setModal({ type, data: {} }), [])
    const closeModal = useCallback(() => setModal(null), [])

    const handleContactSave = useCallback(async (form) => {
        if (modal.data.id) { await updateContact(modal.data.id, form); toast('Contact updated', 'success') }
        else { await addContact(form); toast('Contact created', 'success') }
        setModal(null)
    }, [modal, updateContact, addContact, toast])

    const handleContactDelete = useCallback(async (id) => { await removeContact(id); toast('Contact removed', 'success'); setModal(null) }, [removeContact, toast])

    const handleCompanySave = useCallback(async (form) => {
        if (modal.data.id) { await updateCompany(modal.data.id, form); toast('Company updated', 'success') }
        else { await addCompany(form); toast('Company created', 'success') }
        setModal(null)
    }, [modal, updateCompany, addCompany, toast])

    const handleCompanyDelete = useCallback(async (id) => { await removeCompany(id); toast('Company removed', 'success'); setModal(null) }, [removeCompany, toast])

    const handleDealSave = useCallback(async (form) => {
        if (modal.data.id) { await updateDeal(modal.data.id, form); toast('Deal updated', 'success') }
        else { await addDeal(form); toast('Deal created', 'success') }
        setModal(null)
    }, [modal, updateDeal, addDeal, toast])

    const handleDealDelete = useCallback(async (id) => { await removeDeal(id); toast('Deal removed', 'success'); setModal(null) }, [removeDeal, toast])

    useEffect(() => { setSearch('') }, [activeTab])

    const searchPlaceholders = {
        contacts: 'Search by name, email, company...',
        companies: 'Search by name, industry, location...',
        deals: 'Search by title, company, stage...',
        activities: 'Search by subject, type...',
    }

    const tabCounts = { contacts: contacts.length, companies: companies.length, deals: deals.length, activities: activities.length }

    return (
        <div className="module-page crm fade-in">
            {/* Header */}
            <div className="module-page-header">
                <div>
                    <h1 className="module-page-title">CRM</h1>
                    <p className="module-page-subtitle">Contacts, companies, deals, and activity</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div className="crm-status">
                        <div className={`crm-status-dot ${systemHealthy ? 'online' : 'error'}`} />
                        <span>{systemHealthy ? 'Connected' : 'Degraded'}</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={handleSyncAtlas} disabled={syncBusy}>
                        <ArrowPathIcon width={14} height={14} className={syncBusy ? 'spin' : ''} /> {syncBusy ? 'Syncing...' : 'Sync'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={handleExportSheets} disabled={sheetsBusy} title="Export CRM to Google Sheets">
                        <TableCellsIcon width={14} height={14} /> {sheetsBusy ? 'Exporting...' : 'Sheets'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="crm-tabs">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    return (
                        <button key={tab.id} className={`crm-tab${activeTab === tab.id ? ' crm-tab-active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            <Icon width={16} height={16} />
                            <span>{tab.label}</span>
                            <span className="crm-tab-count">{tabCounts[tab.id]}</span>
                        </button>
                    )
                })}
            </div>

            {/* Search */}
            <SearchBar
                value={search}
                onChange={setSearch}
                placeholder={searchPlaceholders[activeTab]}
                onAdd={() => {
                    if (activeTab === 'contacts') openNew('contact')
                    else if (activeTab === 'companies') openNew('company')
                    else if (activeTab === 'deals') openNew('deal')
                }}
            />

            {/* Loading */}
            {loading && <div className="crm-loading">Loading data...</div>}

            {/* Table */}
            <div className="crm-table-wrap">
                <table className="crm-table">
                    {activeTab === 'contacts' && (
                        <>
                            <thead>
                                <tr>
                                    <th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th><th className="crm-col-action"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContacts.map(c => (
                                    <tr key={c.id} onClick={() => setModal({ type: 'contact', data: c })}>
                                        <td className="crm-cell-name">{c.name || '—'}</td>
                                        <td>{c.company?.name || '—'}</td>
                                        <td className="crm-cell-email">{c.email || '—'}</td>
                                        <td>{c.phone || '—'}</td>
                                        <td><span className={`badge badge-${c.status === 'converted' ? 'success' : c.status === 'lost' ? 'danger' : 'default'}`}>{c.status || 'raw'}</span></td>
                                        <td className="crm-col-action"><button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); removeContact(c.id) }}><TrashIcon width={14} height={14} /></button></td>
                                    </tr>
                                ))}
                                {filteredContacts.length === 0 && <tr><td colSpan={6} className="crm-table-empty">No contacts found</td></tr>}
                            </tbody>
                        </>
                    )}

                    {activeTab === 'companies' && (
                        <>
                            <thead>
                                <tr>
                                    <th>Name</th><th>Website</th><th>Industry</th><th>Location</th><th>Status</th><th className="crm-col-action"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCompanies.map(c => (
                                    <tr key={c.id} onClick={() => setModal({ type: 'company', data: c })}>
                                        <td className="crm-cell-name">{c.name}</td>
                                        <td className="crm-cell-email">{c.website || '—'}</td>
                                        <td>{c.industry || '—'}</td>
                                        <td>{c.location || '—'}</td>
                                        <td><span className={`badge badge-${c.status === 'active' ? 'success' : c.status === 'churned' ? 'danger' : 'default'}`}>{c.status || 'prospected'}</span></td>
                                        <td className="crm-col-action"><button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); removeCompany(c.id) }}><TrashIcon width={14} height={14} /></button></td>
                                    </tr>
                                ))}
                                {filteredCompanies.length === 0 && <tr><td colSpan={6} className="crm-table-empty">No companies found</td></tr>}
                            </tbody>
                        </>
                    )}

                    {activeTab === 'deals' && (
                        <>
                            <thead>
                                <tr>
                                    <th>Title</th><th>Company</th><th>Value</th><th>Stage</th><th>Probability</th><th className="crm-col-action"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDeals.map(d => (
                                    <tr key={d.id} onClick={() => setModal({ type: 'deal', data: d })}>
                                        <td className="crm-cell-name">{d.title || 'Untitled'}</td>
                                        <td>{d.company?.name || '—'}</td>
                                        <td className="crm-cell-value">{formatCurrency(d.value)}</td>
                                        <td><span className={`badge badge-${d.stage === 'closed_won' ? 'success' : d.stage === 'closed_lost' ? 'danger' : 'default'}`}>{(d.stage || 'lead').replace('_', ' ')}</span></td>
                                        <td>{d.probability || 0}%</td>
                                        <td className="crm-col-action"><button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); removeDeal(d.id) }}><TrashIcon width={14} height={14} /></button></td>
                                    </tr>
                                ))}
                                {filteredDeals.length === 0 && <tr><td colSpan={6} className="crm-table-empty">No deals found</td></tr>}
                            </tbody>
                        </>
                    )}

                    {activeTab === 'activities' && (
                        <>
                            <thead>
                                <tr>
                                    <th>Type</th><th>Subject</th><th>Linked to</th><th>Created</th><th className="crm-col-action"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredActivities.map(a => (
                                    <tr key={a.id}>
                                        <td><span className="badge badge-primary">{a.type || 'note'}</span></td>
                                        <td className="crm-cell-name">{a.subject || a.description || 'Untitled'}</td>
                                        <td>{a.company?.name || a.contact?.name || a.deal?.title || '—'}</td>
                                        <td className="crm-cell-date">{formatDateTime(a.created_at)}</td>
                                        <td className="crm-col-action"><button className="btn btn-ghost btn-xs" onClick={() => removeActivity(a.id)}><TrashIcon width={14} height={14} /></button></td>
                                    </tr>
                                ))}
                                {filteredActivities.length === 0 && <tr><td colSpan={5} className="crm-table-empty">No activities found</td></tr>}
                            </tbody>
                        </>
                    )}
                </table>
            </div>

            {/* Modals */}
            {modal?.type === 'contact' && <ContactModal contact={modal.data} companies={companies} onSave={handleContactSave} onDelete={handleContactDelete} onClose={closeModal} />}
            {modal?.type === 'company' && <CompanyModal company={modal.data} onSave={handleCompanySave} onDelete={handleCompanyDelete} onClose={closeModal} />}
            {modal?.type === 'deal' && <DealModal deal={modal.data} companies={companies} onSave={handleDealSave} onDelete={handleDealDelete} onClose={closeModal} />}
        </div>
    )
}

export default CRM
