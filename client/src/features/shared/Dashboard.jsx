import React from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
// import { useReactToPrint } from 'react-to-print';
// import { useRef } from 'react';
import { ROLES } from '../../constants/roles';
import AdminDashboard from '../admin/AdminDashboard';
import MemberDashboard from '../member/MemberDashboard';
import StaffDashboard from '../staff/StaffDashboard';
import TrainerDashboard from '../trainer/TrainerDashboard';
// import DashboardReport from '../../components/dashboard/DashboardReport';

export default function Dashboard() {
    const { user } = useAuth();
    // const componentRef = useRef();

    // Open Report in New Tab
    const handlePrint = () => {
        window.open('/admin/report', '_blank');
    };

    const { data: stats, isLoading: loading, error } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const res = await axios.get('/api/dashboard/stats');
            return res.data;
        },
        retry: 1,
        refetchInterval: 60000 // Refresh every minute
    });

    if (loading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white p-8 animate-pulse text-lg font-medium">Loading Dashboard...</div>
        </div>
    );

    if (error) return (
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

    const isStaff = user.role === ROLES.STAFF;
    const isAdmin = user.role === ROLES.ADMIN || user.role === ROLES.OWNER;

    return (
        <div className="space-y-8 animate-fade-in">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-text-muted mt-1">Welcome back, {user?.name || 'User'}</p>
                </div>
                {/* Role-specific quick actions */}
                {isAdmin && (
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button
                            onClick={handlePrint}
                            className="flex-1 sm:flex-none px-4 py-2 bg-surfaceHighlight border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                        >
                            Download Report
                        </button>
                        <button className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                            Add Member
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

            {user.role === ROLES.MEMBER ? (
                <MemberDashboard stats={stats} user={user} />
            ) : user.role === ROLES.TRAINER ? (
                <TrainerDashboard />
            ) : user.role === ROLES.STAFF ? (
                <StaffDashboard stats={stats} user={user} />
            ) : (
                <AdminDashboard stats={stats} />
            )}

            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
}
