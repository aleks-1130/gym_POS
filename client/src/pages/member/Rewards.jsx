import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function Rewards() {
    const { user } = useAuth();
    const [rewards, setRewards] = useState([]);
    const [myPoints, setMyPoints] = useState(0);

    useEffect(() => {
        fetchRewards();
        fetchMyPoints();
    }, []);

    const fetchRewards = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/loyalty/rewards');
            setRewards(res.data);
        } catch (e) { }
    };

    const fetchMyPoints = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${user.id}`);
            setMyPoints(res.data.points || 0);
        } catch (e) { }
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Loyalty Program</h1>
                    <p className="text-text-muted mt-1">My Rewards & Points</p>
                </div>
                <div className="bg-surface px-6 py-3 rounded-2xl border border-white/5 shadow-sm">
                    <span className="block text-xs text-text-muted uppercase tracking-widest font-bold">My Balance</span>
                    <span className="text-2xl font-bold text-primary">{myPoints.toLocaleString()} pts</span>
                </div>
            </header>

            <div className="grid lg:grid-cols-2 gap-8">
                <div className="lg:col-span-2 bg-surface rounded-3xl border border-white/5 p-8 shadow-sm">
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
                                <button
                                    disabled={myPoints < reward.cost}
                                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${myPoints >= reward.cost ? 'bg-primary text-white hover:bg-orange-600 shadow-lg shadow-primary/20' : 'bg-white/5 text-text-muted cursor-not-allowed'}`}
                                >
                                    Redeem
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
