import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import DataTable from '../../components/common/DataTable';
import { useConfirm } from '../../context/ConfirmContext';

export default function Refunds() {
    const { formatPrice } = useCurrency();
    const { alert: showAlert } = useConfirm();

    // Tab state
    const [activeTab, setActiveTab] = useState('HISTORY'); // 'HISTORY' | 'EXCEPTIONS'

    // History tab state
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [dateFilterType, setDateFilterType] = useState('ALL_TIME');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const LIMIT = 15;

    // Exceptions tab state
    const [refundExceptionRequests, setRefundExceptionRequests] = useState([]);
    const [exceptionsLoading, setExceptionsLoading] = useState(false);

    // ΓöÇΓöÇ Date filter effect ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
            default:
                setDateRange({ start: '', end: '' });
                return;
        }
        if (start && end) {
            setDateRange({
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0] });
        }
    }, [dateFilterType]);

    useEffect(() => {
        setCurrentPage(1);
        fetchHistory(1);
    }, [dateRange]);

    useEffect(() => {
        fetchHistory(currentPage);
    }, [currentPage]);

    // Load exceptions when switching to that tab
    useEffect(() => {
        if (activeTab === 'EXCEPTIONS') {
            fetchRefundExceptionRequests();
        }
    }, [activeTab]);

    // ΓöÇΓöÇ API calls ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
                        let url = `/api/payments/refunds?page=${page}&limit=${LIMIT}`;
            if (dateRange.start && dateRange.end) {
                url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
            }
            const res = await axios.get(url);
            if (res.data.meta) {
                setHistory(res.data.data);
                setTotalPages(res.data.meta.totalPages);
            } else {
                setHistory(res.data);
                setTotalPages(1);
            }
        } catch (err) {
            console.error('Failed to fetch refunds:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRefundExceptionRequests = async () => {
        setExceptionsLoading(true);
        try {
                        const res = await axios.get('/api/staff/training-sessions/refund-exceptions', {
                params: { status: 'PENDING' } });
            setRefundExceptionRequests(res.data || []);
        } catch (err) {
            console.error('Failed to fetch refund exceptions:', err);
            setRefundExceptionRequests([]);
        } finally {
            setExceptionsLoading(false);
        }
    };

    const [resolveNote, setResolveNote] = useState('');
    const [resolveNoteError, setResolveNoteError] = useState('');
    const [pendingResolve, setPendingResolve] = useState(null); // { session, decision }

    const resolveRefundException = (session, decision) => {
        setResolveNote('');
        setResolveNoteError('');
        setPendingResolve({ session, decision });
    };

    const confirmResolve = async () => {
        if (!pendingResolve) return;
        const { session, decision } = pendingResolve;
        const isApprove = decision === 'APPROVE';
        const note = resolveNote.trim();

        if (!isApprove && !note) {
            setResolveNoteError('Rejection reason is required.');
            return;
        }

        try {
                        await axios.post(
                `/api/staff/training-sessions/${session.id}/refund-exception/resolve`,
                { decision, note });
            setPendingResolve(null);
            await fetchRefundExceptionRequests();
            await showAlert({ title: 'Done!', message: `Refund exception ${isApprove ? 'approved' : 'rejected'}.`, type: 'success' });
        } catch (e) {
            const message = e.response?.data?.error || 'Failed to resolve refund exception';
            const detail = e.response?.data?.detail;
            await showAlert({ title: 'Resolve Failed', message: detail ? `${message}\n\nDetails: ${detail}` : message, type: 'danger' });
        }
    };

    // ΓöÇΓöÇ Render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-white">Refunds &amp; Voids</h1>
                        {/* Tab toggle */}
                        <div className="flex bg-surface border border-white/10 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('HISTORY')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeTab === 'HISTORY'
                                    ? 'bg-primary text-background'
                                    : 'text-text-secondary hover:text-white'
                                    }`}
                            >
                                History
                            </button>
                            <button
                                onClick={() => setActiveTab('EXCEPTIONS')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'EXCEPTIONS'
                                    ? 'bg-primary text-background'
                                    : 'text-text-secondary hover:text-white'
                                    }`}
                            >
                                Exceptions
                                {refundExceptionRequests.length > 0 && (
                                    <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeTab === 'EXCEPTIONS'
                                            ? 'bg-background/20'
                                            : 'bg-red-500 text-white'
                                            }`}
                                    >
                                        {refundExceptionRequests.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                    <p className="text-text-muted text-sm mt-1">
                        {activeTab === 'HISTORY'
                            ? 'View voided and returned transactions'
                            : 'Pending refund exception requests awaiting review'}
                    </p>
                </div>

                {/* Filters (only relevant for history) */}
                {activeTab === 'HISTORY' && (
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
                                    onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
                                    className="bg-transparent border-none text-white text-sm focus:ring-0 p-2 outline-none [color-scheme:dark]"
                                />
                                <span className="text-text-muted">ΓåÆ</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
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
                )}

                {activeTab === 'EXCEPTIONS' && (
                    <button
                        onClick={fetchRefundExceptionRequests}
                        className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors px-3 py-2 rounded-lg border border-white/10 bg-surface"
                    >
                        <span className="material-icons-round">refresh</span>
                    </button>
                )}
            </div>

            {/* ΓöÇΓöÇ HISTORY TAB ΓöÇΓöÇ */}
            {activeTab === 'HISTORY' && (
                <>
                    <DataTable
                        columns={[
                            {
                                header: 'Date',
                                accessor: (pay) => (
                                    <span className="text-white font-medium">
                                        {new Date(pay.date).toLocaleDateString()}{' '}
                                        <span className="text-text-muted font-normal text-xs">
                                            {new Date(pay.date).toLocaleTimeString()}
                                        </span>
                                    </span>
                                ) },
                            {
                                header: 'Status',
                                accessor: (pay) => {
                                    if (pay.status === 'VOIDED')
                                        return <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">VOIDED</span>;
                                    if (pay.status === 'RETURNED')
                                        return <span className="px-2 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">RETURNED</span>;
                                    return <span className="px-2 py-1 rounded text-xs font-bold bg-white/10 text-text-muted">{pay.status}</span>;
                                } },
                            {
                                header: 'Original Amount',
                                accessor: (pay) => <span className="text-white font-medium">{formatPrice(pay.amount)}</span> },
                            {
                                header: 'Refunded',
                                accessor: (pay) => <span className="text-red-400 font-bold">{formatPrice(pay.refundedAmount || pay.amount)}</span> },
                            {
                                header: 'Member',
                                accessor: (pay) => (
                                    <span className="text-white">
                                        {pay.member ? `${pay.member.firstName} ${pay.member.lastName}` : 'Walk-in'}
                                    </span>
                                ) },
                            {
                                header: 'Auth Cashier',
                                accessor: (pay) => <span className="text-white">{pay.cashier?.name || 'N/A'}</span> },
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

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-white/5 pt-4">
                            <span className="text-text-muted text-sm">
                                Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 transition-all text-sm font-medium"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 transition-all text-sm font-medium"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ΓöÇΓöÇ EXCEPTIONS TAB ΓöÇΓöÇ */}
            {activeTab === 'EXCEPTIONS' && (
                <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                    {exceptionsLoading ? (
                        <div className="p-12 text-center text-text-muted">Loading exceptionsΓÇª</div>
                    ) : (
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Session</th>
                                    <th className="px-6 py-4">Member</th>
                                    <th className="px-6 py-4">Trainer</th>
                                    <th className="px-6 py-4">Reason</th>
                                    <th className="px-6 py-4">Requested</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {refundExceptionRequests.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="p-6 text-center text-text-muted">
                                            No pending refund exception requests.
                                        </td>
                                    </tr>
                                )}
                                {refundExceptionRequests.map((session) => (
                                    <tr key={session.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">
                                            {new Date(session.date).toLocaleDateString()}{' '}
                                            <span className="text-text-muted font-normal text-xs">
                                                {new Date(session.date).toLocaleTimeString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {session.member
                                                ? `${session.member.firstName} ${session.member.lastName}`
                                                : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-white">{session.trainer?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-white">
                                            <div className="space-y-1">
                                                <span className="px-2 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    {session.refundException?.request?.reason || 'OTHER'}
                                                </span>
                                                {session.refundException?.request?.details && (
                                                    <p
                                                        className="text-xs text-text-muted max-w-[220px] truncate"
                                                        title={session.refundException.request.details}
                                                    >
                                                        {session.refundException.request.details}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {session.refundException?.request?.requestedAt
                                                ? new Date(session.refundException.request.requestedAt).toLocaleString()
                                                : 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => resolveRefundException(session, 'APPROVE')}
                                                    className="text-xs font-bold px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => resolveRefundException(session, 'REJECT')}
                                                    className="text-xs font-bold px-3 py-1 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
            {/* ΓöÇΓöÇ RESOLVE EXCEPTION MODAL ΓöÇΓöÇ */}
            {pendingResolve && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-[0px] h-full overflow-y-auto w-full">
                    <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md border border-white/10 flex flex-col pointer-events-auto">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${pendingResolve.decision === 'APPROVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    <span className="material-icons-round text-xl">
                                        {pendingResolve.decision === 'APPROVE' ? 'check_circle' : 'cancel'}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {pendingResolve.decision === 'APPROVE' ? 'Approve' : 'Reject'} Exception
                                    </h2>
                                    <p className="text-sm text-text-muted mt-0.5">
                                        {pendingResolve.decision === 'APPROVE' ? 'Add an optional note' : 'A rejection reason is required'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPendingResolve(null)}
                                className="text-text-muted hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                            >
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                        {pendingResolve.decision === 'APPROVE' ? 'Approval Note (Optional)' : 'Rejection Reason'}
                                    </label>
                                    <textarea
                                        value={resolveNote}
                                        onChange={(e) => {
                                            setResolveNote(e.target.value);
                                            if (resolveNoteError) setResolveNoteError('');
                                        }}
                                        className={`w-full bg-background border ${resolveNoteError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-primary'} rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none transition-colors min-h-[100px] resize-none`}
                                        placeholder={pendingResolve.decision === 'APPROVE' ? 'Enter any internal notes here...' : 'Explain why this request is being rejected...'}
                                        autoFocus
                                    />
                                    {resolveNoteError && (
                                        <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1">
                                            <span className="material-icons-round text-[16px]">error_outline</span>
                                            {resolveNoteError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex gap-3">
                            <button
                                onClick={() => setPendingResolve(null)}
                                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmResolve}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-colors ${pendingResolve.decision === 'APPROVE' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
                            >
                                {pendingResolve.decision === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

