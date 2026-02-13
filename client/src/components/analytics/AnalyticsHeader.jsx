import React from 'react';
import { Calendar, BarChart3, TrendingUp, DollarSign, Package, Users, Activity, Printer } from 'lucide-react';

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
        { id: 'OPERATIONS', label: 'Operations', icon: Activity },
    ];

    return (
        <div className="bg-surface border-b border-white/10 sticky top-0 z-20">
            <div className="p-6 pb-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Analytics Dashboard</h1>
                        <p className="text-text-muted text-sm">Deep insights into gym performance</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-background/50 p-1 rounded-lg border border-white/5">
                            <div className="flex items-center gap-2 px-3 py-2 border-r border-white/5">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="text-sm text-text-muted">Range:</span>
                            </div>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-transparent border-none text-white text-sm focus:ring-0 cursor-pointer"
                            />
                            <span className="text-text-muted">→</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-transparent border-none text-white text-sm focus:ring-0 cursor-pointer"
                            />
                        </div>
                        {viewMode === 'FINANCIALS' && (
                            <button
                                onClick={() => {
                                    if (!dateRange) return;
                                    const url = `/analytics/report/pnl?startDate=${dateRange.start}&endDate=${dateRange.end}`;
                                    window.open(url, '_blank');
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30 transition-colors"
                            >
                                <DollarSign size={18} />
                                <span className="hidden sm:inline">View P&L Statement</span>
                            </button>
                        )}
                        <button
                            onClick={onPrint}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/5 transition-colors"
                            title="Download/Print Report"
                        >
                            <Printer size={18} />
                            <span className="hidden sm:inline">Print Report</span>
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-hide">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = viewMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setViewMode(tab.id)}
                                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${isActive
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-text-muted hover:text-white hover:border-white/20'}
                `}
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
