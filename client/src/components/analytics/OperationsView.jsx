import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Users, Clock, ShoppingCart } from 'lucide-react';

const OperationsView = ({ data }) => {
    const { peakHours, transactions, strategic, summary } = data;

    // Strategic metrics might be missing in initial backend response if not fully updated, fallback safely
    const arpu = strategic?.arpu || 0;
    const retention = strategic?.retentionRate || 0;

    const peakHoursData = {
        labels: ['6-9 AM', '9-12 PM', '12-3 PM', '3-6 PM', '6-9 PM', '9-12 AM'],
        datasets: [{
            label: 'Activity Level',
            data: peakHours,
            backgroundColor: '#3b82f6',
            borderRadius: 6,
        }]
    };

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
        }
    };

    return (
        <div className="space-y-6">
            {/* Strategic Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-500/20 p-3 rounded-xl text-indigo-400"><Users size={24} /></div>
                        <div>
                            <p className="text-text-muted text-sm">Retention Rate</p>
                            <h3 className="text-2xl font-bold text-white">{retention}%</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400"><DollarSign size={24} /></div>
                        <div>
                            <p className="text-text-muted text-sm">ARPU (Avg Rev/User)</p>
                            <h3 className="text-2xl font-bold text-white">PHP {arpu}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="bg-orange-500/20 p-3 rounded-xl text-orange-400"><ShoppingCart size={24} /></div>
                        <div>
                            <p className="text-text-muted text-sm">Avg Ticket Size</p>
                            <h3 className="text-2xl font-bold text-white">
                                PHP {summary.transactionCount > 0 ? (summary.revenue / summary.transactionCount).toFixed(0) : 0}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Peak Hours Chart */}
            <div className="bg-surface p-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <Clock className="text-blue-400" />
                    <h3 className="text-lg font-bold text-white">Peak Hours Activity</h3>
                </div>
                <div className="h-64">
                    <Bar data={peakHoursData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                </div>
            </div>

            {/* Recent Transactions List (Mini) */}
            <div className="bg-surface p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>
                <div className="overflow-auto max-h-64">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-text-muted uppercase border-b border-white/10">
                            <tr>
                                <th className="px-3 py-2">Time</th>
                                <th className="px-3 py-2">Member</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice(0, 10).map((t, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="px-3 py-2 text-text-muted">{new Date(t.date).toLocaleTimeString()}</td>
                                    <td className="px-3 py-2 text-white">{t.member}</td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs bg-white/5 px-2 py-0.5 rounded uppercase">{t.type}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-emerald-400 font-bold">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(t.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Helper Icon component for this file
const DollarSign = ({ size }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);

export default OperationsView;
