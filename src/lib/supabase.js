// ═══════════════════════════════════════════════════
// OCULOPS — Supabase Client
// ═══════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    if (import.meta.env.DEV) console.warn('Supabase credentials not configured. Running in offline mode.');
}

// Ensure URL is at least syntactically valid to prevent `@supabase/supabase-js`'s internal "Invalid supabaseUrl" throw.
const isValidUrl = (url) => {
    try { new URL(url); return true; } catch { return false; }
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl));
const ENV_MISSING_ERROR = { message: 'ENV_MISSING' };

function createOfflineQuery() {
    let mode = 'select';
    let expectSingle = false;

    const builder = {
        select: () => builder,
        insert: () => { mode = 'write'; return builder; },
        update: () => { mode = 'write'; return builder; },
        upsert: () => { mode = 'write'; return builder; },
        delete: () => { mode = 'write'; return builder; },
        eq: () => builder,
        like: () => builder,
        is: () => builder,
        or: () => builder,
        in: () => builder,
        not: () => builder,
        gte: () => builder,
        lte: () => builder,
        ilike: () => builder,
        limit: () => builder,
        order: () => builder,
        single: () => { expectSingle = true; return builder; },
        maybeSingle: () => { expectSingle = true; return builder; },
        then: (resolve, reject) => {
            const result = mode === 'write'
                ? { data: null, error: ENV_MISSING_ERROR }
                : { data: expectSingle ? null : [], error: null, count: 0 };
            return Promise.resolve(result).then(resolve, reject);
        },
        catch: (reject) => builder.then(undefined, reject),
        finally: (callback) => builder.then(
            (value) => Promise.resolve(callback?.()).then(() => value),
            (error) => Promise.resolve(callback?.()).then(() => { throw error; })
        ),
    };

    return builder;
}

function createOfflineChannel() {
    const channel = {
        on: () => channel,
        subscribe: (callback) => {
            if (typeof callback === 'function') callback('CHANNEL_ERROR');
            return channel;
        },
        unsubscribe: () => { },
    };

    return channel;
}

// A safe stub that prevents the entire React tree from crashing if Supabase is offline/misconfigured.
// The ErrorBoundary or individual components will just see failed requests or null users.
const DummyClient = {
    from: () => createOfflineQuery(),
    rpc: async () => ({ data: null, error: ENV_MISSING_ERROR }),
    functions: {
        invoke: async () => ({ data: null, error: ENV_MISSING_ERROR }),
    },
    auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
        signInWithPassword: async () => ({ error: { message: 'Supabase credentials missing in Edge/Vercel' } }),
        signUp: async () => ({ error: { message: 'Supabase credentials missing in Edge/Vercel' } }),
        signInWithOtp: async () => ({ error: { message: 'Supabase credentials missing in Edge/Vercel' } }),
        signOut: async () => ({ error: null })
    },
    channel: () => createOfflineChannel(),
    getChannels: () => [],
    removeChannel: (channel) => {
        channel?.unsubscribe?.();
        return Promise.resolve('ok');
    },
};

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
            params: { eventsPerSecond: 10 },
        },
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    })
    : DummyClient;

const USER_SCOPED_TABLES = new Set([
    'alerts',
    'api_connectors',
    'automation_workflows',
    'automation_runs',
    'bets',
    'campaigns',
    'companies',
    'contacts',
    'conversations',
    'crm_activities',
    'decisions',
    'deals',
    'detected_leads',
    'detection_rules',
    'experiments',
    'finance_entries',
    'knowledge_entries',
    'messaging_channels',
    'messages',
    'niches',
    'opportunities',
    'pipeline_entries',
    'prospector_leads',
    'prospector_scans',
    'resource_allocations',
    'signals',
    'agent_studies',
    'agent_delivery_targets',
    'tasks',
]);

// ═══ Helper: Generic CRUD operations ═══

// SWR cache — prevents duplicate parallel queries when multiple hooks mount simultaneously
const _fetchCache = new Map();
const CACHE_TTL = 5000; // 5 seconds stale-while-revalidate window

export async function fetchAll(table, filters = {}) {
    if (!supabase) return [];

    const cacheKey = `${table}:${JSON.stringify(filters)}`;
    const cached = _fetchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }

    // If there's already an in-flight request for this key, await it instead of duplicating
    if (cached?.promise) {
        return cached.promise;
    }

    const promise = (async () => {
        let query = supabase.from(table).select('*');
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) { if (import.meta.env.DEV) console.error(`Error fetching ${table}:`, error); return []; }
        _fetchCache.set(cacheKey, { data: data || [], ts: Date.now(), promise: null });
        return data || [];
    })();

    _fetchCache.set(cacheKey, { ...(cached || {}), promise });
    return promise;
}

// Bust cache for a table (called after mutations)
export function invalidateCache(table) {
    for (const key of _fetchCache.keys()) {
        if (key.startsWith(`${table}:`)) _fetchCache.delete(key);
    }
}

export async function fetchOne(table, id) {
    if (!supabase) return null;
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    if (error) { if (import.meta.env.DEV) console.error(`Error fetching ${table}/${id}:`, error); return null; }
    return data;
}

export async function insertRow(table, row) {
    if (!supabase) return null;
    let payload = row;

    if (USER_SCOPED_TABLES.has(table) && !row.user_id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) payload = { ...row, user_id: user.id };
    }

    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) { if (import.meta.env.DEV) console.error(`Error inserting into ${table}:`, error); return null; }
    invalidateCache(table);
    return data;
}

export async function updateRow(table, id, updates) {
    if (!supabase) return null;
    const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
    if (error) { if (import.meta.env.DEV) console.error(`Error updating ${table}/${id}:`, error); return null; }
    invalidateCache(table);
    return data;
}

export async function deleteRow(table, id) {
    if (!supabase) return false;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { if (import.meta.env.DEV) console.error(`Error deleting from ${table}/${id}:`, error); return false; }
    invalidateCache(table);
    return true;
}

// ═══ Realtime subscription helper ═══

export function subscribeToTable(table, callback, filters = {}) {
    if (!supabase) return null;
    const channel = supabase
        .channel(`${table}_changes`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table,
            ...filters,
        }, (payload) => callback(payload))
        .subscribe();
    return channel;
}

// Debounced variant — batches rapid-fire events into a single callback
export function subscribeDebouncedToTable(table, callback, delay = 500) {
    if (!supabase) return null;
    let timer = null;
    let lastPayload = null;
    const channel = supabase
        .channel(`${table}_debounced`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table,
        }, (payload) => {
            lastPayload = payload;
            clearTimeout(timer);
            timer = setTimeout(() => callback(lastPayload), delay);
        })
        .subscribe();
    return channel;
}

// ═══ Auth helpers ═══

export async function signInWithEmail(email, password) {
    if (!supabase) return { error: { message: 'Supabase not configured' } };
    return supabase.auth.signInWithPassword({ email, password });
}

function getAuthRedirectUrl() {
    if (typeof window === 'undefined') return undefined;
    return window.location.origin;
}

export async function signUpWithEmail(email, password, fullName) {
    if (!supabase) return { error: { message: 'Supabase not configured' } };
    return supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName },
            emailRedirectTo: getAuthRedirectUrl(),
        },
    });
}

export async function signInWithMagicLink(email) {
    if (!supabase) return { error: { message: 'Supabase not configured' } };
    return supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: getAuthRedirectUrl(),
            shouldCreateUser: false,
        },
    });
}

export async function signOut() {
    if (!supabase) return;
    return supabase.auth.signOut();
}

export async function getCurrentUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function getCurrentUserId() {
    const user = await getCurrentUser();
    return user?.id || null;
}

export function scopeUserQuery(query, userId, { includeGlobal = true } = {}) {
    if (!query) return query;
    if (userId && includeGlobal && typeof query.or === 'function') {
        return query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    if (userId && typeof query.eq === 'function') {
        return query.eq('user_id', userId);
    }
    if (typeof query.is === 'function') {
        return query.is('user_id', null);
    }
    return query;
}

export async function getCurrentSession() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export function onAuthStateChange(callback) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => { } } } };
    return supabase.auth.onAuthStateChange(callback);
}

export function getSupabaseFunctionUrl(path = '') {
    if (!supabaseUrl) return null;
    const normalizedPath = String(path).replace(/^\/+/, '');
    return `${supabaseUrl}/functions/v1/${normalizedPath}`;
}

export async function getSupabaseAccessToken({ allowAnonFallback = true } = {}) {
    if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) return session.access_token;
    }

    return allowAnonFallback ? supabaseAnonKey || null : null;
}

export async function callSupabaseFunction(path, options = {}) {
    const {
        method = 'POST',
        body,
        headers = {},
        allowAnonFallback = true,
    } = options;

    const url = getSupabaseFunctionUrl(path);
    if (!url) throw new Error('Supabase URL not configured');

    const token = await getSupabaseAccessToken({ allowAnonFallback });
    const requestHeaders = { ...headers };

    if (body !== undefined && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
    }
    if (token && !requestHeaders.Authorization) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });

    const raw = await response.text();
    let data = null;

    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = raw;
        }
    }

    if (!response.ok) {
        const message = typeof data === 'object' && data
            ? data.error || data.message || `HTTP ${response.status}`
            : raw || `HTTP ${response.status}`;
        throw new Error(message);
    }

    return data;
}

export default supabase;
