import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useConfirm } from '../../context/ConfirmContext';
import { withApiBase } from '../../config/api';

const REFUND_HISTORY_LIMIT = 12;
const EXCEPTIONS_PAGE_SIZE = 6;

const EmptyState = ({ title, description }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <svg
            viewBox="0 0 128 128"
            className="mx-auto h-20 w-20 text-cyan-300/70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <rect x="16" y="20" width="96" height="88" rx="14" stroke="currentColor" strokeWidth="4" />
            <path d="M36 48h56M36 64h56M36 80h34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <circle cx="92" cy="88" r="14" fill="currentColor" fillOpacity="0.2" />
            <path d="M86 88l4 4 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-4 text-base font-bold text-white">{title}</p>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
    </div>
);

const statusBadgeClass = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PENDING') return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
    if (normalized === 'APPROVED') return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300';
    if (normalized === 'REJECTED') return 'border-rose-500/30 bg-rose-500/15 text-rose-300';
    return 'border-white/20 bg-white/10 text-text-muted';
};

const Paging = ({ page, totalPages, onPrev, onNext }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-text-muted">
                Page <span className="font-bold text-white">{page}</span> of {totalPages}
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onPrev}
                    disabled={page <= 1}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 hover:bg-white/10"
                >
                    Previous
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 hover:bg-white/10"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default function StaffRefunds() {
    const { formatPrice } = useCurrency();
    const { alert: showAlert } = useConfirm();

    const [activeTab, setActiveTab] = useState('EXCEPTIONS');

    const [exceptionFilter, setExceptionFilter] = useState('PENDING');
    const [refundExceptionRequests, setRefundExceptionRequests] = useState([]);
    const [exceptionsLoading, setExceptionsLoading] = useState(false);
    const [exceptionPage, setExceptionPage] = useState(1);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotalPages, setHistoryTotalPages] = useState(1);
    const [dateFilterType, setDateFilterType] = useState('ALL_TIME');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const [resolveNote, setResolveNote] = useState('');
    const [resolveNoteError, setResolveNoteError] = useState('');
    const [resolvePin, setResolvePin] = useState('');
    const [resolvePinError, setResolvePinError] = useState('');
    const [resolveStep, setResolveStep] = useState('NOTE');
    const [pendingResolve, setPendingResolve] = useState(null);

    useEffect(() => {
        if (dateFilterType === 'CUSTOM') return;
        const now = new Date();
        let start;
        let end;
        if (dateFilterType === 'THIS_MONTH') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (dateFilterType === 'LAST_MONTH') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (dateFilterType === 'THIS_YEAR') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        } else {
            setDateRange({ start: '', end: '' });
            return;
        }
        setDateRange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
    }, [dateFilterType]);

    const fetchRefundExceptionRequests = useCallback(async () => {
        setExceptionsLoading(true);
        try {
            const res = await axios.get(withApiBase('/api/staff/training-sessions/refund-exceptions'), {
                params: { status: exceptionFilter }
            });
            setRefundExceptionRequests(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch refund exceptions:', err);
            setRefundExceptionRequests([]);
        } finally {
            setExceptionsLoading(false);
        }
    }, [exceptionFilter]);

    const fetchRefundHistory = useCallback(async (page = historyPage) => {
        setHistoryLoading(true);
        try {
            const params = {
                page,
                limit: REFUND_HISTORY_LIMIT,
                type: 'RETURNED'
            };
            if (dateRange.start && dateRange.end) {
                params.startDate = dateRange.start;
                params.endDate = dateRange.end;
            }

            const res = await axios.get(withApiBase('/api/payments/refunds'), { params });
            if (res.data?.meta) {
                setHistory(Array.isArray(res.data.data) ? res.data.data : []);
                setHistoryTotalPages(Number(res.data.meta.totalPages || 1));
            } else {
                const normalized = Array.isArray(res.data) ? res.data : [];
                setHistory(normalized);
                setHistoryTotalPages(1);
            }
        } catch (err) {
            console.error('Failed to fetch refund history:', err);
            setHistory([]);
            setHistoryTotalPages(1);
        } finally {
            setHistoryLoading(false);
        }
    }, [dateRange.end, dateRange.start, historyPage]);

    useEffect(() => {
        if (activeTab === 'EXCEPTIONS') {
            fetchRefundExceptionRequests();
        }
    }, [activeTab, fetchRefundExceptionRequests]);

    useEffect(() => {
        if (activeTab === 'REFUNDS') {
            fetchRefundHistory(historyPage);
        }
    }, [activeTab, fetchRefundHistory, historyPage]);

    useEffect(() => {
        setExceptionPage(1);
    }, [exceptionFilter, refundExceptionRequests.length]);

    useEffect(() => {
        setHistoryPage(1);
    }, [dateRange.start, dateRange.end]);

    const sortedExceptionRequests = useMemo(() => (
        [...refundExceptionRequests].sort((a, b) => {
            const aTime = new Date(a?.updatedAt || a?.date || a?.createdAt || 0).getTime();
            const bTime = new Date(b?.updatedAt || b?.date || b?.createdAt || 0).getTime();
            return bTime - aTime;
        })
    ), [refundExceptionRequests]);

    const exceptionTotalPages = Math.max(1, Math.ceil(sortedExceptionRequests.length / EXCEPTIONS_PAGE_SIZE));
    const visibleExceptionRequests = useMemo(() => {
        const start = (exceptionPage - 1) * EXCEPTIONS_PAGE_SIZE;
        return sortedExceptionRequests.slice(start, start + EXCEPTIONS_PAGE_SIZE);
    }, [exceptionPage, sortedExceptionRequests]);

    useEffect(() => {
        if (exceptionPage > exceptionTotalPages) setExceptionPage(exceptionTotalPages);
    }, [exceptionPage, exceptionTotalPages]);

    const openResolve = (session, decision) => {
        setResolveNote('');
        setResolveNoteError('');
        setResolvePin('');
        setResolvePinError('');
        setResolveStep('NOTE');
        setPendingResolve({ session, decision });
    };

    const continueToPinStep = () => {
        if (!pendingResolve) return;
        const { decision } = pendingResolve;
        const trimmedNote = resolveNote.trim();

        if (decision === 'REJECT' && !trimmedNote) {
            setResolveNoteError('Rejection reason is required.');
            return;
        }
        setResolveNoteError('');
        setResolveStep('PIN');
    };

    const confirmResolve = async () => {
        if (!pendingResolve) return;
        const { session, decision } = pendingResolve;
        const trimmedNote = resolveNote.trim();
        const trimmedPin = resolvePin.trim();
        if (!trimmedPin) {
            setResolvePinError('Admin void PIN is required.');
            return;
        }

        try {
            await axios.post(
                withApiBase(`/api/staff/training-sessions/${session.id}/refund-exception/resolve`),
                { decision, note: trimmedNote, pin: trimmedPin }
            );
            setPendingResolve(null);
            await fetchRefundExceptionRequests();
            await showAlert({
                title: 'Resolved',
                message: `Refund request ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`,
                type: 'success'
            });
        } catch (e) {
            const message = e.response?.data?.error || 'Failed to resolve refund request';
            const detail = e.response?.data?.detail;
            await showAlert({
                title: 'Resolve Failed',
                message: detail ? `${message}\n\nDetails: ${detail}` : message,
                type: 'danger'
            });
        }
    };

    return (
        <div className="space-y-5">
            <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Staff Refund Processing</h1>
                    <p className="text-sm text-text-muted mt-1">Review refund exception requests first, then refund history.</p>
                </div>

                <div className="inline-flex rounded-xl border border-white/10 bg-surface p-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('EXCEPTIONS')}
                        className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === 'EXCEPTIONS' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                    >
                        Exceptions
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('REFUNDS')}
                        className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === 'REFUNDS' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                    >
                        Refund History
                    </button>
                </div>
            </header>

            {activeTab === 'EXCEPTIONS' && (
                <section className="rounded-3xl border border-white/10 bg-surface p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-white text-lg font-bold">Refund Exceptions</h2>
                            <p className="text-xs text-text-muted mt-1">Expanded cards for full request details and faster review.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {['PENDING', 'RESOLVED', 'ALL'].map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setExceptionFilter(status)}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${exceptionFilter === status ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/10 bg-white/5 text-text-secondary hover:text-white'}`}
                                >
                                    {status}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={fetchRefundExceptionRequests}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-white"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    {exceptionsLoading ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">Loading refund exceptions...</div>
                    ) : visibleExceptionRequests.length === 0 ? (
                        <EmptyState title="No Refund Exceptions" description="No requests match the current filter." />
                    ) : (
                        <div className="space-y-3">
                            {visibleExceptionRequests.map((session) => {
                                const request = session?.refundException?.request || {};
                                const status = String(session?.refundException?.status || 'PENDING').toUpperCase();
                                const sessionDate = session?.date ? new Date(session.date) : null;
                                const displayMember = session?.member
                                    ? `${session.member.firstName || ''} ${session.member.lastName || ''}`.trim()
                                    : 'N/A';
                                const entityLabel = String(session?.requestEntity || 'TRAINING_SESSION').replace(/_/g, ' ');

                                return (
                                    <article key={`refund-exception-${session.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(status)}`}>
                                                        {status}
                                                    </span>
                                                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
                                                        {entityLabel}
                                                    </span>
                                                </div>
                                                <p className="text-white text-sm font-bold">
                                                    {sessionDate && !Number.isNaN(sessionDate.getTime())
                                                        ? `${sessionDate.toLocaleDateString()} ${sessionDate.toLocaleTimeString()}`
                                                        : 'No schedule date'}
                                                </p>
                                                <p className="text-xs text-text-muted">Member: <span className="text-white font-semibold">{displayMember}</span></p>
                                                <p className="text-xs text-text-muted">Trainer: <span className="text-white font-semibold">{session?.trainer?.name || 'N/A'}</span></p>
                                            </div>
                                            {status === 'PENDING' ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openResolve(session, 'APPROVE')}
                                                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openResolve(session, 'REJECT')}
                                                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-text-muted">
                                                    Already Resolved
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                                <p className="text-[11px] uppercase tracking-wide text-text-muted">Reason</p>
                                                <p className="mt-1 text-sm font-semibold text-amber-200 break-words">{request.reason || 'OTHER'}</p>
                                            </div>
                                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                                <p className="text-[11px] uppercase tracking-wide text-text-muted">Requested At</p>
                                                <p className="mt-1 text-sm font-semibold text-white">
                                                    {request.requestedAt ? new Date(request.requestedAt).toLocaleString() : 'Unknown'}
                                                </p>
                                            </div>
                                        </div>

                                        {request.details && (
                                            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                                <p className="text-[11px] uppercase tracking-wide text-text-muted">Details</p>
                                                <p className="mt-1 text-sm leading-relaxed text-white/90 break-words">{request.details}</p>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    <Paging
                        page={exceptionPage}
                        totalPages={exceptionTotalPages}
                        onPrev={() => setExceptionPage((p) => Math.max(1, p - 1))}
                        onNext={() => setExceptionPage((p) => Math.min(exceptionTotalPages, p + 1))}
                    />
                </section>
            )}

            {activeTab === 'REFUNDS' && (
                <section className="rounded-3xl border border-white/10 bg-surface p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-white text-lg font-bold">Refund History</h2>
                            <p className="text-xs text-text-muted mt-1">Refund transactions only. Voided transactions are excluded.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={dateFilterType}
                                onChange={(e) => setDateFilterType(e.target.value)}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
                            >
                                <option value="ALL_TIME">All Time</option>
                                <option value="THIS_MONTH">This Month</option>
                                <option value="LAST_MONTH">Last Month</option>
                                <option value="THIS_YEAR">This Year</option>
                                <option value="CUSTOM">Custom</option>
                            </select>
                            {dateFilterType === 'CUSTOM' && (
                                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                                        className="rounded bg-transparent text-xs text-white outline-none [color-scheme:dark]"
                                    />
                                    <span className="text-text-muted text-xs">to</span>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                                        className="rounded bg-transparent text-xs text-white outline-none [color-scheme:dark]"
                                    />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fetchRefundHistory(historyPage)}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-text-secondary hover:text-white"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    {historyLoading ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-text-muted">Loading refund history...</div>
                    ) : history.length === 0 ? (
                        <EmptyState title="No Refund History" description="No refund records found for the selected period." />
                    ) : (
                        <div className="space-y-3">
                            {history.map((pay) => (
                                <article key={`refund-history-${pay.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-white">
                                                {pay?.date ? new Date(pay.date).toLocaleString() : 'Unknown date'}
                                            </p>
                                            <p className="mt-1 text-xs text-text-muted">
                                                Member: <span className="text-white font-semibold">{pay?.member ? `${pay.member.firstName} ${pay.member.lastName}` : 'Walk-in'}</span>
                                            </p>
                                            <p className="text-xs text-text-muted">
                                                Cashier: <span className="text-white font-semibold">{pay?.cashier?.name || 'N/A'}</span>
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                                            Refunded
                                        </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted">Original Amount</p>
                                            <p className="mt-1 text-sm font-bold text-white">{formatPrice(pay?.amount || 0)}</p>
                                        </div>
                                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted">Refunded</p>
                                            <p className="mt-1 text-sm font-bold text-emerald-300">{formatPrice(pay?.refundedAmount || pay?.amount || 0)}</p>
                                        </div>
                                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted">Method</p>
                                            <p className="mt-1 text-sm font-bold text-white">{String(pay?.method || 'N/A').replace(/_/g, ' ')}</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    <Paging
                        page={historyPage}
                        totalPages={historyTotalPages}
                        onPrev={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        onNext={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                    />
                </section>
            )}

            {pendingResolve && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface">
                        <div className="flex items-center justify-between border-b border-white/10 p-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {resolveStep === 'NOTE'
                                        ? (pendingResolve.decision === 'APPROVE' ? 'Approve Refund Request' : 'Reject Refund Request')
                                        : 'Verify Admin Void PIN'}
                                </h3>
                                <p className="text-xs text-text-muted mt-1">
                                    {resolveStep === 'NOTE'
                                        ? (pendingResolve.decision === 'APPROVE'
                                            ? 'Enter optional note, then continue to PIN verification.'
                                            : 'Rejection note is required before PIN verification.')
                                        : 'Enter admin void PIN to finalize this decision.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPendingResolve(null)}
                                className="rounded-lg p-1 text-text-muted hover:bg-white/5 hover:text-white"
                            >
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="p-4">
                            {resolveStep === 'NOTE' ? (
                                <>
                                    <textarea
                                        value={resolveNote}
                                        onChange={(e) => {
                                            setResolveNote(e.target.value);
                                            if (resolveNoteError) setResolveNoteError('');
                                        }}
                                        rows={4}
                                        className={`w-full rounded-xl border bg-background px-3 py-2 text-sm text-white outline-none ${resolveNoteError ? 'border-rose-500/40' : 'border-white/10 focus:border-primary/40'}`}
                                        placeholder={pendingResolve.decision === 'APPROVE' ? 'Add optional note...' : 'Reason for rejection...'}
                                    />
                                    {resolveNoteError && <p className="mt-1 text-xs text-rose-300">{resolveNoteError}</p>}
                                </>
                            ) : (
                                <>
                                    <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                        <p className="text-[11px] uppercase tracking-wide text-text-muted">Note Preview</p>
                                        <p className="mt-1 text-sm text-white break-words">
                                            {resolveNote.trim() || (pendingResolve.decision === 'APPROVE' ? 'No note provided.' : 'No reason provided.')}
                                        </p>
                                    </div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-text-muted mb-1">Admin Void PIN</label>
                                    <input
                                        type="password"
                                        value={resolvePin}
                                        onChange={(e) => {
                                            setResolvePin(e.target.value);
                                            if (resolvePinError) setResolvePinError('');
                                        }}
                                        className={`w-full rounded-xl border bg-background px-3 py-2 text-sm text-white outline-none ${resolvePinError ? 'border-rose-500/40' : 'border-white/10 focus:border-primary/40'}`}
                                        placeholder="Enter admin void PIN"
                                        inputMode="numeric"
                                        autoComplete="off"
                                    />
                                    {resolvePinError && <p className="mt-1 text-xs text-rose-300">{resolvePinError}</p>}
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 border-t border-white/10 p-4">
                            <button
                                type="button"
                                onClick={() => {
                                    if (resolveStep === 'PIN') {
                                        setResolveStep('NOTE');
                                        setResolvePinError('');
                                        return;
                                    }
                                    setPendingResolve(null);
                                }}
                                className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-text-secondary hover:text-white"
                            >
                                {resolveStep === 'PIN' ? 'Back' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={resolveStep === 'PIN' ? confirmResolve : continueToPinStep}
                                className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold text-white ${pendingResolve.decision === 'APPROVE' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                            >
                                {resolveStep === 'PIN' ? 'Confirm' : 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
