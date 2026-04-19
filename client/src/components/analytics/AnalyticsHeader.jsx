import React from 'react';
import { Calendar, BarChart3, DollarSign, Package, Users, Activity, Printer } from 'lucide-react';

const AnalyticsHeader = ({
    dateRange,
    setDateRange,
    viewMode,
    setViewMode,
    loading,
    onPrint
}) => {
    const tabs = [
        { id: 'OVERVIEW', label: 'Overview', icon: BarChart3 },
        { id: 'FINANCIALS', label: 'Financials', icon: DollarSign },
        { id: 'PRODUCTS', label: 'Products', icon: Package },
        { id: 'TRAINERS', label: 'Trainers', icon: Users },
        { id: 'OPERATIONS', label: 'Operations', icon: Activity }
    ];

    return (
        <div className="space-y-4">
            <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Analytics</h1>
                    <p className="text-text-muted text-sm mt-1">Deep insights into gym performance.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                            className="bg-transparent border-none text-white text-sm focus:ring-0 cursor-pointer"
                        />
                        <span className="text-text-muted text-xs">to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                            className="bg-transparent border-none text-white text-sm focus:ring-0 cursor-pointer"
                        />
                    </div>

                    {viewMode === 'FINANCIALS' && (
                        <button
                            onClick={() => {
                                const url = `/analytics/report/pnl?startDate=${dateRange.start}&endDate=${dateRange.end}`;
                                window.open(url, '_blank');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30 transition-colors"
                        >
                            <DollarSign size={18} />
                            <span className="hidden sm:inline">View P&amp;L Statement</span>
                        </button>
                    )}

                    <button
                        onClick={onPrint}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl border border-white/10 transition-colors"
                        title="Download/Print Report"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Print Report</span>
                    </button>
                </div>
            </header>

            <div className="border-b border-white/10">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = viewMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setViewMode(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-muted hover:text-white hover:border-white/20'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsHeader;
