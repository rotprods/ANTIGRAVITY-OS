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

export function useAgentVaultContext() {
    const ctx = useContext(AgentVaultContext)
    if (!ctx) return useAgentVault() // fallback if provider not mounted
    return ctx
}
