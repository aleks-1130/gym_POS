import React from 'react';

const TrainerPerformanceView = ({ data }) => {
    const { topTrainers } = data;
    const formatPrice = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {topTrainers.map((t, i) => (
                    <div key={i} className="bg-surface p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                                    {t.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{t.name}</h3>
                                    <p className="text-xs text-text-muted">Trainer</p>
                                </div>
                            </div>
                            <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
                                #{i + 1}
                            </span>
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

                {topTrainers.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-text-muted">
                        No trainer data available for this period.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainerPerformanceView;
