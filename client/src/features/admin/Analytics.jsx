import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { withApiBase } from '../../config/api';
import AnalyticsHeader from '../../components/analytics/AnalyticsHeader';
import OverviewView from '../../components/analytics/OverviewView';
import ProductPerformanceView from '../../components/analytics/ProductPerformanceView';
import FinancialsView from '../../components/analytics/FinancialsView';
import TrainerPerformanceView from '../../components/analytics/TrainerPerformanceView';
import OperationsView from '../../components/analytics/OperationsView';

const Analytics = () => {
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days default
        end: new Date().toISOString().split('T')[0]
    });
    const [viewMode, setViewMode] = useState('OVERVIEW');

    const { data, isLoading: loading } = useQuery({
        queryKey: ['analytics', dateRange],
        queryFn: async () => {
            const response = await axios.get(withApiBase('/api/analytics'), {
                params: {
                    startDate: dateRange.start,
                    endDate: dateRange.end
                }
            });
            return response.data;
        },
        staleTime: 30000, // 30 seconds
        refetchOnWindowFocus: true
    });


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
        <div className="space-y-6 pb-10 max-w-[110rem] mx-auto">
            <AnalyticsHeader
                dateRange={dateRange}
                setDateRange={setDateRange}
                viewMode={viewMode}
                setViewMode={setViewMode}
                loading={loading}
                onPrint={handlePrint}
            />
            <div className="pb-16">
                {renderView()}
            </div>
        </div>
    );
};

export default Analytics;
