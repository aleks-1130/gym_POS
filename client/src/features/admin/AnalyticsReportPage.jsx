import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ReportLayout from '../../components/analytics/ReportLayout';
import ProductPerformanceReport from '../../components/analytics/ProductPerformanceReport';
import OverviewReport from '../../components/analytics/OverviewReport';
import TrafficReport from '../../components/analytics/TrafficReport';
import TrainerPerformanceReport from '../../components/analytics/TrainerPerformanceReport';
import FinancialsReport from '../../components/analytics/FinancialsReport';
import PnLReport from '../../components/analytics/PnLReport';

export default function AnalyticsReportPage() {
    const { type } = useParams();
    const [searchParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    useEffect(() => {
        const fetchData = async () => {
            if (!startDate || !endDate) {
                setError("Missing date range parameters.");
                setLoading(false);
                return;
            }

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                // Reusing the main analytics endpoint which returns everything
                // Optimization: In the future, we could have specific endpoints for specific reports if payload size becomes an issue
                const response = await axios.get('/api/analytics', {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { startDate, endDate }
                });
                setData(response.data);
            } catch (err) {
                console.error("Error fetching report data:", err);
                setError("Failed to generate report.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, endDate]);

    if (loading) return <div className="p-8 text-center text-gray-500">Generating Report...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    const renderReportContent = () => {
        switch (type) {
            case 'products':
                return <ProductPerformanceReport data={data} />;
            case 'overview':
                return <OverviewReport data={data} />;
            case 'operations':
                return <TrafficReport data={data} />;
            case 'trainers':
                return <TrainerPerformanceReport data={data} />;
            case 'financials':
                return <FinancialsReport data={data} />;
            default:
                return <div className="text-center text-red-500">Unknown Report Type: {type}</div>;
        }
    };

    const getReportTitle = () => {
        switch (type) {
            case 'products': return 'Product Performance Report';
            case 'overview': return 'Executive Summary';
            case 'trainers': return 'Trainer Performance Report';
            case 'financials': return 'Financial Analysis Report';
            case 'profitability': return 'Profitability Report'; // Keeping for legacy P&L? No, P&L is 'pnl'
            default: return 'Analytics Report';
        }
    };

    // Standalone Layout for PnL (which has its own internal A4 styling)
    if (type === 'pnl') {
        return (
            <div className="bg-gray-100 min-h-screen p-8 flex flex-col items-center">
                {/* Print Controls */}
                <div className="mb-6 w-[210mm] flex justify-between items-center print:hidden">
                    <h1 className="text-xl font-bold text-gray-700">Report Preview</h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.close()}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-lg"
                        >
                            Print PDF
                        </button>
                    </div>
                </div>

                {/* Render PnL Report directly - it handles its own A4 container */}
                <div className="shadow-2xl print:shadow-none bg-white">
                    <PnLReport data={data} dateRange={{ start: startDate, end: endDate }} />
                </div>

                <style>{`
                    @media print {
                        @page { size: A4; margin: 0; }
                        body { background: white; -webkit-print-color-adjust: exact; }
                        .print\\:hidden { display: none !important; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <ReportLayout
            title={getReportTitle()}
            subtitle={`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`}
        >
            {renderReportContent()}
        </ReportLayout>
    );
}
