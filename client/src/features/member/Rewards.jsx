import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { REWARD_CATEGORIES } from '../../constants/categories';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/common/DataTable';
import MemberPageHeader from './components/MemberPageHeader';

export default function Rewards() {
    const { user } = useAuth();
    const { alert: showAlert } = useConfirm();
    const [rewards, setRewards] = useState([]);
    const [myPoints, setMyPoints] = useState(0);
    const [history, setHistory] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('SHOP'); // SHOP | HISTORY | COUPONS
    const [selectedReward, setSelectedReward] = useState(null);
    const [showRedeemModal, setShowRedeemModal] = useState(false);
    const [copied, setCopied] = useState('');

    useEffect(() => {
        fetchRewards();
        fetchMyData();
        fetchMyCoupons();
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

    const fetchMyData = async () => {
        try {
            const res = await axios.get(`/api/members/${user.id}`);
            setMyPoints(res.data.points || 0);

            const histRes = await axios.get(`/api/members/${user.id}/loyalty-history`);
            setHistory(histRes.data);
        } catch (e) {
            console.error("Failed to fetch member data", e);
            setMyPoints(0);
            setHistory([]);
        }
    };

    const fetchMyCoupons = async () => {
        try {
            const res = await axios.get(`/api/loyalty/coupons/${user.id}`);
            setCoupons(res.data);
        } catch (e) {
            console.error("Failed to fetch coupons", e);
            setCoupons([]);
        }
    };

    const handleRedeem = async (reward) => {
        if (myPoints < reward.cost) {
            await showAlert({ title: 'Insufficient Points', message: 'You do not have enough points for this reward.', type: 'warning' });
            return;
        }
        try {
            await axios.post(`/api/members/${user.id}/points`, {
                points: reward.cost,
                type: 'REDEEM',
                rewardId: reward.id
            });
            await showAlert({ title: 'Reward Redeemed!', message: 'Reward redeemed successfully! If this was a discount, a coupon has been added to your account.', type: 'success' });
            fetchMyData();
            fetchRewards();
            fetchMyCoupons();
            setShowRedeemModal(false);
        } catch {
            await showAlert({ title: 'Redemption Failed', message: 'Failed to redeem reward', type: 'danger' });
        }
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopied(code);
        setTimeout(() => setCopied(''), 2000);
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
        <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
            <MemberPageHeader
                title="Rewards Store"
                subtitle="Earn and redeem points"
                icon="card_giftcard"
                className="border-white/10"
            />

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
                            {tab === 'COUPONS' && coupons.length > 0 && (
                                <span className={`absolute right-1 top-1 min-w-[16px] h-4 px-1 rounded-md text-[9px] font-bold leading-none inline-flex items-center justify-center ${activeTab === tab ? 'bg-black/20 text-black' : 'bg-amber-500/90 text-black'}`}>
                                    {coupons.length > 9 ? '9+' : coupons.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </section>
            {activeTab === 'SHOP' ? (
                <>
                    {/* Category Filter */}
                    <div className="space-y-2">
                        <div className="sm:hidden">
                            <label className="block text-[11px] text-text-muted font-semibold mb-1">Category</label>
                            <select
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                                className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                            >
                                {categories.map((cat) => (
                                    <option key={cat} value={cat} style={{ color: '#111', backgroundColor: '#fff' }}>
                                        {cat === 'all' ? 'All Rewards' : cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="hidden sm:grid grid-cols-5 gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilter(cat)}
                                    className={`px-2 py-2 rounded-xl font-medium text-xs transition-all leading-tight ${filter === cat
                                        ? 'bg-primary text-background'
                                        : 'bg-surface text-text-secondary border border-white/10 hover:border-primary/30'
                                        }`}
                                >
                                    {cat === 'all' ? 'All Rewards' : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rewards Grid */}
                    {filteredRewards.length === 0 ? (
                        <div className="text-center py-16">
                            <span className="material-icons-round text-5xl text-text-muted opacity-50 block mb-3">card_giftcard</span>
                            <p className="text-text-muted text-sm">No rewards in this category</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {/* Keep existing reward mapping */}
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
                </>
            ) : activeTab === 'COUPONS' ? (
                <div className="space-y-3">
                    {coupons.length === 0 ? (
                        <div className="text-center py-16 bg-surface rounded-2xl border border-white/5">
                            <span className="material-icons-round text-5xl text-text-muted opacity-40 block mb-3">redeem</span>
                            <p className="text-text-muted text-sm font-medium">No active coupons</p>
                            <p className="text-text-muted text-xs mt-1 opacity-60">Redeem a discount reward to get a coupon</p>
                        </div>
                    ) : (
                        coupons.map(coupon => {
                            const isFree = coupon.type === 'FREE_SESSION';
                            const isFlat = coupon.type === 'FLAT';
                            const label = isFree ? 'Free 1-on-1 Session' : isFlat ? `₱${coupon.value} Off` : `${coupon.value * 100}% Off`;
                            const icon = isFree ? 'fitness_center' : 'local_offer';
                            const color = isFree ? 'from-blue-600 to-indigo-700' : 'from-amber-500 to-orange-600';
                            return (
                                <div key={coupon.id} className={`relative bg-gradient-to-br ${color} rounded-2xl p-5 overflow-hidden shadow-lg`}>
                                    {/* Decorative circles */}
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
                                    <div className="absolute -right-2 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />

                                    <div className="relative flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-icons-round text-white/80 text-base">{icon}</span>
                                                <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">{coupon.type.replace('_', ' ')}</span>
                                            </div>
                                            <p className="text-white font-black text-2xl mb-3">{label}</p>

                                            {/* Code pill */}
                                            <div className="inline-flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                                                <span className="text-white font-mono font-bold text-base tracking-widest">{coupon.code}</span>
                                                <button
                                                    onClick={() => copyCode(coupon.code)}
                                                    className="text-white/70 hover:text-white transition-colors"
                                                    title="Copy code"
                                                >
                                                    <span className="material-icons-round text-sm">
                                                        {copied === coupon.code ? 'check' : 'content_copy'}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="relative text-white/60 text-xs mt-3">
                                        {isFree
                                            ? 'Show this code to the front desk to book your free session.'
                                            : 'Give this code to the staff at checkout to apply your discount.'}
                                    </p>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                    <DataTable
                        data={history}
                        isLoading={loading}
                        emptyMessage="No transaction history found."
                        columns={[
                            { header: 'Date', accessor: (row) => new Date(row.createdAt).toLocaleString() },
                            { 
                                header: 'Type', 
                                accessor: (row) => (
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${row.type === 'EARNED' ? 'bg-emerald-500/20 text-emerald-400' : row.type === 'REDEEMED' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                        {row.type}
                                    </span>
                                ) 
                            },
                            { 
                                header: 'Points', 
                                accessor: (row) => (
                                    <span className={`font-mono font-bold ${row.points > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {row.points > 0 ? `+${row.points}` : row.points}
                                    </span>
                                ) 
                            },
                            { header: 'Description', accessor: (row) => <span className="text-text-secondary">{row.description}</span> }
                        ]}
                    />
                </div>
            )}

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



