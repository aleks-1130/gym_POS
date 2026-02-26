import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { REWARD_CATEGORIES } from '../../constants/categories';

export default function Rewards() {
    const { user } = useAuth();
    const [rewards, setRewards] = useState([]);
    const [myPoints, setMyPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedReward, setSelectedReward] = useState(null);
    const [showRedeemModal, setShowRedeemModal] = useState(false);

    useEffect(() => {
        fetchRewards();
        fetchMyPoints();
    }, []);

    const fetchRewards = async () => {
        try {
            const res = await axios.get('/api/loyalty/rewards');
            setRewards(res.data);
        } catch (e) {
            console.error("Failed to fetch rewards", e);
            // Using hardcoded rewards data for demonstration with REWARD_CATEGORIES if API fails
            const dummyRewards = [
                { id: 1, name: "Free Protein Shake", cost: 500, category: REWARD_CATEGORIES.SUPPLEMENT, imageUrl: "https://via.placeholder.com/150/FFD700/000000?text=Shake", description: "A delicious protein shake." },
                { id: 2, name: "Gym T-Shirt", cost: 1500, category: REWARD_CATEGORIES.APPAREL, imageUrl: "https://via.placeholder.com/150/87CEEB/000000?text=T-Shirt", description: "Comfortable gym t-shirt." },
                { id: 3, name: "Personal Training Session", cost: 3000, category: REWARD_CATEGORIES.EXPERIENCE, imageUrl: "https://via.placeholder.com/150/90EE90/000000?text=PT+Session", description: "One-on-one training with an expert." },
                { id: 4, name: "Water Bottle", cost: 800, category: REWARD_CATEGORIES.MERCHANDISE, imageUrl: "https://via.placeholder.com/150/D3D3D3/000000?text=Bottle", description: "Stay hydrated with our branded bottle." },
                { id: 5, name: "Gym Bag", cost: 2500, category: REWARD_CATEGORIES.MERCHANDISE, imageUrl: "https://via.placeholder.com/150/F08080/000000?text=Gym+Bag", description: "Spacious and durable gym bag." },
                { id: 6, name: "1 Month Membership", cost: 5000, category: REWARD_CATEGORIES.EXPERIENCE, imageUrl: "https://via.placeholder.com/150/ADD8E6/000000?text=Membership", description: "Enjoy a full month of gym access." },
            ];
            setRewards(dummyRewards);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyPoints = async () => {
        try {
            const res = await axios.get(`/api/members/${user.id}`);
            setMyPoints(res.data.points || 0);
        } catch (e) {
            console.error("Failed to fetch points", e);
            setMyPoints(0); // Ensure points is 0 on error
        }
    };

    const handleRedeem = async (reward) => {
        if (myPoints < reward.cost) {
            alert("Insufficient points!");
            return;
        }
        try {
            await axios.post(`/api/loyalty/redeem/${reward.id}`);
            alert("Reward redeemed successfully!");
            fetchMyPoints();
            fetchRewards();
            setShowRedeemModal(false);
        } catch (e) {
            alert("Failed to redeem reward");
        }
    };

    const categories = ['all', ...Object.values(REWARD_CATEGORIES)];
    const filteredRewards = filter === 'all'
        ? rewards
        : rewards.filter(r => r.category === filter);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading rewards...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24 px-4 sm:px-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
            {/* Header with Points Balance */}
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Rewards Store</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">Earn & redeem points for amazing rewards</p>
                </div>

                {/* Points Card */}
                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>
                    <div className="relative flex justify-between items-center">
                        <div>
                            <p className="text-xs sm:text-sm font-medium opacity-90 mb-1">Available Points</p>
                            <h2 className="text-4xl sm:text-5xl font-black">{myPoints.toLocaleString()}</h2>
                            <p className="text-xs opacity-80 mt-2">Ready to redeem amazing rewards</p>
                        </div>
                        <span className="material-icons-round text-6xl sm:text-7xl opacity-20">card_giftcard</span>
                    </div>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`px-4 py-2.5 rounded-full font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${filter === cat
                            ? 'bg-primary text-background'
                            : 'bg-surface text-text-secondary border border-white/10 hover:border-primary/30'
                            }`}
                    >
                        {cat === 'all' ? 'All Rewards' : cat}
                    </button>
                ))}
            </div>

            {/* Rewards Grid */}
            {filteredRewards.length === 0 ? (
                <div className="text-center py-16">
                    <span className="material-icons-round text-5xl text-text-muted opacity-50 block mb-3">card_giftcard</span>
                    <p className="text-text-muted text-sm">No rewards in this category</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {filteredRewards.map(reward => {
                        const canRedeem = myPoints >= reward.cost;
                        return (
                            <div
                                key={reward.id}
                                className={`rounded-xl sm:rounded-2xl border overflow-hidden flex flex-col transition-all group ${canRedeem
                                    ? 'bg-surface border-white/5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10'
                                    : 'bg-black/40 border-white/5 opacity-60'
                                    }`}
                            >
                                {/* Reward Image */}
                                <div className="aspect-square bg-white/5 overflow-hidden relative">
                                    {reward.imageUrl ? (
                                        <img
                                            src={reward.imageUrl}
                                            alt={reward.name}
                                            className={`w-full h-full object-cover ${canRedeem ? 'group-hover:scale-110 transition-transform duration-300' : ''
                                                }`}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-icons-round text-5xl text-white/10">card_giftcard</span>
                                        </div>
                                    )}

                                    {/* Category Badge */}
                                    {reward.category && (
                                        <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-md">
                                            <span className="text-white/90 text-xs font-bold">{reward.category}</span>
                                        </div>
                                    )}

                                    {/* Locked Badge */}
                                    {!canRedeem && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                            <div className="text-center">
                                                <span className="material-icons-round text-4xl text-white/80 block mb-1">lock</span>
                                                <p className="text-white font-bold text-xs">Locked</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Reward Info */}
                                <div className="p-3 sm:p-4 flex flex-col flex-1">
                                    <h3 className="font-bold text-white text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
                                        {reward.name}
                                    </h3>

                                    {/* Description */}
                                    {reward.description && (
                                        <p className="text-text-muted text-xs line-clamp-1 mb-3 flex-1">
                                            {reward.description}
                                        </p>
                                    )}

                                    {/* Points Cost */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`material-icons-round text-lg ${canRedeem ? 'text-yellow-400' : 'text-text-muted'}`}>
                                                card_giftcard
                                            </span>
                                            <span className={`font-bold text-sm ${canRedeem ? 'text-yellow-400' : 'text-text-muted'}`}>
                                                {reward.cost} pts
                                            </span>
                                        </div>
                                        {myPoints >= reward.cost && (
                                            <span className="text-green-400 text-xs font-bold">Available</span>
                                        )}
                                    </div>

                                    {/* Redeem Button */}
                                    <button
                                        onClick={() => {
                                            setSelectedReward(reward);
                                            setShowRedeemModal(true);
                                        }}
                                        disabled={!canRedeem}
                                        className={`w-full py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-95 ${canRedeem
                                            ? 'bg-primary text-background hover:brightness-110'
                                            : 'bg-white/5 text-text-muted cursor-not-allowed'
                                            }`}
                                    >
                                        {canRedeem ? 'Redeem' : 'Locked'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* How to Earn Section */}
            <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-white/5 mt-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-4">How to Earn Points</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">shopping_bag</span>
                        </div>
                        <div>
                            <p className="text-white text-xs sm:text-sm font-bold">Shop Purchases</p>
                            <p className="text-text-muted text-xs">1 point per $1 spent</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">fitness_center</span>
                        </div>
                        <div>
                            <p className="text-white text-xs sm:text-sm font-bold">Class Attendance</p>
                            <p className="text-text-muted text-xs">Bonus points per class</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">star</span>
                        </div>
                        <div>
                            <p className="text-white text-xs sm:text-sm font-bold">Special Promotions</p>
                            <p className="text-text-muted text-xs">Seasonal bonus opportunities</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">person</span>
                        </div>
                        <div>
                            <p className="text-white text-xs sm:text-sm font-bold">Referrals</p>
                            <p className="text-text-muted text-xs">Bonus for referrals</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Redeem Confirmation Modal */}
            {showRedeemModal && selectedReward && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center p-4" onClick={() => setShowRedeemModal(false)}>
                    <div
                        className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white">Redeem Reward</h2>
                            <button
                                onClick={() => setShowRedeemModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <span className="material-icons-round text-white text-xl">close</span>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 space-y-4">
                            {/* Reward Preview */}
                            <div className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
                                {selectedReward.imageUrl && (
                                    <img src={selectedReward.imageUrl} alt={selectedReward.name} className="w-full h-48 object-cover" />
                                )}
                                <div className="p-4">
                                    <h3 className="font-bold text-white text-lg mb-1">{selectedReward.name}</h3>
                                    <p className="text-text-muted text-sm mb-3">{selectedReward.description}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons-round text-yellow-400">card_giftcard</span>
                                        <span className="text-yellow-400 font-bold text-lg">{selectedReward.cost} points</span>
                                    </div>
                                </div>
                            </div>

                            {/* Confirmation Message */}
                            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                                <p className="text-text-muted text-sm mb-2">Current Points</p>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-white font-bold text-2xl">{myPoints}</p>
                                        <p className="text-text-muted text-xs mt-1">After: {myPoints - selectedReward.cost}</p>
                                    </div>
                                    <span className="material-icons-round text-primary text-3xl">check_circle</span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-white/10 p-5 bg-background space-y-3">
                            <button
                                onClick={() => handleRedeem(selectedReward)}
                                className="w-full py-3.5 bg-primary text-background rounded-xl font-bold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                <span className="material-icons-round text-xl">check_circle</span>
                                Confirm Redeem
                            </button>
                            <button
                                onClick={() => setShowRedeemModal(false)}
                                className="w-full py-3 bg-white/5 text-white rounded-xl font-medium text-sm hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
