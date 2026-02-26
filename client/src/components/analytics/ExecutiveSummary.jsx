import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, PiggyBank, Percent } from 'lucide-react';

const StatCard = ({ title, value, subValue, trend, trendLabel, icon: Icon, colorClass }) => {
    const isPositive = parseFloat(trend) >= 0;
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    const trendColor = isPositive ? 'text-emerald-400' : 'text-rose-400';

    // Special case for Expenses: Up is "bad" (unless we want to be strictly mathematical, but usually green=good)
    // Actually, standard is usually Green = Up, Red = Down for numbers.
    // But for profit/revenue text: Green = Good.
    // Let's stick to Green = Positive Number for now to keep it simple.

    return (
        <div className="bg-surface p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
                <Icon size={64} />
            </div>

            <div className="relative z-10">
                <p className="text-text-muted text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>

                {trend && (
                    <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 ${trendColor}`}>
                            <TrendIcon size={12} />
                            {Math.abs(trend)}%
                        </span>
                        <span className="text-text-muted text-xs">{trendLabel || 'vs previous period'}</span>
                    </div>
                )}

                {subValue && (
                    <p className="text-xs text-text-muted mt-2">{subValue}</p>
                )}
            </div>
        </div>
    );
};

const ExecutiveSummary = ({ summary }) => {
    const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
                title="Total Revenue"
                value={formatCurrency(summary.revenue)}
                trend={summary.revenueGrowth}
                icon={DollarSign}
                colorClass="text-blue-400"
            />

            <StatCard
                title="Total Expenses"
                value={formatCurrency(summary.expenses)}
                trend={summary.expenseGrowth}
                icon={Wallet}
                colorClass="text-orange-400"
            />

            <StatCard
                title="Net Profit"
                value={formatCurrency(summary.netProfit)}
                trend={summary.profitGrowth}
                icon={PiggyBank}
                colorClass={summary.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}
            />

            <StatCard
                title="Profit Margin"
                value={`${summary.profitMargin}%`}
                trend={null} // Margin trend not calculated explicitly yet
                subValue={summary.netProfit >= 0 ? "Healthy Logic" : "Attention Required"}
                icon={Percent}
                colorClass="text-purple-400"
            />
        </div>
    );
};

export default ExecutiveSummary;
