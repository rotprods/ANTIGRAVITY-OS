// ═══════════════════════════════════════════════════
// OCULOPS — Messaging v11.0
// Unified inbox — Gmail, WhatsApp, social drafts
// ═══════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { useConversations } from '../../hooks/useConversations'
import { useMessagingChannels } from '../../hooks/useMessagingChannels'
import { useCompanies } from '../../hooks/useCompanies'
import { useAppStore } from '../../stores/useAppStore'
import { buildLaunchUrl, getChannelLabel } from '../../lib/outreach'
import { EnvelopeIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import ModulePage from '../ui/ModulePage'
import './Messaging.css'

const CHANNELS = [
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
    { key: 'instagram', label: 'Instagram', color: '#E4405F' },
    { key: 'email', label: 'Email', color: 'var(--color-info)' },
    { key: 'linkedin', label: 'LinkedIn', color: '#0077B5' },
]

function ChannelCard({ type, label, channel, connectFn, disconnectFn, syncFn, channelBusy }) {
    return (
        <div className="msg-channel-card">
            <div className="msg-channel-card-header">
                <div>
                    <div className="mono text-xs font-bold" style={{ marginBottom: 6 }}>{label}</div>
                    <div className="mono text-xs text-tertiary">{channel?.status === 'active' ? (channel.email_address || channel.phone_number || 'API connected') : 'Not connected'}</div>
                </div>
                <span className={`badge ${channel?.status === 'active' ? 'badge-success' : ''}`}>{channel?.status === 'active' ? 'Active' : 'Offline'}</span>
            </div>
            <div className="msg-channel-card-actions">
                <button className="btn btn-sm btn-ghost" onClick={connectFn} disabled={channelBusy === type}>
                    {channelBusy === type ? 'Connecting...' : channel?.status === 'active' ? 'Reconnect' : 'Connect'}
                </button>
                {channel?.status === 'active' && syncFn && (
                    <button className="btn btn-sm btn-ghost" onClick={() => syncFn(channel.id)} disabled={channelBusy === `sync:${channel.id}`}>
                        {channelBusy === `sync:${channel.id}` ? 'Syncing...' : 'Sync'}
                    </button>
                )}
                {channel?.status === 'active' && (
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={() => disconnectFn(channel.id)} disabled={channelBusy === channel.id}>Disconnect</button>
                )}
            </div>
        </div>
    )
}

const TEMPLATES = [
    { name: 'Intro', content: 'Hola, he estado analizando vuestra captación y veo dos automatizaciones claras que os podrían ahorrar mucho trabajo comercial.' },
    { name: 'Follow-up', content: 'Te escribo por si te cuadra que te comparta 2 ideas concretas para automatizar captación y seguimiento.' },
    { name: 'Demo', content: 'Si te encaja, te enseño en 10 minutos cómo dejar montado el flujo de captación, respuesta y CRM.' },
    { name: 'Closing', content: 'Si lo ves alineado, esta semana puedo preparar el setup inicial y dejarlo operativo.' },
]

function inferChannel(conversation, messages = []) {
    if (conversation?.channel?.type) return conversation.channel.type
    if (conversation?.external_id?.includes(':')) return conversation.external_id.split(':')[0]
    const latestWithMeta = [...messages].reverse().find(m => m.metadata?.channel)
    return latestWithMeta?.metadata?.channel || 'email'
}

function formatTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Messaging() {
    const { toast } = useAppStore()
    const { conversations, messages, activeConvo, loading, sendMessage, dispatchMessage, selectConversation, totalUnread } = useConversations()
    const { byType: channelsByType, busy: channelBusy, error: channelsError, connectGmail, connectWhatsApp, disconnectChannel, syncGmail } = useMessagingChannels()
    const { companies } = useCompanies()
    const [activeChannel, setActiveChannel] = useState('all')
    const [messageInput, setMessageInput] = useState('')
    const [showTemplates, setShowTemplates] = useState(false)

    const companyMap = useMemo(() => (companies || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {}), [companies])
    const selectedConversation = useMemo(() => conversations.find(c => c.id === activeConvo) || null, [activeConvo, conversations])
    const selectedChannel = useMemo(() => inferChannel(selectedConversation, messages), [messages, selectedConversation])
    const selectedCompany = selectedConversation?.contact?.company_id ? companyMap[selectedConversation.contact.company_id] : null
    const filteredConversations = useMemo(() => activeChannel === 'all' ? conversations : conversations.filter(c => inferChannel(c) === activeChannel), [activeChannel, conversations])
    const draftMessage = useMemo(() => [...messages].reverse().find(m => m.metadata?.launch_url), [messages])
    const activeTransport = selectedChannel === 'email' ? channelsByType.email : selectedChannel === 'whatsapp' ? channelsByType.whatsapp : null
    const canSendRealtime = Boolean(activeTransport && activeTransport.status === 'active')

    const selectConvo = async (c) => { await selectConversation(c.id); setMessageInput('') }

    const openDraft = (m = draftMessage) => {
        if (!m?.metadata?.launch_url) return toast('No launch URL detected', 'warning')
        window.open(m.metadata.launch_url, '_blank', 'noopener,noreferrer')
    }

    const saveDraft = async ({ openFallback = false } = {}) => {
        if (!messageInput.trim() || !selectedConversation) return
        const subject = `Follow-up · ${selectedCompany?.name || selectedConversation.contact?.name || 'Contact'}`
        const launchUrl = buildLaunchUrl(selectedChannel, { contact: selectedConversation.contact, company: selectedCompany, subject, body: messageInput })
        const msg = await sendMessage(selectedConversation.id, messageInput, {
            status: 'draft', metadata: { channel: selectedChannel, launch_url: launchUrl, subject, contact_id: selectedConversation.contact?.id || null, company_id: selectedCompany?.id || null, company_name: selectedCompany?.name || null },
        })
        if (!msg) return toast('Failed to save draft', 'warning')
        if (openFallback && launchUrl) window.open(launchUrl, '_blank', 'noopener,noreferrer')
        setMessageInput('')
        toast(`Draft saved for ${getChannelLabel(selectedChannel)}`, 'success')
        return msg
    }

    const sendRealtime = async () => {
        if (!messageInput.trim() || !selectedConversation) return
        if (!canSendRealtime) return toast(`${getChannelLabel(selectedChannel)} API offline`, 'warning')
        const subject = `Follow-up · ${selectedCompany?.name || selectedConversation.contact?.name || 'Contact'}`
        const launchUrl = buildLaunchUrl(selectedChannel, { contact: selectedConversation.contact, company: selectedCompany, subject, body: messageInput })
        const draft = await sendMessage(selectedConversation.id, messageInput, {
            status: 'draft', metadata: { channel: selectedChannel, launch_url: launchUrl, subject, contact_id: selectedConversation.contact?.id || null, company_id: selectedCompany?.id || null, company_name: selectedCompany?.name || null, email: selectedConversation.contact?.email || null, phone: selectedConversation.contact?.phone || null },
        })
        if (!draft) return toast('Failed to stage message', 'warning')
        const result = await dispatchMessage({ messageId: draft.id, conversationId: selectedConversation.id, channel: selectedChannel, subject, body: messageInput, metadata: { launch_url: launchUrl } })
        if (result?.error) return toast(`Send failed: ${result.error}`, 'warning')
        setMessageInput('')
        toast(`${getChannelLabel(selectedChannel)} message sent`, 'success')
    }

    return (
        <ModulePage title="Messaging" subtitle={`Unified inbox · Gmail, WhatsApp & social drafts · ${totalUnread} unread`}>
            <div className="lab-content">
                {/* Channel cards */}
                <div className="msg-channel-grid">
                    <ChannelCard type="gmail" label="Email" channel={channelsByType.email} connectFn={connectGmail} disconnectFn={disconnectChannel} syncFn={syncGmail} channelBusy={channelBusy} />
                    <ChannelCard type="whatsapp" label="WhatsApp" channel={channelsByType.whatsapp} connectFn={connectWhatsApp} disconnectFn={disconnectChannel} channelBusy={channelBusy} />
                    <div className="msg-channel-card">
                        <div className="mono text-xs font-bold" style={{ marginBottom: 'var(--space-2)' }}>Social channels</div>
                        <div className="mono text-xs text-tertiary">LinkedIn and Instagram operate as local drafts injected into the inbox.</div>
                    </div>
                </div>

                {channelsError && <div className="mono text-xs" style={{ padding: 'var(--space-4)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>Connection error: {channelsError}</div>}

                {/* Channel filter */}
                <div className="msg-filter-tabs">
                    <button className={`lab-tab-btn ${activeChannel === 'all' ? 'active' : ''}`} onClick={() => setActiveChannel('all')}>
                        All {totalUnread > 0 && <span style={{ marginLeft: 6, color: activeChannel === 'all' ? 'var(--surface-base)' : 'var(--color-danger)' }}>({totalUnread})</span>}
                    </button>
                    {CHANNELS.map(ch => {
                        const unread = conversations.filter(c => inferChannel(c) === ch.key && c.unread_count > 0).length
                        return <button key={ch.key} className={`lab-tab-btn ${activeChannel === ch.key ? 'active' : ''}`} onClick={() => setActiveChannel(ch.key)}>{ch.label}{unread > 0 && <span style={{ marginLeft: 6 }}> ({unread})</span>}</button>
                    })}
                </div>

                {/* Inbox */}
                <div className="msg-inbox-layout">
                    <div className="msg-convo-list">
                        <div className="lab-panel-header">Conversations ({filteredConversations.length})</div>
                        <div style={{ overflow: 'auto', flex: 1 }}>
                            {loading ? <div className="lab-panel-empty">Loading conversations...</div> :
                                filteredConversations.length === 0 ? <div className="lab-panel-empty">No conversations</div> :
                                filteredConversations.map(convo => {
                                    const ch = inferChannel(convo)
                                    const chMeta = CHANNELS.find(c => c.key === ch) || CHANNELS[0]
                                    const company = convo.contact?.company_id ? companyMap[convo.contact.company_id] : null
                                    return (
                                        <div key={convo.id} className={`msg-convo-item ${selectedConversation?.id === convo.id ? 'active' : ''}`} onClick={() => selectConvo(convo)}>
                                            <div className="msg-convo-header">
                                                <div className="msg-convo-left">
                                                    <span className="mono text-xs text-tertiary font-bold">{chMeta.label.slice(0, 2)}</span>
                                                    <div>
                                                        <div className="mono text-xs font-bold">{convo.contact?.name || 'Unknown'}</div>
                                                        <div className="mono text-xs text-tertiary" style={{ marginTop: 4 }}>{company?.name || getChannelLabel(ch)}</div>
                                                    </div>
                                                </div>
                                                <div className="msg-convo-right">
                                                    <span className="mono text-xs text-tertiary">{formatTime(convo.last_message_at || convo.created_at)}</span>
                                                    {convo.unread_count > 0 && <span className="msg-unread-badge">{convo.unread_count}</span>}
                                                </div>
                                            </div>
                                            <div className="mono text-xs text-secondary" style={{ marginTop: 'var(--space-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {convo.status === 'pending' ? 'Draft saved' : convo.status}
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    </div>

                    <div className="msg-chat-panel">
                        {!selectedConversation ? (
                            <div className="lab-panel-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Select a conversation</div>
                        ) : (
                            <>
                                <div className="msg-chat-header">
                                    <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                        <div className="msg-chat-avatar">{CHANNELS.find(c => c.key === selectedChannel)?.label?.slice(0, 2) || '?'}</div>
                                        <div>
                                            <div className="mono text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{selectedConversation.contact?.name || 'Unknown'}</div>
                                            <div className="mono text-xs text-tertiary" style={{ marginTop: 4 }}>
                                                {selectedCompany?.name || ''} · {getChannelLabel(selectedChannel)}
                                                {selectedConversation.contact?.email && ` · ${selectedConversation.contact.email}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {['email', 'whatsapp'].includes(selectedChannel) && (
                                            <span className={`mono text-xs ${canSendRealtime ? 'text-success' : 'text-tertiary'}`}>{canSendRealtime ? 'Connected' : 'Offline'}</span>
                                        )}
                                        {draftMessage?.metadata?.launch_url && <button className="btn btn-sm btn-primary" onClick={() => openDraft(draftMessage)}>Open link</button>}
                                        <button className="btn btn-sm btn-ghost" onClick={() => setShowTemplates(!showTemplates)}>Templates</button>
                                    </div>
                                </div>

                                {showTemplates && (
                                    <div className="msg-templates-bar">
                                        {TEMPLATES.map(t => <button key={t.name} className="btn btn-sm btn-ghost" onClick={() => setMessageInput(t.content)}>{t.name}</button>)}
                                    </div>
                                )}

                                <div className="msg-messages-area">
                                    {messages.length === 0 ? <div className="lab-panel-empty">Channel open. Start the conversation.</div> :
                                        messages.map(msg => (
                                            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                                                <div className={`msg-bubble ${msg.direction === 'outbound' ? 'msg-bubble--outbound' : 'msg-bubble--inbound'}`}>
                                                    {msg.metadata?.subject && <div className="mono text-xs text-tertiary" style={{ marginBottom: 'var(--space-2)' }}>Subject: {msg.metadata.subject}</div>}
                                                    <div style={{ fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</div>
                                                    <div className="msg-bubble-footer">
                                                        <span>{formatTime(msg.created_at)}</span>
                                                        <span style={{ color: msg.status === 'draft' ? 'var(--color-warning)' : 'inherit' }}>{msg.status || 'sent'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>

                                <div className="msg-compose">
                                    <input className="msg-compose-input" placeholder={`Message via ${getChannelLabel(selectedChannel)}...`} value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); canSendRealtime ? sendRealtime() : saveDraft() } }} />
                                    {['email', 'whatsapp'].includes(selectedChannel) && (
                                        <button className="btn btn-primary" onClick={sendRealtime} disabled={!canSendRealtime}>Send</button>
                                    )}
                                    <button className="btn btn-ghost" onClick={() => saveDraft({ openFallback: !canSendRealtime && ['linkedin', 'instagram'].includes(selectedChannel) })}>Save draft</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </ModulePage>
    )
}

export default Messaging
