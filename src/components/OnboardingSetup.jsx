import React, { useState } from 'react'
import { useOrg } from '../hooks/useOrg'
import { RocketLaunchIcon } from '@heroicons/react/24/solid'

export default function OnboardingSetup() {
    const { createOrganization, loading } = useOrg()
    const [orgName, setOrgName] = useState('')
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!orgName.trim()) return
        setError(null)

        try {
            await createOrganization(orgName)
            // The useOrg hook automatically sets this new org as current, 
            // effectively redirecting the user to the dashboard via App.jsx logic
        } catch (err) {
            setError('Failed to create organization. Please try again.')
        }
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 font-mono">
            <div className="max-w-md w-full bg-[#0A0A0A] border border-slate-800 p-8 rounded-lg shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-600"></div>

                <div className="flex justify-center mb-6">
                    <div className="bg-slate-900 p-3 rounded-full border border-slate-700">
                        <RocketLaunchIcon className="h-8 w-8 text-cyan-400" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center mb-2 tracking-tight">Initialize Protocol</h1>
                <p className="text-slate-400 text-center text-sm mb-8">
                    Welcome to OCULOPS v2. To begin operations, establish your primary organization entity.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs uppercase text-slate-500 mb-2">Organization Name</label>
                        <input
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="w-full bg-[#050505] border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                            placeholder="e.g. Acme Corp, Stark Industries"
                            autoFocus
                        />
                    </div>

                    {error && <div className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}

                    <button
                        type="submit"
                        disabled={loading || !orgName}
                        className={`w-full py-3 rounded font-bold text-sm tracking-wide transition-all ${loading || !orgName
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.5)]'
                            }`}
                    >
                        {loading ? 'INITIALIZING...' : 'ESTABLISH HQ'}
                    </button>
                </form>
            </div>
        </div>
    )
}