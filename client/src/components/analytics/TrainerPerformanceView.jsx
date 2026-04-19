import React, { useMemo, useState } from 'react';

const TrainerPerformanceView = ({ data }) => {
    const { topTrainers } = data;
    const [activeTab, setActiveTab] = useState('active');

    const formatPrice = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
    const sortByName = (list = []) => [...list].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));

    const activeTrainers = useMemo(() => sortByName(topTrainers.filter((t) => t.sessions > 0)), [topTrainers]);
    const inactiveTrainers = useMemo(() => sortByName(topTrainers.filter((t) => t.sessions === 0)), [topTrainers]);
    const allTrainers = useMemo(() => sortByName(topTrainers), [topTrainers]);

    let displayTrainers = allTrainers;
    if (activeTab === 'active') displayTrainers = activeTrainers;
    if (activeTab === 'inactive') displayTrainers = inactiveTrainers;

    return (
        <div className="space-y-6">
            <div className="flex space-x-2 border-b border-white/10 pb-4">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'active' ? 'bg-primary text-black' : 'bg-surface border border-white/5 text-text-muted hover:text-white'}`}
                >
                    Active Trainers ({activeTrainers.length})
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'all' ? 'bg-primary text-black' : 'bg-surface border border-white/5 text-text-muted hover:text-white'}`}
                >
                    All Trainers ({topTrainers.length})
                </button>
                <button
                    onClick={() => setActiveTab('inactive')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'inactive' ? 'bg-primary text-black' : 'bg-surface border border-white/5 text-text-muted hover:text-white'}`}
                >
                    Inactive/Zero Revenue ({inactiveTrainers.length})
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayTrainers.map((t, i) => (
                    <div key={i} className={`p-6 rounded-2xl border transition-colors ${t.sessions > 0 ? 'bg-surface border-white/5 hover:border-white/20' : 'bg-surface/50 border-white/5 border-dashed opacty-75 hover:border-white/20'}`}>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${t.sessions > 0 ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-muted'}`}>
                                    {t.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{t.name}</h3>
                                    <p className="text-xs text-text-muted">Trainer</p>
                                </div>
                            </div>
                            {t.sessions > 0 && (
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                                    Active
                                </span>
                            )}
                            {t.sessions === 0 && (
                                <span className="bg-white/5 text-text-muted px-3 py-1 rounded-full text-xs font-bold">
                                    No Data
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-text-muted text-sm">Total Revenue</span>
                                <span className="text-white font-bold">{formatPrice(t.revenue)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-text-muted text-sm">Commission Paid</span>
                                <span className="text-rose-400 font-bold">-{formatPrice(t.commissionCost)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-text-muted text-sm">Net Gym Profit</span>
                                <span className="text-emerald-400 font-bold">{formatPrice(t.netGymProfit)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-text-muted text-sm">Sessions</span>
                                <span className="text-white">{t.sessions}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-text-muted text-sm">Avg Rev / Session</span>
                                <span className="text-white">{formatPrice(t.avgRevPerSession)}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {displayTrainers.length === 0 && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12 text-text-muted bg-surface/50 rounded-2xl border border-white/5 border-dashed">
                        No trainers found for this category in the selected period.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainerPerformanceView;
