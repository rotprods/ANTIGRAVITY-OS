import React, { useState, useEffect } from 'react'
import { useOrg } from '../../hooks/useOrg'
import {
    UserPlusIcon,
    EnvelopeIcon,
    CheckCircleIcon,
    ClockIcon
} from '@heroicons/react/24/outline'

export default function TeamSettings() {
    const {
        currentOrg,
        members,
        pendingInvites,
        fetchMembers,
        fetchPendingInvites,
        inviteMember,
        loading
    } = useOrg()

    const [inviteEmail, setInviteEmail] = useState('')
    const [isInviting, setIsInviting] = useState(false)
    const [feedback, setFeedback] = useState({ type: '', msg: '' })

    useEffect(() => {
        if (currentOrg) {
            fetchMembers(currentOrg.id)
            fetchPendingInvites(currentOrg.id)
        }
    }, [currentOrg])

    const handleInvite = async (e) => {
        e.preventDefault()
        if (!inviteEmail) return
        setIsInviting(true)
        setFeedback({ type: '', msg: '' })

        try {
            await inviteMember(inviteEmail)
            setFeedback({ type: 'success', msg: `Invitation sent to ${inviteEmail}` })
            setInviteEmail('')
        } catch (error) {
            setFeedback({ type: 'error', msg: error.message })
        } finally {
            setIsInviting(false)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto animate-fade-in">
            <div className="mb-8 border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-bold text-white mb-2">Team Management</h2>
                <p className="text-slate-400">Manage access and roles for <span className="text-cyan-400 font-mono">{currentOrg?.name}</span></p>
            </div>

            {/* Invite Section */}
            <div className="bg-[#0A0A0A] border border-slate-800 rounded-lg p-6 mb-8">
                <h3 className="text-sm uppercase tracking-wider text-slate-500 mb-4 font-bold flex items-center gap-2">
                    <UserPlusIcon className="h-4 w-4" /> Invite New Member
                </h3>
                <form onSubmit={handleInvite} className="flex gap-4 items-start">
                    <div className="flex-1">
                        <input
                            type="email"
                            placeholder="colleague@company.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        {feedback.msg && (
                            <div className={`text-xs mt-2 ${feedback.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                                {feedback.msg}
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isInviting || !inviteEmail}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isInviting ? 'Sending...' : 'Send Invite'}
                    </button>
                </form>
            </div>

            {/* Members List */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm uppercase tracking-wider text-slate-500 mb-4 font-bold">Active Members</h3>
                    <div className="grid gap-2">
                        {members.map(member => (
                            <div key={member.id} className="flex items-center justify-between bg-slate-900/50 p-4 rounded border border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">
                                        {member.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm text-white font-medium">{member.email}</div>
                                        <div className="text-xs text-slate-500 capitalize">{member.role}</div>
                                    </div>
                                </div>
                                <div className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-900/50 flex items-center gap-1">
                                    <CheckCircleIcon className="h-3 w-3" /> Active
                                </div>
                            </div>
                        ))}
                        {members.length === 0 && !loading && <div className="text-slate-500 text-sm italic">No active members found.</div>}
                    </div>
                </div>
            </div>
        </div>
    )
}