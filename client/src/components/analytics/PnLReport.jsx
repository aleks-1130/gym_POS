import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const PnLReport = React.forwardRef(({ data, dateRange }, ref) => {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { settings } = useSettings();
    const { summary, revenueBySource, expenseBreakdown } = data;

    const startDate = new Date(dateRange.start).toLocaleDateString();
    const endDate = new Date(dateRange.end).toLocaleDateString();
    const generatedDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const generatedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return (
        <div ref={ref} className="p-12 bg-white text-black min-h-screen font-sans w-[210mm] mx-auto">
            {/* 1. Header Details */}
            <div className="border-b-2 border-primary mb-8 pb-4 flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold text-primary mb-2">{settings?.name || 'IronAge Gym'}</h1>
                    <h2 className="text-xl font-semibold text-gray-700">Profit & Loss Statement</h2>
                    <p className="text-sm text-gray-500 mt-1">Period: {startDate} - {endDate}</p>
                </div>
                <div></div>
            </div>

            {/* 2. P&L Table */}
            <div className="space-y-8">
                {/* Revenue Section */}
                <section>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-300 pb-2 mb-4">Revenue</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-gray-700">
                            <span>Membership Income</span>
                            <span>{formatPrice(revenueBySource.membership)}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                            <span>Personal Training Revenue</span>
                            <span>{formatPrice(revenueBySource.training)}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                            <span>Retail Sales (POS + App)</span>
                            <span>{formatPrice(revenueBySource.store + revenueBySource.pos)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                            <span>Total Revenue</span>
                            <span>{formatPrice(summary.revenue)}</span>
                        </div>
                    </div>
                </section>

                {/* COGS Section */}
                <section>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-300 pb-2 mb-4">Cost of Goods Sold (COGS)</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-gray-700">
                            <span>Trainer Commissions</span>
                            <span className="text-red-500">({formatPrice(summary.totalCommission || 0)})</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                            <span>Product Supply Costs</span>
                            <span className="text-red-500">({formatPrice(summary.totalSupplyCost || 0)})</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                            <span>Total COGS</span>
                            <span className="text-red-600">({formatPrice((summary.totalSupplyCost || 0) + (summary.totalCommission || 0))})</span>
                        </div>
                    </div>
                </section>

                {/* Gross Profit */}
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <span className="font-bold text-lg text-gray-800">GROSS PROFIT</span>
                    <span className="font-bold text-lg text-gray-800">
                        {formatPrice(summary.revenue - ((summary.totalSupplyCost || 0) + (summary.totalCommission || 0)))}
                    </span>
                </div>

                {/* Operating Expenses */}
                <section>
                    <div className="mb-8">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-1 mb-2">
                            <h3 className="font-bold uppercase text-sm">Operating Expenses</h3>
                        </div>
                        {expenseBreakdown && expenseBreakdown.length > 0 ? (
                            expenseBreakdown.map((exp, idx) => (
                                <div key={idx} className="flex justify-between py-1 text-sm pl-4 text-gray-600">
                                    <span>{exp.category}</span>
                                    <span className="text-red-600">({formatPrice(exp.amount)})</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex justify-between py-1 text-sm pl-4 text-gray-600">
                                <span>General Expenses</span>
                                <span className="text-red-600">({formatPrice(summary.expenses)})</span>
                            </div>
                        )}
                        <div className="flex justify-between py-2 font-bold border-t border-gray-800 mt-1">
                            <span>Total Operating Expenses</span>
                            <span className="text-red-600">({formatPrice(summary.expenses)})</span>
                        </div>
                    </div>
                </section>

                {/* Net Income */}
                <div className={`flex justify-between items-center p-6 rounded-lg border-2 ${summary.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <span className={`font-bold text-2xl ${summary.netProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>NET INCOME</span>
                    <span className={`font-bold text-2xl ${summary.netProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                        {formatPrice(summary.netProfit)}
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-20 text-center text-xs text-gray-400 border-t border-gray-100 pt-4">
                <p>{settings?.name || 'IronAge Gym'} • Generated on {generatedDate} at {generatedTime}</p>
            </div>
        </div>
    );
});

PnLReport.displayName = 'PnLReport';

export default PnLReport;
