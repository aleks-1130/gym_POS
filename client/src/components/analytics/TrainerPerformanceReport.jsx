import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';

const TrainerPerformanceReport = ({ data }) => {
    const { formatPrice } = useCurrency();
    const { topTrainers, summary } = data; // Assuming data contains trainer stats

    return (
        <div className="w-full space-y-8">
            {/* 1. Summary Metrics */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Training Department Summary</h3>
                <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Total Training Revenue</p>
                        <p className="text-2xl font-bold text-gray-800">
                            {formatPrice(topTrainers?.reduce((acc, t) => acc + (t.revenue || 0), 0) || 0)}
                        </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Active Trainers</p>
                        <p className="text-2xl font-bold text-gray-800">{topTrainers?.length || 0}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Avg Revenue / Trainer</p>
                        <p className="text-2xl font-bold text-gray-800">
                            {topTrainers?.length > 0
                                ? formatPrice((topTrainers.reduce((acc, t) => acc + (t.revenue || 0), 0)) / topTrainers.length)
                                : formatPrice(0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Trainer Leaderboard Table */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Trainer Performance</h3>
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs border-b-2 border-gray-300">
                        <tr>
                            <th className="px-4 py-3">Rank</th>
                            <th className="px-4 py-3">Trainer</th>
                            <th className="px-4 py-3 text-right">Sessions</th>
                            <th className="px-4 py-3 text-right">Revenue</th>
                            <th className="px-4 py-3 text-right">Commission</th>
                            <th className="px-4 py-3 text-right">Net Profit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {topTrainers && topTrainers.map((trainer, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 font-bold text-gray-500">#{i + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-800">{trainer.name}</td>
                                <td className="px-4 py-3 text-right">{trainer.sessions}</td>
                                <td className="px-4 py-3 text-right font-medium text-gray-800">{formatPrice(trainer.revenue)}</td>
                                <td className="px-4 py-3 text-right text-red-600">
                                    {/* Assuming commission is roughly 40% if not provided, purely for display estimate if missing */}
                                    {/* Ideally backend provides this. Using a placeholder calculation if field missing */}
                                    ({formatPrice(trainer.commission || trainer.revenue * 0.4)})
                                </td>
                                <td className="px-4 py-3 text-right text-green-600 font-bold">
                                    {formatPrice(trainer.netGymProfit || trainer.revenue * 0.6)}
                                </td>
                            </tr>
                        ))}
                        {!topTrainers && (
                            <tr>
                                <td colSpan="6" className="py-8 text-center text-gray-400">No trainer data available.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TrainerPerformanceReport;
