// ═══════════════════════════════════════════════════
// OCULOPS — Supabase Mock for Vitest
// Chainable query builder + realtime subscriptions
// ═══════════════════════════════════════════════════

import { vi } from 'vitest'

// ── Configurable response store ──────────────────────────────────────────────
// Tests set these before each run to control what the mock returns
let _mockData = []
let _mockError = null
let _mockSingleData = null
let _mockInsertData = null

export function __setMockData(data) { _mockData = data }
export function __setMockError(error) { _mockError = error }
export function __setMockSingleData(data) { _mockSingleData = data }
export function __setMockInsertData(data) { _mockInsertData = data }
export function __resetMocks() {
    _mockData = []
    _mockError = null
    _mockSingleData = null
    _mockInsertData = null
}

// ── Chainable query builder ──────────────────────────────────────────────────

function createQueryBuilder() {
    let _isSingle = false
    let _isInsert = false

    const builder = {
        select: vi.fn(() => builder),
        insert: vi.fn(() => { _isInsert = true; return builder }),
        update: vi.fn(() => { _isInsert = true; return builder }),
        upsert: vi.fn(() => { _isInsert = true; return builder }),
        delete: vi.fn(() => { _isInsert = true; return builder }),
        eq: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        or: vi.fn(() => builder),
        in: vi.fn(() => builder),
        not: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        ilike: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        order: vi.fn(() => builder),
        single: vi.fn(() => { _isSingle = true; return builder }),
        maybeSingle: vi.fn(() => { _isSingle = true; return builder }),
        then: (resolve, reject) => {
            if (_mockError) {
                return Promise.resolve({ data: null, error: _mockError }).then(resolve, reject)
            }
            if (_isInsert && _mockInsertData) {
                return Promise.resolve({ data: _mockInsertData, error: null }).then(resolve, reject)
            }
            if (_isSingle) {
                return Promise.resolve({ data: _mockSingleData ?? _mockData[0] ?? null, error: null }).then(resolve, reject)
            }
            return Promise.resolve({ data: _mockData, error: null }).then(resolve, reject)
        },
        catch: (reject) => builder.then(undefined, reject),
    }

    return builder
}

// ── Channel mock ─────────────────────────────────────────────────────────────

let _channelCallbacks = []

export function __triggerRealtimeEvent(payload) {
    _channelCallbacks.forEach(cb => cb(payload))
}

function createChannelMock() {
    const channel = {
        on: vi.fn((event, filter, callback) => {
            if (typeof filter === 'function') {
                _channelCallbacks.push(filter)
            } else if (typeof callback === 'function') {
                _channelCallbacks.push(callback)
            }
            return channel
        }),
        subscribe: vi.fn((cb) => {
            if (typeof cb === 'function') cb('SUBSCRIBED')
            return channel
        }),
        unsubscribe: vi.fn(),
        send: vi.fn(),
    }
    return channel
}

// ── Mock Supabase client ─────────────────────────────────────────────────────

export const supabase = {
    from: vi.fn(() => createQueryBuilder()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'test-user-id', email: 'test@oculops.com' } }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'test-user-id' } } }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'test-user-id' } }, error: null })),
        signUp: vi.fn(async () => ({ data: { user: { id: 'test-user-id' } }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
    },
    channel: vi.fn(() => createChannelMock()),
    getChannels: vi.fn(() => []),
    removeChannel: vi.fn(async () => 'ok'),
}

export const isSupabaseConfigured = true

// ── Re-export CRUD helpers as mocks ──────────────────────────────────────────

export const fetchAll = vi.fn(async () => _mockData)
export const insertRow = vi.fn(async (table, row) => _mockInsertData ?? { id: 'new-id', ...row })
export const updateRow = vi.fn(async (table, id, updates) => ({ id, ...updates }))
export const deleteRow = vi.fn(async () => true)
export const fetchOne = vi.fn(async () => _mockSingleData ?? _mockData[0] ?? null)
export const subscribeToTable = vi.fn(() => createChannelMock())
export const subscribeDebouncedToTable = vi.fn(() => createChannelMock())
export const getCurrentUserId = vi.fn(async () => 'test-user-id')
export const getCurrentUser = vi.fn(async () => ({ id: 'test-user-id', email: 'test@oculops.com' }))
export const scopeUserQuery = vi.fn((query) => query)
export const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))

export default supabase
