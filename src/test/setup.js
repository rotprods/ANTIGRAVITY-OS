import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock import.meta.env for all tests
vi.stubGlobal('import', { meta: { env: { DEV: true } } })

// Mock BroadcastChannel (not available in jsdom)
if (typeof globalThis.BroadcastChannel === 'undefined') {
    globalThis.BroadcastChannel = class {
        constructor() { this.onmessage = null }
        postMessage() {}
        close() {}
        addEventListener() {}
        removeEventListener() {}
    }
}
