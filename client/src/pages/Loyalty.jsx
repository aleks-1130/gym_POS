import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Loyalty() {
    const { user } = useAuth();
    const [rewards, setRewards] = useState([]);
    const [totalPoints, setTotalPoints] = useState(0);

    // Adjustment Form State (Staff)
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [points, setPoints] = useState('');
    const [action, setAction] = useState('ADD');

    // Member State
    const [myPoints, setMyPoints] = useState(0);

    const isStaff = ['ADMIN', 'STAFF'].includes(user?.role);

    useEffect(() => {
        fetchRewards();
        if (isStaff) {
            fetchStats();
        } else {
            fetchMyPoints();
        }
    }, [user.role]);

    // Search members when query changes (Staff only)
    useEffect(() => {
        if (!isStaff) return;
        const searchMembers = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }
            try {
                const res = await axios.get('http://localhost:5000/api/members');
                const filtered = res.data.filter(m =>
                    m.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.email.toLowerCase().includes(searchQuery.toLowerCase())
                );
                setSearchResults(filtered.slice(0, 5));
            } catch (e) { console.error(e); }
        };
        const timeout = setTimeout(searchMembers, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const fetchRewards = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/loyalty/rewards');
            setRewards(res.data);
        } catch (e) { }
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/members');
            const total = res.data.reduce((sum, m) => sum + (m.points || 0), 0);
            setTotalPoints(total);
        } catch (e) { }
    };

    const fetchMyPoints = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${user.id}`);
            setMyPoints(res.data.points || 0);
        } catch (e) { }
    };

    const handleApply = async () => {
        if (!selectedMember || !points) return alert("Please select a member and enter points");

        try {
            await axios.post(`http://localhost:5000/api/members/${selectedMember.id}/points`, {
                points,
                type: action
            });
            alert("Points updated successfully!");
            setPoints('');
            setSelectedMember(null);
            setSearchQuery('');
            fetchStats(); // Refresh total
        } catch (e) {
            alert(e.response?.data?.error || "Failed to update points");
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Loyalty Program</h1>
                    <p className="text-text-muted mt-1">{isStaff ? "Manage points program" : "My Rewards & Points"}</p>
                </div>
                <div className="bg-surface px-6 py-3 rounded-2xl border border-white/5 shadow-sm">
                    <span className="block text-xs text-text-muted uppercase tracking-widest font-bold">{isStaff ? "Total Points Issued" : "My Balance"}</span>
                    <span className="text-2xl font-bold text-primary">{isStaff ? totalPoints.toLocaleString() : myPoints.toLocaleString()} pts</span>
                </div>
            </header>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Rewards List */}
                <div className={`bg-surface rounded-3xl border border-white/5 p-8 shadow-sm ${!isStaff ? 'lg:col-span-2' : ''}`}>
                    <h3 className="text-xl font-bold text-white mb-6">Active Rewards</h3>
                    <div className="space-y-4">
                        {rewards.length === 0 && <p className="text-text-muted">No rewards configured.</p>}
                        {rewards.map(reward => (
                            <div key={reward.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500">
                                        <span className="material-icons-round">card_giftcard</span>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">{reward.name}</h4>
                                        <p className="text-text-muted text-xs font-medium">{reward.cost} Points</p>
                                    </div>
                                </div>
                                {isStaff && (
                                    <button className="text-text-muted hover:text-primary transition-colors">
                                        <span className="material-icons-round">edit</span>
                                    </button>
                                )}
                                {!isStaff && (
                                    <button
                                        disabled={myPoints < reward.cost}
                                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${myPoints >= reward.cost ? 'bg-primary text-white hover:bg-orange-600 shadow-lg shadow-primary/20' : 'bg-white/5 text-text-muted cursor-not-allowed'}`}
                                    >
                                        Redeem
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Manual Adjustment (Staff Only) */}
                {isStaff && (
                    <div className="bg-surface rounded-3xl border border-white/5 p-8 h-fit shadow-sm">
                        <h3 className="text-xl font-bold text-white mb-6">Manually Adjust Points</h3>
                        <div className="space-y-4 relative">
                            {/* Member Search */}
                            <div className="relative">
                                <label className="block text-xs text-text-secondary font-bold mb-1">Member</label>
                                {selectedMember ? (
                                    <div className="flex items-center justify-between bg-primary/10 p-3 rounded-xl border border-primary/20">
                                        <div>
                                            <span className="block text-white font-bold text-sm">{selectedMember.firstName} {selectedMember.lastName}</span>
                                            <span className="text-xs text-primary font-mono font-medium">Current Balance: {selectedMember.points} pts</span>
                                        </div>
                                        <button onClick={() => setSelectedMember(null)} className="text-text-muted hover:text-red-400 transition-colors">
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder-text-muted text-sm"
                                            placeholder="Search by name..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        {searchResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-2 bg-surfaceHighlight border border-white/10 rounded-xl shadow-xl overflow-hidden">
                                                {searchResults.map(m => (
                                                    <button key={m.id} onClick={() => { setSelectedMember(m); setSearchQuery(''); setSearchResults([]); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-text-secondary hover:text-white flex justify-between items-center transition-colors border-b border-white/5 last:border-0">
                                                        <span className="font-medium text-sm">{m.firstName} {m.lastName}</span>
                                                        <span className="text-xs text-primary font-mono font-bold">{m.points} pts</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Action</label>
                                    <div className="relative">
                                        <select
                                            value={action}
                                            onChange={e => setAction(e.target.value)}
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none appearance-none transition-all"
                                        >
                                            <option value="ADD">Add Points</option>
                                            <option value="REDEEM">Redeem Reward</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                            <span className="material-icons-round text-text-muted">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Points</label>
                                    <input
                                        type="number"
                                        value={points}
                                        onChange={e => setPoints(e.target.value)}
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder-text-muted"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <button onClick={handleApply} className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-primary/20">
                                Apply Changes
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
