import { useConfirm } from '../../context/ConfirmContext';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { REWARD_CATEGORIES } from '../../constants/categories';

export default function TrainerLoyalty() {
    const { alert: showAlert } = useConfirm();
    const [rewards, setRewards] = useState([]);
    const [orders, setOrders] = useState([]);
    const [persistedPoints, setPersistedPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            try {
                
                

                const [rewardsRes, ordersRes, trainerRes] = await Promise.all([
                    axios.get('/api/loyalty/rewards', { headers }),
                    axios.get('/api/members/orders', { headers }),
                    axios.get('/api/trainer/me', { headers })
                ]);

                setRewards(rewardsRes.data || []);
                setOrders(ordersRes.data || []);
                setPersistedPoints(Number(trainerRes?.data?.loyaltyPoints || 0));
            } catch (e) {
                console.error('Failed to fetch trainer loyalty data', e);
                const fallbackRewards = [
                    { id: 1, name: 'Free Protein Shake', cost: 500, category: REWARD_CATEGORIES.SUPPLEMENT, imageUrl: '', description: 'A delicious protein shake.' },
                    { id: 2, name: 'Gym T-Shirt', cost: 1500, category: REWARD_CATEGORIES.APPAREL, imageUrl: '', description: 'Comfortable gym t-shirt.' },
                    { id: 3, name: 'Premium Gym Bag', cost: 2500, category: REWARD_CATEGORIES.MERCHANDISE, imageUrl: '', description: 'Durable and spacious gym bag.' }
                ];
                setRewards(fallbackRewards);
                setOrders([]);
                setPersistedPoints(0);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const completedOrders = useMemo(
        () => orders.filter((o) => String(o.status || '').toUpperCase() === 'COMPLETED'),
        [orders]
    );

    const loyaltyPoints = persistedPoints;

    const totalSpend = useMemo(
        () => completedOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
        [completedOrders]
    );

    const categories = ['all', ...Object.values(REWARD_CATEGORIES)];
    const filteredRewards = filter === 'all' ? rewards : rewards.filter((r) => r.category === filter);

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
        <div className="space-y-4 sm:space-y-6">
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Trainer Rewards</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">Earn points from Trainer Shop purchases and redeem rewards</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>
                    <div className="relative flex justify-between items-center">
                        <div>
                            <p className="text-xs sm:text-sm font-medium opacity-90 mb-1">Available Points</p>
                            <h2 className="text-4xl sm:text-5xl font-black">{loyaltyPoints.toLocaleString()}</h2>
                            <p className="text-xs opacity-80 mt-2">From completed trainer purchases</p>
                        </div>
                        <span className="material-icons-round text-6xl sm:text-7xl opacity-20">card_giftcard</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-[10px] sm:text-xs mb-1">Completed Orders</p>
                        <p className="text-white text-lg sm:text-2xl font-bold">{completedOrders.length}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-[10px] sm:text-xs mb-1">Total Spend</p>
                        <p className="text-primary text-lg sm:text-2xl font-bold">PHP {totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`px-4 py-2.5 rounded-full font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${filter === cat ? 'bg-primary text-background' : 'bg-surface text-text-secondary border border-white/10 hover:border-primary/30'}`}
                    >
                        {cat === 'all' ? 'All Rewards' : cat}
                    </button>
                ))}
            </div>

            {filteredRewards.length === 0 ? (
                <div className="text-center py-16">
                    <span className="material-icons-round text-5xl text-text-muted opacity-50 block mb-3">card_giftcard</span>
                    <p className="text-text-muted text-sm">No rewards in this category</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {filteredRewards.map((reward) => {
                        const canRedeem = loyaltyPoints >= Number(reward.cost || 0);
                        return (
                            <div
                                key={reward.id}
                                className={`rounded-xl sm:rounded-2xl border overflow-hidden flex flex-col transition-all group ${canRedeem ? 'bg-surface border-white/5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10' : 'bg-black/40 border-white/5 opacity-60'}`}
                            >
                                <div className="aspect-square bg-white/5 overflow-hidden relative">
                                    {reward.imageUrl ? (
                                        <img src={reward.imageUrl} alt={reward.name} className={`w-full h-full object-cover ${canRedeem ? 'group-hover:scale-110 transition-transform duration-300' : ''}`} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-icons-round text-5xl text-white/10">card_giftcard</span>
                                        </div>
                                    )}

                                    {reward.category && (
                                        <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-md">
                                            <span className="text-white/90 text-xs font-bold">{reward.category}</span>
                                        </div>
                                    )}

                                    {!canRedeem && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                            <div className="text-center">
                                                <span className="material-icons-round text-4xl text-white/80 block mb-1">lock</span>
                                                <p className="text-white font-bold text-xs">Locked</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 sm:p-4 flex flex-col flex-1">
                                    <h3 className="font-bold text-white text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{reward.name}</h3>
                                    {reward.description && <p className="text-text-muted text-xs line-clamp-1 mb-3 flex-1">{reward.description}</p>}

                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`material-icons-round text-lg ${canRedeem ? 'text-yellow-400' : 'text-text-muted'}`}>card_giftcard</span>
                                            <span className={`font-bold text-sm ${canRedeem ? 'text-yellow-400' : 'text-text-muted'}`}>{reward.cost} pts</span>
                                        </div>
                                        {canRedeem && <span className="text-green-400 text-xs font-bold">Available</span>}
                                    </div>

                                    <button
                                        onClick={() => showAlert({ title: 'Redeem at Front Desk', message: 'Reward redemption for trainers will be processed by front desk. Please show this reward selection there.', type: 'info' })}
                                        disabled={!canRedeem}
                                        className={`w-full py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-95 ${canRedeem ? 'bg-primary text-background hover:brightness-110' : 'bg-white/5 text-text-muted cursor-not-allowed'}`}
                                    >
                                        {canRedeem ? 'Redeem at Front Desk' : 'Locked'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

