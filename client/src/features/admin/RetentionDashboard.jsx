import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function RetentionDashboard() {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // ALL, HIGH, MEDIUM, EXPIRING

    useEffect(() => {
        fetchRetentionData();
    }, []);

    const fetchRetentionData = async () => {
        try {
                        const res = await axios.get('/api/analytics/retention');
            setMembers(res.data);
        } catch (error) {
            console.error("Failed to fetch retention data", error);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (risk) => {
        switch (risk) {
            case 'CRITICAL': return 'text-red-600 bg-red-100 border-red-200';
            case 'HIGH': return 'text-orange-600 bg-orange-100 border-orange-200';
            case 'MEDIUM': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
            default: return 'text-gray-600 bg-gray-100 border-gray-200';
        }
    };

    const filteredMembers = filter === 'ALL'
        ? members
        : members.filter(m => filter === 'EXPIRING' ? m.daysToExpiry <= 7 : m.risk === filter);

    const stats = {
        total: members.length,
        highRisk: members.filter(m => m.risk === 'HIGH' || m.risk === 'CRITICAL').length,
        expiring: members.filter(m => m.daysToExpiry <= 7).length
    };

    if (loading) return <div className="text-white p-8">Loading Retention Radar...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <header>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span className="material-icons-round text-red-500">radar</span>
                    Retention Radar
                </h1>
                <p className="text-text-muted mt-1">Identify and save at-risk members before they churn.</p>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider">Total At Risk</p>
                    <p className="text-3xl font-bold text-white mt-2">{stats.total}</p>
                </div>
                <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider">High Churn Probability</p>
                    <p className="text-3xl font-bold text-red-400 mt-2">{stats.highRisk}</p>
                    <p className="text-xs text-text-muted mt-1">Absent &gt; 14 Days</p>
                </div>
                <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider">Expiring Soon</p>
                    <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.expiring}</p>
                    <p className="text-xs text-text-muted mt-1">Expires &lt; 7 Days</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                <div className="p-6 border-b border-white/5 flex gap-4 bg-white/5">
                    {['ALL', 'HIGH', 'MEDIUM', 'EXPIRING'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-primary text-white shadow-lg' : 'bg-white/5 text-text-muted hover:bg-white/10'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-text-muted text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-6">Member</th>
                                <th className="p-6">Last Visit</th>
                                <th className="p-6">Frequency</th>
                                <th className="p-6">Risk Factors</th>
                                <th className="p-6 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredMembers.length === 0 && (
                                <tr><td colSpan="4" className="p-12 text-center text-text-muted">No members found in this category.</td></tr>
                            )}
                            {filteredMembers.map(member => (
                                <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-surfaceHighlight flex items-center justify-center text-white font-bold border border-white/10 overflow-hidden">
                                                {member.imageUrl ? <img src={member.imageUrl} className="w-full h-full object-cover" /> : member.name[0]}
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm">{member.name}</p>
                                                <p className="text-xs text-text-muted">{member.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-white text-sm font-medium">{new Date(member.lastVisit).toLocaleDateString()}</p>
                                        <p className="text-xs text-text-muted">{member.daysSinceVisit} days ago</p>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2">
                                            <span className={`material-icons-round text-lg ${member.visitsPerWeek >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {member.visitsPerWeek >= 2 ? 'trending_up' : 'trending_down'}
                                            </span>
                                            <div>
                                                <p className="text-white text-sm font-bold">{member.visitsPerWeek} / wk</p>
                                                <p className="text-xs text-text-muted">Avg Frequency</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-wrap gap-2">
                                            {member.reasons.map((r, i) => (
                                                <span key={i} className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${member.risk === 'HIGH' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <button
                                            onClick={() => window.open(`https://wa.me/${member.phone?.replace(/[^0-9]/g, '')}`, '_blank')}
                                            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-emerald-500/20"
                                        >
                                            WhatsApp
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
