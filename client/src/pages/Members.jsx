import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Members() {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/members');
            setMembers(res.data);
        } catch (e) {
            console.error("Failed to fetch members");
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = members.filter(m =>
        m.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'FREEZED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'EXPIRED': return 'bg-red-500/10 text-red-400 border-red-500/20';
            default: return 'bg-white/5 text-text-muted border-white/10';
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Members</h1>
                    <p className="text-text-muted mt-1">Manage memberships and access</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search members..."
                            className="bg-surfaceHighlight border border-white/10 pl-10 pr-4 py-2 rounded-xl text-sm focus:ring-primary focus:border-primary outline-none w-64 text-white shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <span className="material-icons-round absolute left-3 top-2.5 text-text-muted text-[18px]">search</span>
                    </div>
                    <button onClick={() => navigate('/members/new')} className="bg-primary hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 transition-colors">
                        <span className="material-icons-round">person_add</span>
                        New Member
                    </button>
                </div>
            </header>

            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-text-muted text-sm bg-white/5">
                                <th className="p-6 font-medium">Member</th>
                                <th className="p-6 font-medium">Plan</th>
                                <th className="p-6 font-medium">Status</th>
                                <th className="p-6 font-medium">Join Date</th>
                                <th className="p-6 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredMembers.map(member => (
                                <tr
                                    key={member.id}
                                    onClick={() => navigate(`/members/${member.id}`)}
                                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                                >
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm border border-primary/20">
                                                {member.firstName[0]}{member.lastName[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{member.firstName} {member.lastName}</p>
                                                <p className="text-xs text-text-muted">{member.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 text-text-secondary font-medium">
                                        {member.plan?.name || "None"}
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(member.status)}`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="p-6 text-text-secondary text-sm">
                                        {new Date(member.startDate).toLocaleDateString()}
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className="material-icons-round text-text-muted group-hover:text-primary transition-colors">chevron_right</span>
                                    </td>
                                </tr>
                            ))}
                            {filteredMembers.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-text-muted">
                                        No members found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
