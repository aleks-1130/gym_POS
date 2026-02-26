import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import DashboardReport from '../../components/dashboard/DashboardReport';

export default function DashboardReportPage() {
    const { data: stats, isLoading, error } = useQuery({
        queryKey: ['dashboard-stats-report'],
        queryFn: async () => {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            if (!token) throw new Error("No authentication token found");

            const res = await axios.get('/api/dashboard/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        retry: 1
    });

    // Auto-print when ready (optional, but requested behavior often implies 'view then print')
    // We'll just show the button.

    if (isLoading) return <div className="p-8 text-center text-gray-500">Generating Report...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Failed to generate report. Please try again.</div>;

    return (
        <div className="bg-gray-100 min-h-screen p-8 flex flex-col items-center">
            {/* Print Controls - Hidden when printing */}
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

            {/* A4 Container */}
            <div className="bg-white shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] print:w-full print:min-h-0">
                <DashboardReport stats={stats} />
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
