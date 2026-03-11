import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import {
    UserCircleIcon,
    ArrowRightOnRectangleIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline'

export default function UserMenu() {
    const { setOrganizations, setCurrentOrg } = useOrg()
    const [user, setUser] = useState(null)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setOrganizations([])
        setCurrentOrg(null)
        // App.jsx will handle the redirect based on auth state
    }

    if (!user) return null

    return (
        <div className="mt-auto border-t border-slate-800 pt-4 relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 w-full p-2 hover:bg-slate-800 rounded transition-colors"
            >
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                    {user.email[0]}
                </div>
                <div className="flex-1 text-left overflow-hidden">
                    <div className="text-sm text-slate-200 font-medium truncate">{user.email}</div>
                    <div className="text-xs text-slate-500 truncate">Operator</div>
                </div>
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-[#0A0A0A] border border-slate-700 rounded-md shadow-xl overflow-hidden z-20">
                    <button className="flex items-center gap-2 w-full px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                        <Cog6ToothIcon className="h-4 w-4" />
                        <span>Settings</span>
                    </button>
                    <div className="h-px bg-slate-800 my-0"></div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                        <ArrowRightOnRectangleIcon className="h-4 w-4" />
                        <span>Disconnect</span>
                    </button>
                </div>
            )}
        </div>
    )
}