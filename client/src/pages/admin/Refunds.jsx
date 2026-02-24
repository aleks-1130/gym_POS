import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import DataTable from '../../components/common/DataTable';

export default function Refunds() {
    const { formatPrice } = useCurrency();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Date Filter State
    const [dateFilterType, setDateFilterType] = useState('ALL_TIME');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const LIMIT = 15;

    useEffect(() => {
        if (dateFilterType === 'CUSTOM') return;

        const now = new Date();
        let start, end;
        switch (dateFilterType) {
            case 'THIS_MONTH':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'LAST_MONTH':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'THIS_YEAR':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
            case 'ALL_TIME':
                setDateRange({ start: '', end: '' });
                return;
            default:
                break;
        }
        if (start && end) {
            setDateRange({
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            });
        }
    }, [dateFilterType]);

    useEffect(() => {
        setCurrentPage(1);
        fetchHistory(1);
    }, [dateRange]);

    useEffect(() => {
        fetchHistory(currentPage);
    }, [currentPage]);

    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            let queryUrl = `http://localhost:5000/api/payments/refunds?page=${page}&limit=${LIMIT}`;
            if (dateRange.start && dateRange.end) {
                queryUrl += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
            }

            const res = await axios.get(queryUrl, { headers });

            if (res.data.meta) {
                setHistory(res.data.data);
                setTotalPages(res.data.meta.totalPages);
            } else {
                setHistory(res.data);
                setTotalPages(1);
            }
        } catch (error) {
            console.error('Failed to fetch refunds:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Refunds & Voids</h1>
                    <p className="text-text-muted text-sm">View voided and returned transactions</p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={dateFilterType}
                        onChange={(e) => setDateFilterType(e.target.value)}
                        className="bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                    >
                        <option value="ALL_TIME">All Time</option>
                        <option value="THIS_MONTH">This Month</option>
                        <option value="LAST_MONTH">Last Month</option>
                        <option value="THIS_YEAR">This Year</option>
                        <option value="CUSTOM">Custom Range</option>
                    </select>

                    {dateFilterType === 'CUSTOM' && (
                        <div className="flex items-center gap-2 bg-surface border border-white/10 rounded-lg px-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-transparent border-none text-white text-sm focus:ring-0 p-2 outline-none [color-scheme:dark]"
                            />
                            <span className="text-text-muted">→</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-transparent border-none text-white text-sm focus:ring-0 p-2 outline-none [color-scheme:dark]"
                            />
                        </div>
                    )}

                    <button
                        onClick={() => fetchHistory(currentPage)}
                        className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors px-3 py-2 rounded-lg border border-white/10 bg-surface"
                    >
                        <span className="material-icons-round">refresh</span>
                    </button>
                </div>
            </div>

            <DataTable
                columns={[
                    {
                        header: 'Date',
                        accessor: (pay) => (
                            <span className="text-white font-medium">
                                {new Date(pay.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(pay.date).toLocaleTimeString()}</span>
                            </span>
                        )
                    },
                    {
                        header: 'Status',
                        accessor: (pay) => {
                            if (pay.status === 'VOIDED') {
                                return <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">VOIDED</span>;
                            }
                            if (pay.status === 'RETURNED') {
                                return <span className="px-2 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">RETURNED</span>;
                            }
                            return <span className="px-2 py-1 rounded text-xs font-bold bg-white/10 text-text-muted">{pay.status}</span>;
                        }
                    },
                    {
                        header: 'Original Amount',
                        accessor: (pay) => <span className="text-white font-medium">{formatPrice(pay.amount)}</span>
                    },
                    {
                        header: 'Refunded',
                        accessor: (pay) => <span className="text-red-400 font-bold">{formatPrice(pay.refundedAmount || pay.amount)}</span>
                    },
                    {
                        header: 'Member',
                        accessor: (pay) => <span className="text-white">{pay.member ? `${pay.member.firstName} ${pay.member.lastName}` : 'Walk-in'}</span>
                    },
                    {
                        header: 'Auth Cashier',
                        accessor: (pay) => <span className="text-white">{pay.cashier?.name || 'N/A'}</span>
                    }
                ]}
                data={history}
                actions={(pay) => (
                    <a
                        href={`/pos/transactions/${pay.id}`}
                        className="text-primary hover:text-orange-400 font-medium text-xs flex items-center gap-1 transition-colors"
                    >
                        <span className="material-icons-round text-sm">receipt</span>
                        View
                    </a>
                )}
                isLoading={loading}
                emptyMessage="No refunds or voided transactions found for this period."
            />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-text-muted text-sm">
                        Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent transition-all text-sm font-medium"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent transition-all text-sm font-medium"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
