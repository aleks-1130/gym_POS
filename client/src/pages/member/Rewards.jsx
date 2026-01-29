import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function Rewards() {
    const { user } = useAuth();
    const [rewards, setRewards] = useState([]);
    const [myPoints, setMyPoints] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRewards();
        fetchMyPoints();
    }, []);

    const fetchRewards = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/loyalty/rewards');
            setRewards(res.data);
        } catch (e) {
            console.error("Failed to fetch rewards");
        } finally {
            setLoading(false);
        }
    };

    const fetchMyPoints = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${user.id}`);
            setMyPoints(res.data.points || 0);
        } catch (e) {
            console.error("Failed to fetch points");
        }
    };

    if (loading) return <div className="text-white p-6 text-center">Loading rewards...</div>;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header with Points Balance */}
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Rewards</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">Earn & redeem points</p>
                </div>
                
                {/* Points Card */}
                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-lg">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs sm:text-sm font-medium opacity-90 mb-1">Available Points</p>
                            <h2 className="text-3xl sm:text-4xl font-black">{myPoints.toLocaleString()}</h2>
                            <p className="text-xs opacity-80 mt-2">Ready to redeem</p>
                        </div>
                        <span className="material-icons-round text-5xl sm:text-6xl opacity-30">card_giftcard</span>
                    </div>
                </div>
            </div>

            {/* Rewards List */}
            <div className="space-y-3">
                <h3 className="text-lg font-bold text-white">Available Rewards</h3>
                
                {rewards.length === 0 ? (
                    <div className="text-center py-12">
                        <span className="material-icons-round text-4xl text-text-muted opacity-50 block mb-2">card_giftcard</span>
                        <p className="text-text-muted">No rewards available</p>
                    </div>
                ) : (
                    <div className="space-y-2 sm:space-y-3">
                        {rewards.map(reward => {
                            const canRedeem = myPoints >= reward.cost;
                            return (
                                <div
                                    key={reward.id}
                                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                        canRedeem
                                            ? 'bg-surface border-white/10 hover:border-primary/50'
                                            : 'bg-white/5 border-white/5 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            canRedeem ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-text-muted'
                                        }`}>
                                            <span className="material-icons-round">card_giftcard</span>
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-bold text-sm sm:text-base line-clamp-1">{reward.name}</h4>
                                            <p className="text-text-muted text-xs sm:text-sm">
                                                <span className={`font-bold ${canRedeem ? 'text-primary' : 'text-text-muted'}`}>
                                                    {reward.cost} pts
                                                </span>
                                                {reward.description && (
                                                    <span className="ml-2 line-clamp-1">{reward.description}</span>
                                                )}
                                            </p>
                                        </div>

                                        <button
                                            disabled={!canRedeem}
                                            className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-all active:scale-95 ${
                                                canRedeem
                                                    ? 'bg-primary text-background hover:brightness-110'
                                                    : 'bg-white/5 text-text-muted cursor-not-allowed'
                                            }`}
                                        >
                                            Redeem
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* How to Earn Section */}
            <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-white/5">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3">How to Earn Points</h3>
                <div className="space-y-2 text-xs sm:text-sm text-text-secondary">
                    <div className="flex gap-3">
                        <span className="material-icons-round text-sm text-primary flex-shrink-0">check_circle</span>
                        <span>1 point per $1 spent in the shop</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="material-icons-round text-sm text-primary flex-shrink-0">check_circle</span>
                        <span>Bonus points for completing classes</span>
                    </div>
                    <div className="flex gap-3">
                        <span className="material-icons-round text-sm text-primary flex-shrink-0">check_circle</span>
                        <span>Special promotions throughout the year</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
