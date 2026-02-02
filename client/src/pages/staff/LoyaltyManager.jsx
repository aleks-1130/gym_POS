import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function LoyaltyManager() {
    const [rewards, setRewards] = useState([]);
    const [members, setMembers] = useState([]); // All members (for search)
    const [filteredMembers, setFilteredMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [totalPoints, setTotalPoints] = useState(0); // Friend's Feature

    // Management State
    const [showManageModal, setShowManageModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false); // New: Manual Adjust Modal
    const [editReward, setEditReward] = useState(null); // If set, we are editing this reward
    const [rewardFormData, setRewardFormData] = useState({ name: '', cost: '', category: 'MERCHANDISE', description: '', imageUrl: '' });

    // Manual Adjust State (Friend's Feature)
    const [manualPoints, setManualPoints] = useState('');
    const [manualAction, setManualAction] = useState('ADD');

    useEffect(() => {
        fetchRewards();
        fetchMembers();
    }, []);

    useEffect(() => {
        // Filter members
        if (!searchQuery) {
            setFilteredMembers(members.slice(0, 50)); // Limit initial view
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = members.filter(m =>
                m.firstName.toLowerCase().includes(query) ||
                m.lastName.toLowerCase().includes(query) ||
                m.email.toLowerCase().includes(query)
            );
            setFilteredMembers(filtered.slice(0, 50));
        }
    }, [searchQuery, members]);

    const fetchRewards = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/loyalty/rewards');
            setRewards(res.data);
        } catch (e) {
            console.error("Failed to fetch rewards", e);
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/members');
            setMembers(res.data);
            setFilteredMembers(res.data.slice(0, 50));

            // Calculate Total Stats (Friend's Feature)
            const total = res.data.reduce((sum, m) => sum + (m.points || 0), 0);
            setTotalPoints(total);
        } catch (e) {
            console.error("Failed to fetch members", e);
        }
    };

    // --- REDEMPTION LOGIC ---
    const handleRedeem = async (reward) => {
        if (!selectedMember) return alert("Please select a member first.");

        if (selectedMember.points < reward.cost) {
            return alert(`Insufficient points! ${selectedMember.firstName} needs ${reward.cost - selectedMember.points} more points.`);
        }

        if (!window.confirm(`Redeem '${reward.name}' for ${reward.cost} points?`)) return;

        try {
            await axios.post(`http://localhost:5000/api/members/${selectedMember.id}/points`, {
                points: reward.cost,
                type: 'REDEEM'
            });

            // Refresh member data locally
            const updatedMember = { ...selectedMember, points: selectedMember.points - reward.cost };
            setSelectedMember(updatedMember);

            // Update in the big list too so search results stay fresh
            setMembers(prev => prev.map(m => m.id === updatedMember.id ? updatedMember : m));
            setTotalPoints(prev => prev - reward.cost); // Update stat

            alert(`🎉 Successfully redeemed ${reward.name}!`);
        } catch (e) {
            alert(e.response?.data?.error || "Redemption failed");
        }
    };

    // --- MANUAL ADJUSTMENT (Friend's Feature Integrated) ---
    const handleManualAdjust = async (e) => {
        e.preventDefault();
        if (!selectedMember) return alert("Select a member first!");

        try {
            await axios.post(`http://localhost:5000/api/members/${selectedMember.id}/points`, {
                points: Number(manualPoints),
                type: manualAction
            });

            // Refresh Logic
            const impact = manualAction === 'ADD' ? Number(manualPoints) : -Number(manualPoints);
            const updatedMember = { ...selectedMember, points: selectedMember.points + impact };

            setSelectedMember(updatedMember);
            setMembers(prev => prev.map(m => m.id === updatedMember.id ? updatedMember : m));
            setTotalPoints(prev => prev + impact);

            alert("Points updated successfully!");
            setShowManualModal(false);
            setManualPoints('');
        } catch (e) {
            alert(e.response?.data?.error || "Failed updates");
        }
    };

    // --- REWARD MANAGEMENT ---
    const handleSaveReward = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...rewardFormData,
                cost: parseInt(rewardFormData.cost) || 0
            };

            if (editReward) {
                // Update
                await axios.put(`http://localhost:5000/api/loyalty/rewards/${editReward.id}`, payload);
            } else {
                // Create
                await axios.post('http://localhost:5000/api/loyalty/rewards', payload);
            }
            fetchRewards();
            setShowManageModal(false);
            setEditReward(null);
            setRewardFormData({ name: '', cost: '', category: 'MERCHANDISE', description: '', imageUrl: '' });
        } catch (e) {
            console.error(e);
            alert("Failed to save reward: " + (e.response?.data?.error || e.message));
        }
    };

    const handleDeleteReward = async (id) => {
        if (!window.confirm("Delete this reward?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/loyalty/rewards/${id}`);
            fetchRewards();
        } catch (e) {
            alert("Failed to delete reward");
        }
    };

    const openEdit = (reward) => {
        setEditReward(reward);
        setRewardFormData({ ...reward });
        setShowManageModal(true);
    };

    const openCreate = () => {
        setEditReward(null);
        setRewardFormData({ name: '', cost: '', category: 'MERCHANDISE', description: '', imageUrl: '' });
        setShowManageModal(true);
    };


    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white">Loyalty Redemption</h1>
                    <p className="text-text-muted mt-1">Select a member to redeem rewards</p>
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center gap-4">
                    <div className="bg-surface px-4 py-2 rounded-2xl border border-white/5 hidden lg:block">
                        <span className="block text-[10px] text-text-muted uppercase tracking-widest font-bold">Total Issued</span>
                        <span className="text-xl font-bold text-primary">{totalPoints.toLocaleString()} pts</span>
                    </div>

                    <button
                        onClick={() => { if (!selectedMember) return alert("Select a member first!"); setShowManualModal(true); }}
                        className="bg-surfaceHighlight hover:bg-white/10 text-white px-5 py-2.5 rounded-2xl font-bold border border-white/10 flex items-center gap-2 transition-all shadow-sm"
                    >
                        <span className="material-icons-round">tune</span>
                        Adjust Points
                    </button>

                    <button
                        onClick={() => setShowManageModal(true)}
                        className="bg-surface hover:bg-white/10 text-white px-5 py-2.5 rounded-2xl font-bold border border-white/10 flex items-center gap-2 transition-all shadow-sm"
                    >
                        <span className="material-icons-round">settings</span>
                        Manage Rewards
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-6 overflow-hidden">

                {/* LEFT: Member List */}
                <div className="w-1/3 flex flex-col bg-surface rounded-3xl border border-white/5 shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-round text-text-muted">search</span>
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                placeholder="Search member..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredMembers.map(member => (
                            <div
                                key={member.id}
                                onClick={() => setSelectedMember(member)}
                                className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedMember?.id === member.id
                                    ? 'bg-primary/20 border-primary/50 shadow-lg'
                                    : 'bg-transparent border-transparent hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className={`font-bold ${selectedMember?.id === member.id ? 'text-white' : 'text-text-secondary'}`}>
                                            {member.firstName} {member.lastName}
                                        </h4>
                                        <p className="text-xs text-text-muted">{member.email}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg font-mono font-bold text-sm ${selectedMember?.id === member.id ? 'bg-primary text-white' : 'bg-white/5 text-primary'
                                        }`}>
                                        {member.points} pts
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Rewards Shop */}
                <div className="w-2/3 flex flex-col bg-surface rounded-3xl border border-white/5 shadow-xl overflow-hidden relative">
                    {/* Overlay if no member selected */}
                    {!selectedMember && (
                        <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-8">
                            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <span className="material-icons-round text-4xl text-text-muted">person_search</span>
                            </div>
                            <h2 className="text-xl font-bold text-white">Select a Member</h2>
                            <p className="text-text-muted mt-2">Choose a member from the list to view their eligible rewards.</p>
                        </div>
                    )}

                    {/* Member Context Header (If selected) */}
                    {selectedMember && (
                        <div className="p-6 bg-gradient-to-r from-primary/20 to-orange-600/20 border-b border-primary/20 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30">
                                    {selectedMember.firstName[0]}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Hello, {selectedMember.firstName}!</h2>
                                    <p className="text-primary-300 font-medium">Ready to redeem your points?</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Available Balance</p>
                                <p className="text-4xl font-black text-white drop-shadow-md">{selectedMember.points}</p>
                            </div>
                        </div>
                    )}

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {rewards.map(reward => {
                            const canAfford = selectedMember && selectedMember.points >= reward.cost;
                            return (
                                <button
                                    key={reward.id}
                                    onClick={() => handleRedeem(reward)}
                                    disabled={!canAfford}
                                    className={`relative group border rounded-3xl overflow-hidden transition-all duration-300 flex flex-col h-72 ${canAfford
                                        ? 'bg-white/5 border-white/10 hover:border-primary/50 hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl'
                                        : 'bg-black/20 border-transparent opacity-50 grayscale'
                                        }`}
                                >
                                    <div className="h-32 w-full bg-black/40 relative shrink-0">
                                        {reward.imageUrl ? (
                                            <img src={reward.imageUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/10">
                                                <span className="material-icons-round text-5xl">redeem</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] font-bold text-white uppercase tracking-wider border border-white/10">
                                            {reward.category}
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col justify-between items-center text-center w-full">
                                        <div className="w-full px-1">
                                            <h3 className="text-white font-bold text-sm leading-snug mb-1 line-clamp-2 min-h-[2.5em] flex items-center justify-center">{reward.name}</h3>
                                            <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{reward.description}</p>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-center items-center gap-2 w-full shrink-0">
                                            <span className={`font-mono font-bold text-sm ${canAfford ? 'text-primary' : 'text-gray-500'}`}>
                                                {reward.cost} pts
                                            </span>
                                            {canAfford && (
                                                <span className="material-icons-round text-white/50 group-hover:text-white transition-colors text-sm">arrow_forward</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Manage Rewards Modal */}
            {showManageModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-8 animate-fade-in">
                    <div className="bg-surface w-full max-w-4xl h-[80vh] rounded-[32px] border border-white/10 shadow-2xl flex overflow-hidden">

                        {/* List Side */}
                        <div className="w-1/2 border-r border-white/10 flex flex-col bg-white/5">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">Manage Rewards</h2>
                                <button onClick={openCreate} className="bg-primary hover:bg-orange-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors">
                                    <span className="material-icons-round text-sm">add</span> New
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {rewards.map(r => (
                                    <div key={r.id} className="p-4 bg-surface border border-white/5 rounded-2xl flex justify-between items-center group hover:border-white/20 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {r.imageUrl && <img src={r.imageUrl} className="w-10 h-10 rounded-lg object-cover bg-black/20" alt="" />}
                                            <div>
                                                <h4 className="text-white font-bold text-sm">{r.name}</h4>
                                                <p className="text-text-muted text-xs">{r.cost} pts • {r.category}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEdit(r)} className="p-2 hover:bg-white/10 rounded-full text-blue-400">
                                                <span className="material-icons-round text-sm">edit</span>
                                            </button>
                                            <button onClick={() => handleDeleteReward(r.id)} className="p-2 hover:bg-white/10 rounded-full text-red-400">
                                                <span className="material-icons-round text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Edit Form Side */}
                        <div className="w-1/2 p-8 overflow-y-auto bg-surface relative">
                            <button
                                onClick={() => setShowManageModal(false)}
                                className="absolute top-6 right-6 text-text-muted hover:text-white transition-colors"
                            >
                                <span className="material-icons-round">close</span>
                            </button>

                            <h3 className="text-lg font-bold text-white mb-6">
                                {editReward ? 'Edit Reward' : 'Create New Reward'}
                            </h3>

                            <form onSubmit={handleSaveReward} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Name</label>
                                    <input
                                        required
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                        value={rewardFormData.name}
                                        onChange={e => setRewardFormData({ ...rewardFormData, name: e.target.value })}
                                        placeholder="e.g. Free Protein Shake"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Cost (Points)</label>
                                    <input
                                        required type="number"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                        value={rewardFormData.cost}
                                        onChange={e => setRewardFormData({ ...rewardFormData, cost: e.target.value })}
                                        placeholder="500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Category</label>
                                    <select
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all appearance-none"
                                        value={rewardFormData.category}
                                        onChange={e => setRewardFormData({ ...rewardFormData, category: e.target.value })}
                                    >
                                        <option value="MERCHANDISE">Merchandise</option>
                                        <option value="SUPPLEMENT">Supplement</option>
                                        <option value="APPAREL">Apparel</option>
                                        <option value="EXPERIENCE">Experience / Service</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Image URL</label>
                                    <input
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                        value={rewardFormData.imageUrl}
                                        onChange={e => setRewardFormData({ ...rewardFormData, imageUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Description</label>
                                    <textarea
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all h-24 resize-none"
                                        value={rewardFormData.description}
                                        onChange={e => setRewardFormData({ ...rewardFormData, description: e.target.value })}
                                        placeholder="Describe the reward..."
                                    />
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowManageModal(false)} className="px-6 py-3 rounded-xl font-bold text-text-muted hover:bg-white/5 transition-all">Cancel</button>
                                    <button type="submit" className="px-8 py-3 rounded-xl font-bold bg-primary hover:bg-orange-600 text-white shadow-lg shadow-primary/20 transition-all">
                                        {editReward ? 'Save Changes' : 'Create Reward'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Adjust Modal (Friend's Feature) */}
            {showManualModal && selectedMember && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-8 animate-fade-in">
                    <div className="bg-surface w-full max-w-md rounded-[32px] border border-white/10 shadow-2xl p-8">
                        <h3 className="text-xl font-bold text-white mb-6">Adjust Points for {selectedMember.firstName}</h3>
                        <form onSubmit={handleManualAdjust} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Action</label>
                                <select
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all appearance-none"
                                    value={manualAction}
                                    onChange={e => setManualAction(e.target.value)}
                                >
                                    <option value="ADD">Add Points (Bonus/Refund)</option>
                                    <option value="REDEEM">Redeem Points (Manual)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Amount</label>
                                <input
                                    required type="number"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                                    value={manualPoints}
                                    onChange={e => setManualPoints(e.target.value)}
                                    placeholder="e.g. 100"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowManualModal(false)} className="px-6 py-3 rounded-xl font-bold text-text-muted hover:bg-white/5 transition-all">Cancel</button>
                                <button type="submit" className="px-8 py-3 rounded-xl font-bold bg-primary hover:bg-orange-600 text-white shadow-lg shadow-primary/20 transition-all">
                                    Apply
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
