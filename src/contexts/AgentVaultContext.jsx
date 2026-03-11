// ═══════════════════════════════════════════════════
// OCULOPS — AgentVaultContext
// Loads vault manifest ONCE, shared across all modules
// ═══════════════════════════════════════════════════

import { createContext, useContext } from 'react'
import { useAgentVault } from '../hooks/useAgentVault'

const AgentVaultContext = createContext(null)

export function AgentVaultProvider({ children }) {
    const vault = useAgentVault()
    return (
        <AgentVaultContext.Provider value={vault}>
            {children}
        </AgentVaultContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAgentVaultContext() {
    const ctx = useContext(AgentVaultContext)
    if (!ctx) throw new Error('useAgentVaultContext must be used within AgentVaultProvider')
    return ctx
}
