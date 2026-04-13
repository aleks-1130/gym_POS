import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useMutationState } from '@tanstack/react-query';
import { useCurrency } from '../../context/CurrencyContext';
import DataTable from '../../components/common/DataTable';

export default function Transactions() {
    const { formatPrice } = useCurrency();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const LIMIT = 15;

    // Get pending mutations from React Query state
    const pendingMutations = useMutationState({
        filters: { 
            // Include both 'pending' (waiting) and 'error' (failed syncs)
            predicate: (mutation) => {
                const isCorrectType = ['checkout', 'bookTraining'].includes(mutation.options.mutationKey?.[0]);
                const isRelevantStatus = mutation.state.status === 'pending' || mutation.state.status === 'error';
                return isCorrectType && isRelevantStatus;
            }
        },
        select: (mutation) => {
            const payload = mutation.state.variables;
            const status = mutation.state.status === 'error' ? 'SYNC_FAILED' : 'PENDING_SYNC';
            return {
                id: `pending-${mutation.mutationId}`,
                date: new Date().toISOString(),
                type: payload?.type || 'POS_SALE',
                amount: payload?.amount,
                method: payload?.method,
                status: status,
                member: payload?.memberId ? { firstName: 'Pending', lastName: 'Member' } : null,
                cashier: { name: 'Local Staff' },
                isOfflinePending: true,
                error: (mutation.state.error && typeof mutation.state.error === 'object' && 'message' in mutation.state.error) 
                    ? String(mutation.state.error.message) 
                    : String(mutation.state.error || '')
            };
        }
    });

    const mergedHistory = useMemo(() => {
        // Only show pending on the first page
        if (currentPage !== 1) return history;
        return [...pendingMutations, ...history];
    }, [pendingMutations, history, currentPage]);

    useEffect(() => {
        fetchHistory(currentPage, appliedStartDate, appliedEndDate);
    }, [currentPage, appliedStartDate, appliedEndDate]);

    const fetchHistory = async (page = 1, dateFrom = '', dateTo = '') => {
        setLoading(true);
        try {
                        const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT)
            });
            if (dateFrom) params.set('startDate', dateFrom);
            if (dateTo) params.set('endDate', dateTo);

            const res = await axios.get(`/api/payments?${params.toString()}`);
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

    const summary = useMemo(() => {
        const counts = { completed: 0, voided: 0, returned: 0, pending: 0 };
        for (const payment of mergedHistory) {
            const status = String(payment?.status || 'COMPLETED').toUpperCase();
            if (status === 'VOIDED') counts.voided += 1;
            else if (status === 'RETURNED') counts.returned += 1;
            else if (status === 'PENDING_SYNC') counts.pending += 1;
            else counts.completed += 1;
        }
        return counts;
    }, [mergedHistory]);

    const applyDateFilters = () => {
        setCurrentPage(1);
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
    };

    const clearDateFilters = () => {
        setStartDate('');
        setEndDate('');
        setAppliedStartDate('');
        setAppliedEndDate('');
        setCurrentPage(1);
    };

    const renderStatusBadge = (status) => {
        const value = status || 'COMPLETED';
        const base = "px-2 py-1 rounded text-xs font-bold";
        if (value === 'VOIDED') return <span className={`${base} bg-red-500/10 text-red-400 border border-red-500/20`}>VOIDED</span>;
        if (value === 'RETURNED') return <span className={`${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`}>RETURNED</span>;
        if (value === 'PENDING') return <span className={`${base} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>PENDING</span>;
        if (value === 'PENDING_SYNC') return (
            <span className={`${base} bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse flex items-center justify-center gap-1`}>
                <span className="material-icons-round text-[10px]">sync</span> PENDING SYNC
            </span>
        );
        if (value === 'SYNC_FAILED') return (
            <div className="flex flex-col gap-1 items-center">
                <span className={`${base} bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center gap-1`}>
                    <span className="material-icons-round text-[10px]">error_outline</span> SYNC FAILED
                </span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        queryClient.resumePausedMutations();
                        // Also trigger the custom recovery logic
                        const failed = queryClient.getMutationCache().getAll().filter(m => m.state.status === 'error');
                        failed.forEach(m => m.continue());
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline font-bold"
                >
                    Retry Sync
                </button>
            </div>
        );
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
            </div>

            <div className="bg-surface rounded-2xl border border-white/10 p-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto,auto] gap-3 items-end">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={applyDateFilters}
                        className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-orange-600 transition-colors"
                    >
                        Apply Filters
                    </button>
                    <button
                        type="button"
                        onClick={clearDateFilters}
                        className="px-4 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    label="Completed / Finalized"
                    value={summary.completed}
                    icon="check_circle"
                    toneClass="text-emerald-300"
                    badgeClass="bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                />
                <SummaryCard
                    label="Pending Sync (Offline)"
                    value={summary.pending}
                    icon="sync"
                    toneClass="text-blue-300"
                    badgeClass="bg-blue-500/15 border-blue-500/30 text-blue-300"
                />
                <SummaryCard
                    label="Returned / Voided"
                    value={summary.returned + summary.voided}
                    icon="undo"
                    toneClass="text-amber-300"
                    badgeClass="bg-amber-500/15 border-amber-500/30 text-amber-300"
                />
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
                data={mergedHistory}
                actions={(pay) => (
                    <Link
                        to={`/pos/transactions/${pay.id}`}
                        className="text-primary hover:text-orange-400 font-medium text-xs flex items-center gap-1 transition-colors"
                    >
                        <span className="material-icons-round text-sm">receipt</span>
                        View
                    </Link>
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

const SummaryCard = ({ label, value, icon, toneClass, badgeClass }) => (
    <div className="bg-surface rounded-2xl border border-white/10 p-4 flex items-center justify-between">
        <div>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${badgeClass}`}>
            <span className="material-icons-round text-lg">{icon}</span>
        </div>
    </div>
);
