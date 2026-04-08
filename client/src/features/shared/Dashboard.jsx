import React from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { ROLES } from '../../constants/roles';
import AdminDashboard from '../admin/AdminDashboard';
import MemberDashboard from '../member/MemberDashboard';
import StaffDashboard from '../staff/StaffDashboard';
import TrainerDashboard from '../trainer/TrainerDashboard';
import BranchSelector from '../../components/dashboard/BranchSelector';

import { withApiBase } from '../../config/api';

export default function Dashboard() {
    const { user, activeGymId, switchBranch } = useAuth();

    // Derived state from user context (safe to do before hooks as long as user isn't used in a hook dependency conditionally)
    const isOwner = user?.role === ROLES.OWNER;
    const isOwnerWithoutBranch = isOwner && !activeGymId;
    const isStaff = user?.role === ROLES.STAFF;
    const isAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.OWNER;
    const showSharedDashboardHeader = user?.role !== ROLES.MEMBER && user?.role !== ROLES.TRAINER;

    // Open Report in New Tab
    const handlePrint = () => {
        window.open('/admin/report', '_blank');
    };

    const { data: stats, isLoading: loading, error } = useQuery({
        queryKey: ['dashboard-stats', activeGymId],
        queryFn: async () => {
            const res = await axios.get(withApiBase('/api/dashboard/stats'));
            return res.data;
        },
        retry: 1,
        refetchInterval: 60000 // Refresh every minute
    });

    if (!user) return null;

    const isEffectivelyLoading = loading && !isOwnerWithoutBranch;
    const hasCriticalError = error && !isOwnerWithoutBranch;

    if (isEffectivelyLoading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white p-8 animate-pulse text-lg font-medium">Loading Dashboard...</div>
        </div>
    );

    if (hasCriticalError) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
            <p className="text-red-400 mb-4 text-lg font-medium bg-red-500/10 px-6 py-4 rounded-xl border border-red-500/20">
                {error.response?.data?.error || error.message || "Failed to load dashboard data"}
            </p>
            <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20"
            >
                Retry
            </button>
        </div>
    );

    return (
        <div className="relative min-h-[80vh]">
            {/* Branch Selector Overlay */}
            {isOwnerWithoutBranch && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-[#0f1115] border border-white/5 rounded-[3rem] shadow-2xl shadow-black/50 p-4">
                        <BranchSelector onSelect={switchBranch} />
                    </div>
                </div>
            )}

            {/* Dashboard Content */}
            <div className="space-y-8 animate-fade-in transition-all duration-700">
                {showSharedDashboardHeader && (
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                            <p className="text-text-muted mt-1">
                                Welcome back, {user?.name || 'User'}
                                {activeGymId && <span className="text-primary font-bold"> • {stats?.gymName || 'Current Branch'}</span>}
                            </p>
                        </div>
                        {/* Role-specific quick actions */}
                        {isAdmin && (
                            <div className="flex gap-4 w-full sm:w-auto">
                                {isOwner && (
                                    <button
                                        onClick={() => switchBranch(null)}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
                                    >
                                        Change Branch
                                    </button>
                                )}
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-surfaceHighlight border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Download Report
                                </button>
                                <button className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                                    <a href="/admin/members">Manage Member</a>
                                </button>
                            </div>
                        )}
                        {isStaff && (
                            <div className="flex gap-4 w-full sm:w-auto">
                                <a href="/payments" className="flex-1 sm:flex-none text-center px-4 py-2 bg-surfaceHighlight border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                                    Open POS
                                </a>
                                <a href="/members" className="flex-1 sm:flex-none text-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                                    Manage Members
                                </a>
                            </div>
                        )}
                    </header>
                )}

                {/* Only render actual dashboard content if we are not waiting for the owner to pick a branch */}
                {!isOwnerWithoutBranch && (
                    user.role === ROLES.MEMBER ? (
                        <MemberDashboard stats={stats} user={user} />
                    ) : user.role === ROLES.TRAINER ? (
                        <TrainerDashboard />
                    ) : user.role === ROLES.STAFF ? (
                        <StaffDashboard stats={stats} user={user} />
                    ) : (
                        <AdminDashboard stats={stats} />
                    )
                )}
            </div>

            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
}
