import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import DataTable from '../../components/common/DataTable';

export default function Transactions() {
    const { formatPrice } = useCurrency();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const LIMIT = 15;

    useEffect(() => {
        fetchHistory(currentPage);
    }, [currentPage]);

    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/payments?page=${page}&limit=${LIMIT}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.meta) {
                setHistory(res.data.data);
                setTotalPages(res.data.meta.totalPages);
            } else {
                setHistory(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch history');
        } finally {
            setLoading(false);
        }
    };

    const renderStatusBadge = (status) => {
        const value = status || 'COMPLETED';
        const base = "px-2 py-1 rounded text-xs font-bold";
        if (value === 'VOIDED') return <span className={`${base} bg-red-500/10 text-red-400 border border-red-500/20`}>VOIDED</span>;
        if (value === 'RETURNED') return <span className={`${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`}>RETURNED</span>;
        if (value === 'PENDING') return <span className={`${base} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>PENDING</span>;
        return <span className={`${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>COMPLETED</span>;
    };

    if (loading) return <div className="text-white p-6">Loading transactions...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Transaction History</h1>
                    <p className="text-text-muted text-sm">All POS transactions</p>
                </div>
                <button
                    onClick={fetchHistory}
                    className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors"
                >
                    <span className="material-icons-round">refresh</span> Refresh
                </button>
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
                        header: 'Type',
                        accessor: (pay) => <span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold">{pay.type}</span>
                    },
                    {
                        header: 'Amount',
                        accessor: (pay) => <span className="text-white font-bold">{formatPrice(pay.amount)}</span>
                    },
                    {
                        header: 'Method',
                        accessor: (pay) => <span className="text-text-secondary">{pay.method}</span>
                    },
                    {
                        header: 'Member',
                        accessor: (pay) => <span className="text-white">{pay.member ? `${pay.member.firstName} ${pay.member.lastName}` : 'Walk-in'}</span>
                    },
                    {
                        header: 'Cashier',
                        accessor: (pay) => <span className="text-white">{pay.cashier?.name || 'N/A'}</span>
                    },
                    {
                        header: 'Status',
                        accessor: (pay) => renderStatusBadge(pay.status)
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
                emptyMessage="No transactions found."
            />

            {/* Pagination */}
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
        </div>
    );
}
