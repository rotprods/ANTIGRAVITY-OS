import { useCallback, useState } from 'react'
import { getCurrentUser, supabase } from '../lib/supabase'
import { triggerAutomationWorkflows } from '../lib/automation'
import { buildChannelDraft, getChannelLabel } from '../lib/outreach'

function compact(value) {
    return value == null ? '' : String(value).trim()
}

function buildAtlasMeta(lead, context = {}) {
    return [
        `ATLAS source: ${compact(context.source) || 'atlas'}`,
        context.areaLabel ? `ATLAS area: ${context.areaLabel}` : null,
        context.query ? `ATLAS query: ${context.query}` : null,
        lead.address ? `Address: ${lead.address}` : null,
        lead.maps_url ? `Maps: ${lead.maps_url}` : null,
        typeof lead.lat === 'number' && typeof lead.lng === 'number' ? `Coordinates: ${lead.lat.toFixed(6)}, ${lead.lng.toFixed(6)}` : null,
        lead.website ? `Website: ${lead.website}` : null,
    ].filter(Boolean).join('\n')
}

function mergeNotes(...chunks) {
    return chunks
        .map(chunk => compact(chunk))
        .filter(Boolean)
        .join('\n\n')
}

function getDealValue(lead) {
    if (!lead?.website) return 2400
    if ((lead?.review_count || 0) >= 100) return 1800
    if ((lead?.rating || 0) >= 4.5) return 1600
    return 1200
}

function getConfidence(lead) {
    const reviewBoost = Math.min(Math.round((lead?.review_count || 0) / 4), 24)
    const ratingBoost = Math.round((lead?.rating || 0) * 8)
    const websiteBoost = lead?.website ? 10 : 4
    return Math.max(35, Math.min(95, 30 + reviewBoost + ratingBoost + websiteBoost))
}

function getStatusFromSource(source) {
    if (source === 'flight_deck' || source === 'atlas') return 'qualified'
    return 'raw'
}

export function useAtlasCRM() {
    const [importingLeadId, setImportingLeadId] = useState(null)
    const [bulkImporting, setBulkImporting] = useState(false)
    const [stagingKey, setStagingKey] = useState(null)
    const [error, setError] = useState(null)

    const scopeQuery = useCallback((query, userId) => {
        if (userId) return query.eq('user_id', userId)
        return query.is('user_id', null)
    }, [])

    const resolveActor = useCallback(async () => {
        if (!supabase) throw new Error('Supabase is not configured')
        const user = await getCurrentUser()
        return {
            user,
            userId: user?.id || null,
        }
    }, [])

    const resolveChannel = useCallback(async (userId, channelType) => {
        let query = supabase
            .from('messaging_channels')
            .select('*')
            .eq('type', channelType)
            .eq('status', 'active')
            .order('is_default', { ascending: false })
            .limit(1)

        query = scopeQuery(query, userId)
        const { data } = await query
        return data?.[0] || null
    }, [scopeQuery])

    const findCompany = useCallback(async (userId, lead) => {
        if (compact(lead.place_id)) {
            const { data } = await scopeQuery(supabase
                .from('companies')
                .select('*')
                .eq('google_maps_id', lead.place_id), userId)
                .maybeSingle()
            if (data) return data
        }

        if (compact(lead.website)) {
            const { data } = await scopeQuery(supabase
                .from('companies')
                .select('*')
                .eq('website', lead.website), userId)
                .maybeSingle()
            if (data) return data
        }

        let query = scopeQuery(supabase
            .from('companies')
            .select('*')
            .eq('name', lead.name), userId)

        if (compact(lead.address)) query = query.eq('location', lead.address)

        const { data } = await query.limit(1)
        return data?.[0] || null
    }, [scopeQuery])

    const loadCompanyById = useCallback(async (userId, companyId) => {
        if (!companyId) return null
        const { data } = await scopeQuery(supabase
            .from('companies')
            .select('*')
            .eq('id', companyId), userId)
            .maybeSingle()
        return data || null
    }, [scopeQuery])

    const upsertCompany = useCallback(async (userId, lead, context = {}) => {
        const existing = await findCompany(userId, lead)
        const payload = {
            user_id: userId,
            name: lead.name,
            industry: compact(lead.category) || null,
            website: compact(lead.website) || null,
            location: compact(lead.address) || compact(context.areaLabel) || null,
            google_maps_id: compact(lead.place_id) || null,
            score: getConfidence(lead),
            status: 'prospected',
            source: compact(lead.source) || compact(context.source) || 'atlas',
            notes: mergeNotes(existing?.notes, buildAtlasMeta(lead, context)),
        }

        if (existing) {
            const { data, error: updateError } = await supabase
                .from('companies')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single()

            if (updateError) throw updateError
            return data
        }

        const { data, error: insertError } = await supabase
            .from('companies')
            .insert(payload)
            .select()
            .single()

        if (insertError) throw insertError
        return data
    }, [findCompany])

    const findContact = useCallback(async (userId, companyId, lead) => {
        if (compact(lead.email)) {
            const { data } = await scopeQuery(supabase
                .from('contacts')
                .select('*')
                .eq('email', lead.email), userId)
                .maybeSingle()
            if (data) return data
        }

        if (compact(lead.phone)) {
            const { data } = await scopeQuery(supabase
                .from('contacts')
                .select('*')
                .eq('company_id', companyId)
                .eq('phone', lead.phone), userId)
                .maybeSingle()
            if (data) return data
        }

        const { data } = await scopeQuery(supabase
            .from('contacts')
            .select('*')
            .eq('company_id', companyId)
            .eq('name', lead.name), userId)
            .limit(1)

        return data?.[0] || null
    }, [scopeQuery])

    const upsertContact = useCallback(async (userId, company, lead, context = {}) => {
        const existing = await findContact(userId, company.id, lead)
        const payload = {
            user_id: userId,
            company_id: company.id,
            name: compact(lead.contact_name) || compact(lead.name) || company.name,
            email: compact(lead.email) || existing?.email || null,
            phone: compact(lead.phone) || existing?.phone || null,
            linkedin_url: compact(lead.linkedin_url) || existing?.linkedin_url || null,
            role: compact(lead.role) || existing?.role || 'Owner / Front Desk',
            is_decision_maker: Boolean(compact(lead.role).match(/owner|founder|ceo|director/i)),
            confidence: getConfidence(lead),
            status: getStatusFromSource(context.source),
            source: compact(lead.source) || compact(context.source) || 'atlas',
            notes: mergeNotes(existing?.notes, buildAtlasMeta(lead, context)),
        }

        if (existing) {
            const { data, error: updateError } = await supabase
                .from('contacts')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single()

            if (updateError) throw updateError
            return data
        }

        const { data, error: insertError } = await supabase
            .from('contacts')
            .insert(payload)
            .select()
            .single()

        if (insertError) throw insertError
        return data
    }, [findContact])

    const ensureDeal = useCallback(async (userId, company, contact, lead, context = {}) => {
        const title = `ATLAS · ${compact(context.query) || compact(lead.category) || 'Lead'} · ${company.name}`
        const { data: existing } = await scopeQuery(supabase
            .from('deals')
            .select('*')
            .eq('company_id', company.id)
            .eq('title', title), userId)
            .limit(1)

        const payload = {
            user_id: userId,
            company_id: company.id,
            contact_id: contact.id,
            title,
            value: getDealValue(lead),
            monthly_value: getDealValue(lead),
            stage: 'lead',
            probability: lead?.website ? 35 : 48,
            notes: mergeNotes(existing?.[0]?.notes, buildAtlasMeta(lead, context)),
        }

        if (existing?.[0]) {
            const { data, error: updateError } = await supabase
                .from('deals')
                .update(payload)
                .eq('id', existing[0].id)
                .select()
                .single()

            if (updateError) throw updateError
            return data
        }

        const { data, error: insertError } = await supabase
            .from('deals')
            .insert(payload)
            .select()
            .single()

        if (insertError) throw insertError
        return data
    }, [scopeQuery])

    const addActivity = useCallback(async (userId, { contact, company, deal = null, type, subject, description, outcome = null }) => {
        const { data, error: insertError } = await supabase
            .from('crm_activities')
            .insert({
                user_id: userId,
                contact_id: contact.id,
                company_id: company?.id || null,
                deal_id: deal?.id || null,
                type,
                subject,
                description,
                outcome,
            })
            .select()
            .single()

        if (insertError) throw insertError
        return data
    }, [])

    const ensureConversation = useCallback(async (userId, contact, channel) => {
        const channelRow = await resolveChannel(userId, channel)
        const externalId = `${channel}:${contact.id}`
        const { data: existing } = await scopeQuery(supabase
            .from('conversations')
            .select('*')
            .eq('external_id', externalId), userId)
            .limit(1)

        if (existing?.[0]) {
            const { data, error: updateError } = await supabase
                .from('conversations')
                .update({
                    status: 'pending',
                    channel: channel,
                    channel_id: channelRow?.id || existing[0].channel_id || null,
                    company_id: contact.company_id || existing[0].company_id || null,
                    last_message_at: new Date().toISOString(),
                    last_outbound_at: new Date().toISOString(),
                })
                .eq('id', existing[0].id)
                .select()
                .single()

            if (updateError) throw updateError
            return data
        }

        const { data, error: insertError } = await supabase
            .from('conversations')
            .insert({
                user_id: userId,
                contact_id: contact.id,
                company_id: contact.company_id || null,
                channel,
                channel_id: channelRow?.id || null,
                external_id: externalId,
                status: 'pending',
                assigned_to: 'Atlas',
                last_message_at: new Date().toISOString(),
                last_outbound_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (insertError) throw insertError
        return data
    }, [resolveChannel, scopeQuery])

    const ensureWorkflow = useCallback(async (userId, { contact, company, conversation, message, draft, channel }) => {
        const name = `${getChannelLabel(channel)} · ${contact.name}`
        const payload = {
            user_id: userId,
            name,
            description: `Draft de ${getChannelLabel(channel)} generado desde CRM/Atlas para ${company?.name || contact.name}`,
            trigger_type: 'manual',
            trigger_config: {
                source: 'atlas_crm',
                channel,
                contact_id: contact.id,
                company_id: company?.id || null,
                conversation_id: conversation.id,
            },
            steps: [
                {
                    id: 'draft',
                    type: 'compose_message',
                    config: {
                        channel,
                        subject: draft.subject,
                        body: draft.body,
                        launch_url: draft.launchUrl,
                        conversation_id: conversation.id,
                        message_id: message?.id || null,
                        contact_id: contact.id,
                        company_id: company?.id || null,
                    },
                },
                {
                    id: 'log',
                    type: 'crm_activity',
                    config: {
                        contact_id: contact.id,
                        company_id: company?.id || null,
                        conversation_id: conversation.id,
                    },
                },
            ],
            is_active: true,
        }

        const { data: existing } = await scopeQuery(supabase
            .from('automation_workflows')
            .select('*')
            .eq('name', name), userId)
            .limit(1)

        if (existing?.[0]) {
            const { data, error: updateError } = await supabase
                .from('automation_workflows')
                .update(payload)
                .eq('id', existing[0].id)
                .select()
                .single()

            if (updateError) throw updateError
            return data
        }

        const { data, error: insertError } = await supabase
            .from('automation_workflows')
            .insert(payload)
            .select()
            .single()

        if (insertError) throw insertError
        return data
    }, [scopeQuery])

    const importLead = useCallback(async (lead, context = {}) => {
        if (!lead?.name) return { error: 'Lead data is incomplete' }

        setImportingLeadId(lead.id || lead.place_id || lead.name)
        setError(null)

        try {
            const { userId } = await resolveActor()
            const company = await upsertCompany(userId, lead, context)
            const contact = await upsertContact(userId, company, lead, context)
            const deal = await ensureDeal(userId, company, contact, lead, context)
            const activity = await addActivity(userId, {
                contact,
                company,
                deal,
                type: 'note',
                subject: 'Lead sincronizado desde Atlas',
                description: `Atlas sincronizó ${company.name} desde ${compact(context.areaLabel) || compact(lead.address) || 'la zona activa'}.`,
            })

            let automation = null
            try {
                automation = await triggerAutomationWorkflows('atlas_import', {
                    user_id: userId,
                    source: compact(context.source) || 'atlas',
                    area_label: compact(context.areaLabel) || null,
                    query: compact(context.query) || null,
                    lead_id: lead.id || null,
                    lead,
                    company_id: company.id,
                    contact_id: contact.id,
                    deal_id: deal.id,
                }, {
                    send_live: false,
                    source: 'atlas_crm',
                })
            } catch (automationError) {
                if (import.meta.env.DEV) console.warn('Atlas import automation trigger failed:', automationError)
            }

            return { company, contact, deal, activity, automation }
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        } finally {
            setImportingLeadId(null)
        }
    }, [addActivity, ensureDeal, resolveActor, upsertCompany, upsertContact])

    const importLeads = useCallback(async (leads, context = {}) => {
        setBulkImporting(true)
        setError(null)

        try {
            const imported = []
            const failed = []

            for (const lead of leads) {
                const result = await importLead(lead, context)
                if (result?.error) failed.push({ lead, error: result.error })
                else imported.push({ lead, ...result })
            }

            return {
                imported,
                failed,
                importedCount: imported.length,
                failedCount: failed.length,
            }
        } finally {
            setBulkImporting(false)
        }
    }, [importLead])

    const stageOutreach = useCallback(async ({ channel, lead = null, contact = null, company = null, context = {}, subject = '', body = '' }) => {
        setStagingKey(`${channel}:${contact?.id || lead?.id || lead?.place_id || 'draft'}`)
        setError(null)

        try {
            const { userId } = await resolveActor()
            let resolvedCompany = company
            let resolvedContact = contact
            let resolvedDeal = null

            if (!resolvedContact && !lead) {
                throw new Error('No contact or lead available for outreach')
            }

            if (!resolvedContact) {
                const imported = await importLead(lead, context)
                if (imported?.error) return imported
                resolvedCompany = imported.company
                resolvedContact = imported.contact
                resolvedDeal = imported.deal
            } else if (!resolvedCompany && resolvedContact?.company_id) {
                resolvedCompany = await loadCompanyById(userId, resolvedContact.company_id)
            }

            if (!resolvedCompany) {
                resolvedCompany = {
                    id: null,
                    name: compact(lead?.name) || compact(resolvedContact?.name) || 'Lead',
                    location: compact(context.location) || compact(context.areaLabel) || null,
                }
            }

            const draft = buildChannelDraft(channel, {
                contact: resolvedContact,
                company: resolvedCompany,
                lead,
                subject,
                body,
                context,
            })

            const conversation = await ensureConversation(userId, resolvedContact, channel)
            const channelRow = await resolveChannel(userId, channel)
            const { data: message, error: messageError } = await supabase
                .from('messages')
                .insert({
                    user_id: userId,
                    conversation_id: conversation.id,
                    channel_id: channelRow?.id || conversation.channel_id || null,
                    direction: 'outbound',
                    content: draft.body,
                    subject: draft.subject,
                    content_type: 'text',
                    status: 'draft',
                    metadata: {
                        channel,
                        launch_url: draft.launchUrl,
                        subject: draft.subject,
                        contact_id: resolvedContact.id,
                        company_id: resolvedCompany?.id || null,
                        company_name: resolvedCompany.name,
                        email: resolvedContact.email || null,
                        phone: resolvedContact.phone || null,
                        linkedin_url: resolvedContact.linkedin_url || null,
                        area_label: compact(context.areaLabel) || null,
                        source: compact(context.source) || 'atlas_crm',
                    },
                })
                .select()
                .single()

            if (messageError) throw messageError

            const workflow = await ensureWorkflow(userId, {
                contact: resolvedContact,
                company: resolvedCompany,
                conversation,
                message,
                draft,
                channel,
            })

            const activity = await addActivity(userId, {
                contact: resolvedContact,
                company: resolvedCompany,
                deal: resolvedDeal,
                type: channel === 'email' ? 'email' : channel === 'whatsapp' ? 'whatsapp' : 'note',
                subject: `${getChannelLabel(channel)} draft preparado`,
                description: `Atlas dejó preparado un borrador de ${getChannelLabel(channel)} para ${resolvedCompany.name}.`,
            })

            return {
                contact: resolvedContact,
                company: resolvedCompany,
                conversation,
                message,
                workflow,
                activity,
                launchUrl: draft.launchUrl,
                subject: draft.subject,
                body: draft.body,
            }
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        } finally {
            setStagingKey(null)
        }
    }, [addActivity, ensureConversation, ensureWorkflow, importLead, loadCompanyById, resolveActor, resolveChannel])

    return {
        importingLeadId,
        bulkImporting,
        stagingKey,
        error,
        importLead,
        importLeads,
        stageOutreach,
    }
}
