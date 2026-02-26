import React from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';

const RevenueView = ({ data }) => {
    const { summary, revenueBySource, trends } = data;
    const formatPrice = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    const sourceData = {
        labels: ['Membership', 'Training', 'Store', 'POS'],
        datasets: [{
            data: [revenueBySource.membership, revenueBySource.training, revenueBySource.store, revenueBySource.pos],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
            borderWidth: 0
        }]
    };

    const dailyAvg = summary.revenue / (trends.labels.length || 7);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-sm font-medium mb-1">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-blue-400">{formatPrice(summary.revenue)}</h3>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <p className="text-text-muted text-sm font-medium mb-1">Avg Daily Revenue</p>
                    <h3 className="text-3xl font-bold text-white">{formatPrice(dailyAvg)}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-6">Revenue Composition</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-64 flex justify-center">
                            <Doughnut data={sourceData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } } }} />
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex justify-between mb-1">
                                    <span className="text-blue-400 font-medium">Memberships</span>
                                    <span className="text-white font-bold">{formatPrice(revenueBySource.membership)}</span>
                                </div>
                                <div className="w-full bg-white/10 h-1 rounded-full"><div className="bg-blue-400 h-full" style={{ width: `${(revenueBySource.membership / summary.revenue) * 100}%` }}></div></div>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex justify-between mb-1">
                                    <span className="text-purple-400 font-medium">Training</span>
                                    <span className="text-white font-bold">{formatPrice(revenueBySource.training)}</span>
                                </div>
                                <div className="w-full bg-white/10 h-1 rounded-full"><div className="bg-purple-400 h-full" style={{ width: `${(revenueBySource.training / summary.revenue) * 100}%` }}></div></div>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex justify-between mb-1">
                                    <span className="text-emerald-400 font-medium">Retail (App + POS)</span>
                                    <span className="text-white font-bold">{formatPrice(revenueBySource.store + revenueBySource.pos)}</span>
                                </div>
                                <div className="w-full bg-white/10 h-1 rounded-full"><div className="bg-emerald-400 h-full" style={{ width: `${((revenueBySource.store + revenueBySource.pos) / summary.revenue) * 100}%` }}></div></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Growth Stats Side Panel */}
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-6">Growth Analysis</h3>
                    <div className="space-y-6">
                        <div>
                            <p className="text-sm text-text-muted mb-2">Total Revenue Growth</p>
                            <p className={`text-2xl font-bold ${parseFloat(summary.revenueGrowth) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {summary.revenueGrowth}%
                            </p>
                        </div>
                        <div className="pt-6 border-t border-white/10">
                            <p className="text-sm text-text-muted mb-2">Projected Monthly Revenue</p>
                            <p className="text-2xl font-bold text-white opacity-50">
                                {formatPrice(dailyAvg * 30)}
                            </p>
                            <p className="text-xs text-text-muted mt-1">Based on current period average</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueView;
