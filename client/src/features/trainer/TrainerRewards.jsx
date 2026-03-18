import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';
import { REWARD_CATEGORIES } from '../../constants/categories';
import DataTable from '../../components/common/DataTable';
import TrainerPageHeader from './components/TrainerPageHeader';

const mapMethodLabel = (method) => {
    const normalized = String(method || '').toUpperCase();
    if (normalized === 'COMMISSION_DEDUCTION') return 'Commission Deduction';
    if (normalized === 'GCASH') return 'GCash';
    if (normalized === 'MAYA') return 'Maya';
    if (normalized === 'CARD') return 'Card';
    if (normalized === 'CASH') return 'Cash';
    return method || 'Unknown';
};

const buildHistoryRows = (orders = []) =>
    (orders || [])
        .filter((order) => Number(order?.pointsAwarded || 0) > 0)
        .map((order) => {
            const earnedPoints = Number(order.pointsAwarded || 0);
            const isInApp = String(order.type || '').toUpperCase() === 'IN_APP_PURCHASE';
            const purchaseType = isInApp ? 'in-app purchase' : 'shop purchase';
            const methodLabel = mapMethodLabel(order.method);

            return {
                id: `earn-${order.id}`,
                createdAt: order.date || order.createdAt || new Date().toISOString(),
                type: 'EARNED',
                points: earnedPoints,
                description: `Earned from ${purchaseType} via ${methodLabel}`
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export default function TrainerRewards() {
    const { alert: showAlert } = useConfirm();
    const [rewards, setRewards] = useState([]);
    const [myPoints, setMyPoints] = useState(0);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('SHOP');
    const [selectedReward, setSelectedReward] = useState(null);
    const [showRedeemModal, setShowRedeemModal] = useState(false);

    useEffect(() => {
        const fetchTrainerRewardStore = async () => {
            try {
                const [rewardsRes, ordersRes, trainerRes] = await Promise.all([
                    axios.get('/api/loyalty/rewards'),
                    axios.get('/api/members/orders'),
                    axios.get('/api/trainer/me')
                ]);

                setRewards(rewardsRes.data || []);
                setMyPoints(Number(trainerRes?.data?.loyaltyPoints || 0));
                setHistory(buildHistoryRows(ordersRes.data || []));
            } catch (error) {
                console.error('Failed to fetch trainer rewards data', error);
                setRewards([
                    { id: 1, name: 'Free Protein Shake', cost: 500, category: REWARD_CATEGORIES.SUPPLEMENT, imageUrl: '', description: 'A delicious protein shake.' },
                    { id: 2, name: 'Gym T-Shirt', cost: 1500, category: REWARD_CATEGORIES.APPAREL, imageUrl: '', description: 'Comfortable gym t-shirt.' },
                    { id: 3, name: 'Premium Gym Bag', cost: 2500, category: REWARD_CATEGORIES.MERCHANDISE, imageUrl: '', description: 'Durable and spacious gym bag.' }
                ]);
                setMyPoints(0);
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTrainerRewardStore();
    }, []);

    const categories = useMemo(() => ['all', ...Object.values(REWARD_CATEGORIES)], []);
    const filteredRewards = useMemo(
        () => (filter === 'all' ? rewards : rewards.filter((reward) => reward.category === filter)),
        [filter, rewards]
    );

    const handleRedeem = async (reward) => {
        if (myPoints < Number(reward?.cost || 0)) {
            await showAlert({
                title: 'Insufficient Points',
                message: 'You do not have enough points for this reward.',
                type: 'warning'
            });
            return;
        }

        await showAlert({
            title: 'Redeem at Front Desk',
            message: `Please show "${reward.name}" at the front desk to process your trainer reward redemption.`,
            type: 'info'
        });
        setShowRedeemModal(false);
    };

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
        <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
            <TrainerPageHeader
                title="Rewards Store"
                subtitle="Earn points from trainer purchases and redeem rewards"
                icon="card_giftcard"
                className="border-white/10"
            />

            <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-lg overflow-hidden relative">
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>
                <div className="relative flex justify-between items-center">
                    <div>
                        <p className="text-xs sm:text-sm font-medium opacity-90 mb-1">Available Points</p>
                        <h2 className="text-4xl sm:text-5xl font-black">{myPoints.toLocaleString()}</h2>
                        <p className="text-xs opacity-80 mt-2">From completed trainer purchases</p>
                    </div>
                    <span className="material-icons-round text-6xl sm:text-7xl opacity-20">card_giftcard</span>
                </div>
            </div>

            <section className="space-y-3">
                <div className="grid grid-cols-3 gap-2 rounded-2xl p-1 bg-surface/80 border border-white/10 shadow-inner">
                    {[['SHOP', 'Shop'], ['COUPONS', 'Coupons'], ['HISTORY', 'History']].map(([tab, label]) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`relative py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${activeTab === tab
                            ? tab === 'COUPONS'
                                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                                : 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {label}
                        {tab === 'COUPONS' && activeTab === tab && (
                            <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-black/50" />
                        )}
                    </button>
                ))}
                </div>
            </section>

            {activeTab === 'SHOP' ? (
                <>
                    <div className="space-y-2">
                        <div className="sm:hidden">
                            <label className="block text-[11px] text-text-muted font-semibold mb-1">Category</label>
                            <select
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                                className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                            >
                                {categories.map((category) => (
                                    <option key={category} value={category} style={{ color: '#111', backgroundColor: '#fff' }}>
                                        {category === 'all' ? 'All Rewards' : category}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="hidden sm:grid grid-cols-5 gap-2">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setFilter(category)}
                                    className={`px-2 py-2 rounded-xl font-medium text-xs transition-all leading-tight ${
                                        filter === category
                                            ? 'bg-primary text-background'
                                            : 'bg-surface text-text-secondary border border-white/10 hover:border-primary/30'
                                    }`}
                                >
                                    {category === 'all' ? 'All Rewards' : category}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredRewards.length === 0 ? (
                        <div className="text-center py-16">
                            <span className="material-icons-round text-5xl text-text-muted opacity-50 block mb-3">card_giftcard</span>
                            <p className="text-text-muted text-sm">No rewards in this category</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {filteredRewards.map((reward) => {
                                const canRedeem = myPoints >= Number(reward.cost || 0);
                                return (
                                    <div
                                        key={reward.id}
                                        className={`rounded-xl sm:rounded-2xl border overflow-hidden flex flex-col transition-all group ${
                                            canRedeem
                                                ? 'bg-surface border-white/5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10'
                                                : 'bg-black/40 border-white/5 opacity-60'
                                        }`}
                                    >
                                        <div className="aspect-square bg-white/5 overflow-hidden relative">
                                            {reward.imageUrl ? (
                                                <img
                                                    src={reward.imageUrl}
                                                    alt={reward.name}
                                                    className={`w-full h-full object-cover ${canRedeem ? 'group-hover:scale-110 transition-transform duration-300' : ''}`}
                                                />
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

                                            {reward.description && (
                                                <p className="text-text-muted text-xs line-clamp-1 mb-3 flex-1">
                                                    {reward.description}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`material-icons-round text-lg ${canRedeem ? 'text-yellow-400' : 'text-text-muted'}`}>
                                                        card_giftcard
                                                    </span>
                                                    <span className={`font-bold text-sm ${canRedeem ? 'text-yellow-400' : 'text-text-muted'}`}>
                                                        {reward.cost} pts
                                                    </span>
                                                </div>
                                                {canRedeem && (
                                                    <span className="text-green-400 text-xs font-bold">Available</span>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setSelectedReward(reward);
                                                    setShowRedeemModal(true);
                                                }}
                                                disabled={!canRedeem}
                                                className={`w-full py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-95 ${
                                                    canRedeem
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
                </>
            ) : activeTab === 'COUPONS' ? (
                <div className="text-center py-16 bg-surface rounded-2xl border border-white/5">
                    <span className="material-icons-round text-5xl text-text-muted opacity-40 block mb-3">redeem</span>
                    <p className="text-text-muted text-sm font-medium">No active coupons</p>
                    <p className="text-text-muted text-xs mt-1 opacity-60">
                        Trainer rewards are currently redeemed at the front desk.
                    </p>
                </div>
            ) : (
                <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                    <DataTable
                        data={history}
                        isLoading={loading}
                        emptyMessage="No loyalty point history found."
                        columns={[
                            { header: 'Date', accessor: (row) => new Date(row.createdAt).toLocaleString() },
                            {
                                header: 'Type',
                                accessor: (row) => (
                                    <span className="px-2 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400">
                                        {row.type}
                                    </span>
                                )
                            },
                            {
                                header: 'Points',
                                accessor: (row) => (
                                    <span className="font-mono font-bold text-emerald-500">
                                        +{row.points}
                                    </span>
                                )
                            },
                            { header: 'Description', accessor: (row) => <span className="text-text-secondary">{row.description}</span> }
                        ]}
                    />
                </div>
            )}

            {showRedeemModal && selectedReward && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center p-4"
                    onClick={() => setShowRedeemModal(false)}
                >
                    <div
                        className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 flex flex-col"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white">Redeem Reward</h2>
                            <button
                                onClick={() => setShowRedeemModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <span className="material-icons-round text-white text-xl">close</span>
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
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

                            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                                <p className="text-text-muted text-sm mb-2">Current Points</p>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-white font-bold text-2xl">{myPoints}</p>
                                        <p className="text-text-muted text-xs mt-1">Front desk will process this redemption.</p>
                                    </div>
                                    <span className="material-icons-round text-primary text-3xl">storefront</span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/10 p-5 bg-background space-y-3">
                            <button
                                onClick={() => handleRedeem(selectedReward)}
                                className="w-full py-3.5 bg-primary text-background rounded-xl font-bold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                <span className="material-icons-round text-xl">check_circle</span>
                                Confirm at Front Desk
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
