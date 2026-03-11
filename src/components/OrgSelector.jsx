import React, { useState } from 'react'
import { useOrg } from '../hooks/useOrg'
import { PlusIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

export default function OrgSelector() {
    const { organizations, currentOrg, switchOrganization, createOrganization } = useOrg()
    const [isCreating, setIsCreating] = useState(false)
    const [newOrgName, setNewOrgName] = useState('')

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!newOrgName.trim()) return
        await createOrganization(newOrgName)
        setIsCreating(false)
        setNewOrgName('')
    }

    if (isCreating) {
        return (
            <form onSubmit={handleCreate} className="p-2 bg-slate-800 rounded mb-4 border border-slate-700">
                <input
                    autoFocus
                    className="w-full bg-slate-900 text-white text-sm p-1 rounded mb-2 border border-slate-600 focus:border-cyan-500 outline-none"
                    placeholder="Org Name..."
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                />
                <div className="flex gap-2 text-xs">
                    <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-1 rounded">Create</button>
                    <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white">Cancel</button>
                </div>
            </form>
        )
    }

    return (
        <div className="mb-6">
            <div className="text-xs font-mono text-slate-500 mb-2 uppercase tracking-wider">Organization</div>
            <div className="relative group">
                <select
                    className="w-full appearance-none bg-slate-900 border border-slate-700 text-cyan-400 text-sm font-bold py-2 px-3 rounded focus:outline-none focus:border-cyan-500 cursor-pointer"
                    value={currentOrg?.id || ''}
                    onChange={(e) => switchOrganization(organizations.find(o => o.id === e.target.value))}
                >
                    {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <BuildingOfficeIcon className="h-4 w-4" />
                </div>
            </div>
            <button
                onClick={() => setIsCreating(true)}
                className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors w-full"
            >
                <PlusIcon className="h-3 w-3" />
                <span>New Organization</span>
            </button>
        </div>
    )
}