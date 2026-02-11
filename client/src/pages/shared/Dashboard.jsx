import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { ROLES } from '../../constants/roles';
import AdminDashboard from '../admin/AdminDashboard';
import MemberDashboard from '../member/MemberDashboard';
import StaffDashboard from '../staff/StaffDashboard';
import TrainerDashboard from '../trainer/TrainerDashboard';

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                if (!token) return;

                const res = await axios.get('http://localhost:5000/api/dashboard/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div className="text-white p-8">Loading Dashboard...</div>;

    const isStaff = user.role === ROLES.STAFF;
    const isAdmin = user.role === ROLES.ADMIN || user.role === ROLES.OWNER;

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-text-muted mt-1">Welcome back, {user?.name || 'User'}</p>
                </div>
                {/* Role-specific quick actions */}
                {isAdmin && (
                    <div className="flex gap-4">
                        <button className="px-4 py-2 bg-surfaceHighlight border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                            Download Report
                        </button>
                        <button className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                            Add Member
                        </button>
                    </div>
                )}
                {isStaff && (
                    <div className="flex gap-4">
                        <a href="/payments" className="px-4 py-2 bg-surfaceHighlight border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                            Open POS
                        </a>
                        <a href="/members" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
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
        </div>
    );
}
