import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import PnLReport from '../../components/analytics/PnLReport';

export default function PnLReportPage() {
    const [searchParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    useEffect(() => {
        const fetchData = async () => {
            if (!startDate || !endDate) {
                setError("Missing date range parameters.");
                setLoading(false);
                return;
            }

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await axios.get('http://localhost:5000/api/analytics', {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { startDate, endDate }
                });
                setData(response.data);
            } catch (err) {
                console.error("Error fetching P&L data:", err);
                setError("Failed to generate report.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, endDate]);

    if (loading) return <div className="p-8 text-center text-gray-500 font-sans">Generating Report...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-sans">{error}</div>;

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
            <div className="bg-white shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] print:w-full print:min-h-0 print:m-0">
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
