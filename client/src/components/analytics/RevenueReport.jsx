import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';

const RevenueReport = ({ data }) => {
    const { formatPrice } = useCurrency();
    const { summary, revenueBySource, trends } = data;

    const dailyAvg = summary.revenue / (trends.labels.length || 7);

    return (
        <div className="w-full space-y-8">
            {/* 1. Revenue Summary */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Revenue Summary</h3>
                <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-800">{formatPrice(summary.revenue)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Avg Daily Revenue</p>
                        <p className="text-2xl font-bold text-blue-600">{formatPrice(dailyAvg)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                        <p className="text-xs text-gray-500 uppercase">Revenue Growth</p>
                        <p className={`text-2xl font-bold ${parseFloat(summary.revenueGrowth) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {summary.revenueGrowth}%
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Revenue Breakdown Table */}
            <div>
                <h3 className="text-gray-500 uppercase tracking-wider text-sm font-bold border-b border-gray-200 pb-2 mb-4">Revenue Sources</h3>
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs border-b-2 border-gray-300">
                        <tr>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3 text-right">Revenue</th>
                            <th className="px-4 py-3 text-right">% of Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-3 font-medium text-gray-800">Membership Subscriptions</td>
                            <td className="px-4 py-3 text-right">{formatPrice(revenueBySource.membership)}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{(summary.revenue > 0 ? (revenueBySource.membership / summary.revenue * 100).toFixed(1) : 0)}%</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-3 font-medium text-gray-800">Personal Training</td>
                            <td className="px-4 py-3 text-right">{formatPrice(revenueBySource.training)}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{(summary.revenue > 0 ? (revenueBySource.training / summary.revenue * 100).toFixed(1) : 0)}%</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-3 font-medium text-gray-800">Retail Store</td>
                            <td className="px-4 py-3 text-right">{formatPrice(revenueBySource.store)}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{(summary.revenue > 0 ? (revenueBySource.store / summary.revenue * 100).toFixed(1) : 0)}%</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-3 font-medium text-gray-800">POS Sales</td>
                            <td className="px-4 py-3 text-right">{formatPrice(revenueBySource.pos)}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{(summary.revenue > 0 ? (revenueBySource.pos / summary.revenue * 100).toFixed(1) : 0)}%</td>
                        </tr>
                        <tr className="bg-gray-100 font-bold">
                            <td className="px-4 py-3 text-gray-900">Total</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatPrice(summary.revenue)}</td>
                            <td className="px-4 py-3 text-right text-gray-900">100%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* 3. Projected Monthly Revenue */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
                <p className="text-sm text-blue-800 font-medium">Projected Monthly Revenue</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{formatPrice(dailyAvg * 30)}</p>
                <p className="text-xs text-blue-600 mt-1">Based on current period daily average</p>
            </div>
        </div>
    );
};

export default RevenueReport;
