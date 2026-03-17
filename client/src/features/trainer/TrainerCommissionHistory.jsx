import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import TrainerPageHeader from './components/TrainerPageHeader';

const formatMoney = (amount) =>
    `PHP ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 10);
};

const formatDateLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
};

const formatDateTimeLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return `${date.toLocaleDateString()} - ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const formatSelectedDateLabel = (value, fallback) => {
    if (!value) return fallback;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const toSourceLabel = (source) => {
    const normalized = String(source || '').toUpperCase();
    if (normalized === 'SESSION') return '1-on-1 Session';
    if (normalized === 'CLASS') return 'Class Session';
    return normalized || 'Unknown';
};

const toSourceBadgeClass = (source) => {
    const normalized = String(source || '').toUpperCase();
    if (normalized === 'SESSION') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    if (normalized === 'CLASS') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    return 'bg-white/10 text-text-muted border-white/20';
};

const toSourceIcon = (source) => {
    const normalized = String(source || '').toUpperCase();
    if (normalized === 'SESSION') return 'fitness_center';
    if (normalized === 'CLASS') return 'groups';
    return 'receipt_long';
};

const toStatusBadgeClass = (isPaid) => (
    isPaid
        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
);

const parseDeductionAmount = (notes) => {
    const raw = String(notes || '');
    const match = raw.match(/Material Deduction:\s*-\s*([\d,]+(?:\.\d+)?)/i);
    if (!match?.[1]) return 0;
    const parsed = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const stripDeductionNote = (notes) => {
    const raw = String(notes || '').trim();
    if (!raw) return '';
    return raw
        .replace(/;\s*Material Deduction:\s*-\s*[\d,]+(?:\.\d+)?/ig, '')
        .trim();
};

const parsePayoutDetailLines = (notes) => {
    const cleaned = stripDeductionNote(notes);
    if (!cleaned) return [];
    return cleaned
        .split(';')
        .map((line) => String(line || '').trim())
        .filter(Boolean);
};

const parseAmountFromText = (text) => {
    const matches = String(text || '').match(/PHP\s*([\d,]+(?:\.\d+)?)/gi);
    if (!matches || matches.length === 0) return 0;
    const lastMatch = matches[matches.length - 1];
    const raw = String(lastMatch).replace(/PHP\s*/i, '').replace(/,/g, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parsePayoutDetailEntry = (line) => {
    const raw = String(line || '').trim();
    if (!raw) return null;
    const detailMatch = raw.match(/\(([^)]*)\)\s*$/);
    const detail = detailMatch?.[1] ? String(detailMatch[1]).trim() : '';
    const title = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const amount = parseAmountFromText(detail || raw);
    return {
        title: title || 'Entry',
        detail,
        amount
    };
};

const getPayoutDisplayTitle = (title) => {
    const raw = String(title || '').trim();
    if (!raw) return 'Commission Payout';
    if (/^commission payout:/i.test(raw)) return 'Commission Payout';
    return raw;
};

export default function TrainerCommissionHistory() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [tab, setTab] = useState('commissions');
    const [selectedBreakdown, setSelectedBreakdown] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const startDateInputRef = useRef(null);
    const endDateInputRef = useRef(null);

    const fetchCommissions = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get('/api/trainer/me/commissions');
            setData(res.data || null);
        } catch (e) {
            console.error('Failed to fetch commission history', e);
            setError(e?.response?.data?.error || 'Failed to load commission history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCommissions();
    }, []);

    const openDatePicker = (ref) => {
        const input = ref?.current;
        if (!input) return;
        if (typeof input.showPicker === 'function') input.showPicker();
        else input.click();
    };

    const summary = data?.summary || {};
    const commissions = data?.history?.commissions || [];
    const payouts = data?.history?.payouts || [];

    const commissionStats = useMemo(() => {
        const paidCount = commissions.filter((item) => Boolean(item?.commissionPaid)).length;
        const pendingCount = commissions.length - paidCount;
        return {
            total: commissions.length,
            paidCount,
            pendingCount
        };
    }, [commissions]);

    const sortedCommissions = useMemo(
        () => commissions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
        [commissions]
    );

    const sortedPayouts = useMemo(
        () => payouts.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
        [payouts]
    );

    const filteredCommissions = useMemo(() => {
        if (!startDate && !endDate) return sortedCommissions;
        return sortedCommissions.filter((item) => {
            const itemDate = toDateKey(item?.date);
            if (!itemDate) return false;
            if (startDate && itemDate < startDate) return false;
            if (endDate && itemDate > endDate) return false;
            return true;
        });
    }, [sortedCommissions, startDate, endDate]);

    const filteredPayouts = useMemo(() => {
        if (!startDate && !endDate) return sortedPayouts;
        return sortedPayouts.filter((item) => {
            const itemDate = toDateKey(item?.date);
            if (!itemDate) return false;
            if (startDate && itemDate < startDate) return false;
            if (endDate && itemDate > endDate) return false;
            return true;
        });
    }, [sortedPayouts, startDate, endDate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading commission history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
            <TrainerPageHeader
                title="Commission History"
                subtitle="Track earned commissions, payouts, and unsettled deductions"
                icon="payments"
            />

            {error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-red-200 text-sm">{error}</p>
                    <button
                        type="button"
                        onClick={fetchCommissions}
                        className="h-9 px-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-100 text-xs font-semibold hover:bg-red-500/30"
                    >
                        Retry
                    </button>
                </div>
            ) : null}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-emerald-400 text-xl">payments</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Total Earned</p>
                            <p className="text-base font-bold text-emerald-400 leading-tight mt-1">{formatMoney(summary.totalEarned)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-amber-400 text-xl">hourglass_top</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Pending</p>
                            <p className="text-base font-bold text-amber-300 leading-tight mt-1">{formatMoney(summary.totalUnpaid)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-blue-300 text-xl">account_balance_wallet</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Paid Out</p>
                            <p className="text-base font-bold text-blue-300 leading-tight mt-1">{formatMoney(summary.totalPayoutRecorded)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-rose-300 text-xl">inventory_2</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Total Deduction</p>
                            <p className="text-base font-bold text-rose-300 leading-tight mt-1">-{formatMoney(summary.materialPendingDeduction)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-surface p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                        onClick={() => setTab('commissions')}
                        className={`h-9 rounded-lg font-semibold text-[11px] sm:text-xs transition-all border ${tab === 'commissions'
                            ? 'bg-primary text-background border-primary'
                            : 'bg-background/40 text-text-muted hover:text-white border-white/10'
                            }`}
                    >
                        Commissions ({commissionStats.total})
                    </button>
                    <button
                        onClick={() => setTab('payouts')}
                        className={`h-9 rounded-lg font-semibold text-[11px] sm:text-xs transition-all border ${tab === 'payouts'
                            ? 'bg-primary text-background border-primary'
                            : 'bg-background/40 text-text-muted hover:text-white border-white/10'
                            }`}
                    >
                        Payouts ({sortedPayouts.length})
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        ref={startDateInputRef}
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                    />
                    <button
                        type="button"
                        onClick={() => openDatePicker(startDateInputRef)}
                        className="h-9 flex-1 min-w-0 bg-background/40 border border-white/10 rounded-lg px-2.5 text-xs outline-none focus:border-primary text-left flex items-center gap-2"
                        title="Select start date"
                    >
                        <span className="material-icons-round text-sm text-text-muted shrink-0">event</span>
                        <span className={`truncate ${startDate ? 'text-white' : 'text-text-muted'}`}>
                            {formatSelectedDateLabel(startDate, 'Start date')}
                        </span>
                    </button>

                    <input
                        ref={endDateInputRef}
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                    />
                    <button
                        type="button"
                        onClick={() => openDatePicker(endDateInputRef)}
                        className="h-9 flex-1 min-w-0 bg-background/40 border border-white/10 rounded-lg px-2.5 text-xs outline-none focus:border-primary text-left flex items-center gap-2"
                        title="Select end date"
                    >
                        <span className="material-icons-round text-sm text-text-muted shrink-0">event</span>
                        <span className={`truncate ${endDate ? 'text-white' : 'text-text-muted'}`}>
                            {formatSelectedDateLabel(endDate, 'End date')}
                        </span>
                    </button>

                    {(startDate || endDate) && (
                        <button
                            type="button"
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="h-9 px-3 rounded-lg border border-white/10 bg-background/40 text-text-muted hover:text-white hover:bg-white/5 text-xs font-semibold"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {tab === 'commissions' ? (
                filteredCommissions.length === 0 ? (
                    <div className="bg-surface rounded-xl p-8 text-center border border-white/5">
                        <span className="material-icons-round text-text-muted text-4xl mb-2">receipt_long</span>
                        <p className="text-text-muted text-sm">No commission entries found for selected dates</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="hidden sm:block bg-surface rounded-xl border border-white/5 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-white/5 border-b border-white/5">
                                    <tr className="text-left">
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Date</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Source</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Description</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Status</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredCommissions.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 sm:px-6 py-4">
                                                <div className="text-white text-sm font-medium">{formatDateLabel(item.date)}</div>
                                                <div className="text-text-muted text-xs">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${toSourceBadgeClass(item.source)}`}>
                                                    <span className="material-icons-round text-xs">{toSourceIcon(item.source)}</span>
                                                    {toSourceLabel(item.source)}
                                                </span>
                                            </td>
                                            <td className="px-4 sm:px-6 py-4">
                                                <div className="text-white text-sm font-medium">{item.label || toSourceLabel(item.source)}</div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${toStatusBadgeClass(item.commissionPaid)}`}>
                                                    {item.commissionPaid ? 'PAID' : 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 text-right">
                                                <span className="text-emerald-400 font-bold text-sm">{formatMoney(item.commissionAmount)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="sm:hidden space-y-3">
                            {filteredCommissions.map((item) => (
                                <div key={item.id} className="bg-surface rounded-xl p-4 border border-white/5 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-semibold">{item.label || toSourceLabel(item.source)}</p>
                                            <p className="text-text-muted text-xs mt-0.5">{formatDateTimeLabel(item.date)}</p>
                                        </div>
                                        <p className="text-emerald-400 font-bold text-sm">{formatMoney(item.commissionAmount)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${toSourceBadgeClass(item.source)}`}>
                                            <span className="material-icons-round text-xs">{toSourceIcon(item.source)}</span>
                                            {toSourceLabel(item.source)}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${toStatusBadgeClass(item.commissionPaid)}`}>
                                            {item.commissionPaid ? 'PAID' : 'PENDING'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            ) : (
                filteredPayouts.length === 0 ? (
                    <div className="bg-surface rounded-xl p-8 text-center border border-white/5">
                        <span className="material-icons-round text-text-muted text-4xl mb-2">account_balance_wallet</span>
                        <p className="text-text-muted text-sm">No payout records found for selected dates</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="hidden sm:block bg-surface rounded-xl border border-white/5 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-white/5 border-b border-white/5">
                                    <tr className="text-left">
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Date</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Title</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Deduction</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase text-right">Net Amount</th>
                                        <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase text-right">Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredPayouts.map((item) => {
                                        const deduction = parseDeductionAmount(item.notes);
                                        return (
                                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 sm:px-6 py-4">
                                                    <div className="text-white text-sm font-medium">{formatDateLabel(item.date)}</div>
                                                    <div className="text-text-muted text-xs">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                            <td className="px-4 sm:px-6 py-4">
                                                <p className="text-white text-sm font-semibold">{getPayoutDisplayTitle(item.title)}</p>
                                            </td>
                                                <td className="px-4 sm:px-6 py-4">
                                                    <p className={`text-sm font-semibold ${deduction > 0 ? 'text-rose-300' : 'text-text-muted'}`}>
                                                        {deduction > 0 ? `-${formatMoney(deduction)}` : '-'}
                                                    </p>
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 text-right">
                                                    <span className="text-blue-300 font-bold text-sm">{formatMoney(item.amount)}</span>
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 text-right">
                                                    {deduction > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedBreakdown(item)}
                                                            className="text-primary hover:text-orange-300 font-semibold text-xs"
                                                        >
                                                            View Breakdown
                                                        </button>
                                                    ) : (
                                                        <span className="text-text-muted text-xs">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="sm:hidden space-y-3">
                            {filteredPayouts.map((item) => {
                                const deduction = parseDeductionAmount(item.notes);
                                return (
                                    <div key={item.id} className="bg-surface rounded-xl p-4 border border-white/5 space-y-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-white text-sm font-semibold">{getPayoutDisplayTitle(item.title)}</p>
                                                <p className="text-text-muted text-xs mt-0.5">{formatDateTimeLabel(item.date)}</p>
                                            </div>
                                            <p className="text-blue-300 font-bold text-sm">{formatMoney(item.amount)}</p>
                                        </div>
                                        {deduction > 0 && (
                                            <div className="flex items-center justify-between">
                                                <p className="text-text-muted text-xs">Deduction</p>
                                                <p className="text-rose-300 text-xs font-semibold">-{formatMoney(deduction)}</p>
                                            </div>
                                        )}
                                        {deduction > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedBreakdown(item)}
                                                className="text-primary hover:text-orange-300 font-semibold text-xs"
                                            >
                                                View Breakdown
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            )}

            {selectedBreakdown && (() => {
                const deduction = parseDeductionAmount(selectedBreakdown.notes);
                const netAmount = Number(selectedBreakdown.amount || 0);
                const grossAmount = netAmount + deduction;
                const payoutDetailEntries = parsePayoutDetailLines(selectedBreakdown.notes)
                    .map(parsePayoutDetailEntry)
                    .filter(Boolean);
                const detailAmountTotal = payoutDetailEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

                return (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <div>
                                    <h3 className="text-white font-bold text-base">Payout Breakdown</h3>
                                    <p className="text-text-muted text-xs">{formatDateTimeLabel(selectedBreakdown.date)}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedBreakdown(null)}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                                >
                                    <span className="material-icons-round text-white/70 text-lg">close</span>
                                </button>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">Gross Commission</span>
                                        <span className="text-white font-semibold">{formatMoney(grossAmount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">Material Deduction</span>
                                        <span className="text-rose-300 font-semibold">-{formatMoney(deduction)}</span>
                                    </div>
                                    <div className="h-px bg-white/10" />
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">Net Payout</span>
                                        <span className="text-blue-300 font-bold">{formatMoney(netAmount)}</span>
                                    </div>
                                </div>

                                {payoutDetailEntries.length > 0 ? (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-[11px] text-text-muted uppercase tracking-wide">Included Entries</p>
                                            <span className="text-[11px] text-white/70">{payoutDetailEntries.length}</span>
                                        </div>
                                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                            {payoutDetailEntries.map((entry, index) => (
                                                <div key={`${entry.title}-${index}`} className="rounded-lg border border-white/10 bg-background/30 px-2.5 py-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-xs text-white font-medium leading-relaxed">{entry.title}</p>
                                                        <span className="text-xs text-emerald-300 font-semibold shrink-0">{formatMoney(entry.amount)}</span>
                                                    </div>
                                                    {entry.detail ? (
                                                        <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{entry.detail}</p>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                                            <span className="text-text-muted">Entries Total</span>
                                            <span className="text-white/90 font-semibold">{formatMoney(detailAmountTotal)}</span>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
