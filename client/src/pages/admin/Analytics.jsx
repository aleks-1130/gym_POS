import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AnalyticsHeader from '../../components/analytics/AnalyticsHeader';
import OverviewView from '../../components/analytics/OverviewView';
import ProductPerformanceView from '../../components/analytics/ProductPerformanceView';
import FinancialsView from '../../components/analytics/FinancialsView';
import TrainerPerformanceView from '../../components/analytics/TrainerPerformanceView';
import OperationsView from '../../components/analytics/OperationsView';

const Analytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days default
        end: new Date().toISOString().split('T')[0]
    });
    const [viewMode, setViewMode] = useState('OVERVIEW');

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await axios.get('http://localhost:5000/api/analytics', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    startDate: dateRange.start,
                    endDate: dateRange.end
                }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        let reportType = '';
        switch (viewMode) {
            case 'OVERVIEW': reportType = 'overview'; break;
            case 'FINANCIALS': reportType = 'financials'; break;
            case 'PRODUCTS': reportType = 'products'; break;
            case 'TRAINERS': reportType = 'trainers'; break;
            case 'OPERATIONS': reportType = 'operations'; break;
            default: return;
        }

        const params = new URLSearchParams({
            startDate: dateRange.start,
            endDate: dateRange.end
        });

        window.open(`/analytics/report/${reportType}?${params.toString()}`, '_blank');
    };

    const renderView = () => {
        if (loading) return <div className="p-8 text-center text-text-muted">Loading Analytics...</div>;
        if (!data) return <div className="p-8 text-center text-rose-400">Failed to load data.</div>;

        switch (viewMode) {
            case 'OVERVIEW': return <OverviewView data={data} loading={loading} />;
            case 'FINANCIALS': return <FinancialsView data={data} dateRange={dateRange} />;
            case 'PRODUCTS': return <ProductPerformanceView data={data} />;
            case 'TRAINERS': return <TrainerPerformanceView data={data} />;
            case 'OPERATIONS': return <OperationsView data={data} />;
            default: return <OverviewView data={data} loading={loading} />;
        }
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar would be here in the layout wrapper, assuming Analytics is rendered inside Layout */}

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header with Filters */}
                <AnalyticsHeader
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    loading={loading}
                    onPrint={handlePrint}
                />

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="max-w-7xl mx-auto pb-20">
                        {renderView()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
