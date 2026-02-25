import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

const DEFAULT_ASSUMPTIONS = {
    projectedMembers: 100,
    avgMemberRevenue: 1200,
    productSales: 30000,
    trainerCommissions: 20000,
    staffPayroll: 25000,
    fixedCosts: 15000,
    inventoryCost: 10000
};

function InputRow({ label, hint, value, onChange, color = 'primary' }) {
    const borderColor = color === 'green'
        ? 'border-emerald-500/30 focus:border-emerald-400'
        : color === 'red'
            ? 'border-red-500/30 focus:border-red-400'
            : 'border-white/10 focus:border-primary';
    return (
        <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">{label}</label>
            {hint && <p className="text-[11px] text-text-muted mb-2">{hint}</p>}
            <input
                type="number"
                min="0"
                value={value}
                onChange={e => onChange(Number(e.target.value) || 0)}
                className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white focus:outline-none transition-colors text-sm ${borderColor}`}
            />
        </div>
    );
}

// Inline P&L row — shows actual beside projected when comparison is on
function PnLRow({ label, projected, actual, sub, bold = false, large = false, border = false, isExpense = false }) {
    const { formatPrice } = useCurrency();
    const showActual = actual !== undefined && actual !== null;
    const delta = showActual ? projected - actual : 0;
    // Revenue: higher projected = good. Expense: lower projected = good.
    const isPositiveDelta = isExpense ? delta <= 0 : delta >= 0;

    return (
        <div className={`flex items-center gap-2 ${border ? 'border-t border-white/10 pt-3 mt-1' : ''}`}>
            <div className="flex-1 min-w-0">
                <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-text-muted'}`}>{label}</span>
                {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
            </div>
            {showActual && (
                <div className="text-right min-w-[90px]">
                    <span className="text-xs text-text-muted tabular-nums">{formatPrice(actual)}</span>
                    <p className="text-[9px] text-text-muted/50">actual</p>
                </div>
            )}
            <div className="text-right min-w-[110px]">
                <span className={`font-bold tabular-nums ${large ? 'text-xl' : 'text-sm'} ${showActual && bold ? (isPositiveDelta ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>
                    {formatPrice(projected)}
                </span>
                {showActual && bold && delta !== 0 && (
                    <p className={`text-[9px] mt-0.5 ${isPositiveDelta ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                        {delta >= 0 ? '+' : ''}{formatPrice(delta)} vs actual
                    </p>
                )}
            </div>
        </div>
    );
}

export default function Projections() {
    const { formatPrice } = useCurrency();
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
    const [showComparison, setShowComparison] = useState(false);

    useEffect(() => { fetchSnapshot(); }, []);

    const fetchSnapshot = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/owner/projection/snapshot', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const snap = res.data;
            setSnapshot(snap);
            setAssumptions({
                projectedMembers: snap.activeMembers || DEFAULT_ASSUMPTIONS.projectedMembers,
                avgMemberRevenue: snap.avgRevenuePerMember || DEFAULT_ASSUMPTIONS.avgMemberRevenue,
                productSales: Math.round(snap.productRevenueLast30d) || DEFAULT_ASSUMPTIONS.productSales,
                trainerCommissions: Math.round(snap.trainerCommissionsLast30d) || DEFAULT_ASSUMPTIONS.trainerCommissions,
                staffPayroll: 0,
                fixedCosts: Math.round(snap.fixedExpensesLast30d) || DEFAULT_ASSUMPTIONS.fixedCosts,
                inventoryCost: Math.round(snap.inventoryCostLast30d) || DEFAULT_ASSUMPTIONS.inventoryCost
            });
        } catch (e) {
            console.error('Failed to load projection snapshot', e);
            setError('Could not load actual data. You can still adjust projections manually.');
        } finally {
            setLoading(false);
        }
    };

    const updateAssumption = (key, value) => setAssumptions(prev => ({ ...prev, [key]: value }));

    const projection = useMemo(() => {
        const membershipRevenue = assumptions.projectedMembers * assumptions.avgMemberRevenue;
        const grossRevenue = membershipRevenue + assumptions.productSales;
        const totalExpenses = assumptions.trainerCommissions + assumptions.staffPayroll + assumptions.fixedCosts + assumptions.inventoryCost;
        const netProfit = grossRevenue - totalExpenses;
        const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
        const breakEvenMembers = assumptions.avgMemberRevenue > 0
            ? Math.ceil((totalExpenses - assumptions.productSales) / assumptions.avgMemberRevenue) : 0;
        return { membershipRevenue, grossRevenue, totalExpenses, netProfit, profitMargin, breakEvenMembers, isHealthy: netProfit > 0 };
    }, [assumptions]);

    // Actual values from snapshot for inline comparison
    const actual = snapshot ? {
        membershipRevenue: snapshot.membershipRevenueLast30d,
        productSales: snapshot.productRevenueLast30d,
        grossRevenue: snapshot.membershipRevenueLast30d + snapshot.productRevenueLast30d,
        trainerCommissions: snapshot.trainerCommissionsLast30d,
        staffPayroll: 0,
        fixedCosts: snapshot.fixedExpensesLast30d,
        inventoryCost: snapshot.inventoryCostLast30d,
        totalExpenses: snapshot.trainerCommissionsLast30d + snapshot.fixedExpensesLast30d + snapshot.inventoryCostLast30d,
        netProfit: (snapshot.membershipRevenueLast30d + snapshot.productRevenueLast30d)
            - (snapshot.trainerCommissionsLast30d + snapshot.fixedExpensesLast30d + snapshot.inventoryCostLast30d)
    } : null;

    // Helper: returns actual value only when comparison mode is on and snapshot is loaded
    const cmp = (key) => (showComparison && actual) ? actual[key] : undefined;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Scenario Planner</h1>
                    <p className="text-text-muted mt-1">Model "what-if" scenarios to project monthly profitability</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowComparison(v => !v)}
                        disabled={!snapshot}
                        title={!snapshot ? 'Actual data unavailable' : 'Show actual last-30d figures beside each projection'}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${showComparison
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'bg-white/5 border-white/10 text-text-secondary hover:text-white'}`}
                    >
                        <span className="material-icons-round text-[15px] align-middle mr-1">compare_arrows</span>
                        {showComparison ? 'Hide Actual' : 'Compare to Actual'}
                    </button>
                    <button onClick={fetchSnapshot}
                        className="px-4 py-2 rounded-xl text-sm font-bold border border-white/10 bg-white/5 text-text-secondary hover:text-white transition-all">
                        <span className="material-icons-round text-[15px] align-middle mr-1">refresh</span>
                        Refresh Actuals
                    </button>
                </div>
            </header>

            {error ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-400 text-sm">
                    <span className="material-icons-round text-[18px]">warning</span>{error}
                </div>
            ) : (
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
                    <span className="material-icons-round text-primary mt-0.5">info</span>
                    <div>
                        <p className="text-white text-sm font-semibold">Inputs pre-filled from last 30 days of actual data</p>
                        <p className="text-text-muted text-xs mt-1">
                            Adjust any value to model different scenarios.
                            {!showComparison && <> Toggle <strong>Compare to Actual</strong> to see real figures directly beside each projected line.</>}
                        </p>
                    </div>
                </div>
            )}

            {/* Global column labels when comparison is ON */}
            {showComparison && (
                <div className="flex justify-end gap-4 pr-1">
                    <span className="min-w-[90px] text-right text-[10px] font-bold uppercase tracking-widest text-text-muted">Last 30d Actual</span>
                    <span className="min-w-[110px] text-right text-[10px] font-bold uppercase tracking-widest text-primary">Projected</span>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-start">

                {/* ── LEFT: Assumptions ── */}
                <div className="space-y-6">
                    <div className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-icons-round text-emerald-400 text-[18px]">trending_up</span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Income Assumptions</h3>
                        </div>
                        <InputRow label="Projected Active Members"
                            hint={snapshot ? `Current actual: ${snapshot.activeMembers} active members` : ''}
                            value={assumptions.projectedMembers} onChange={v => updateAssumption('projectedMembers', v)} color="green" />
                        <InputRow label="Avg Revenue per Member (₱/mo)"
                            hint={snapshot ? `Current actual: ₱${snapshot.avgRevenuePerMember?.toLocaleString()} avg` : ''}
                            value={assumptions.avgMemberRevenue} onChange={v => updateAssumption('avgMemberRevenue', v)} color="green" />
                        <InputRow label="Projected Product Sales (₱/mo)"
                            hint={snapshot ? `Last 30d actual: ₱${snapshot.productRevenueLast30d?.toLocaleString()}` : ''}
                            value={assumptions.productSales} onChange={v => updateAssumption('productSales', v)} color="green" />
                    </div>

                    <div className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-icons-round text-red-400 text-[18px]">trending_down</span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Expense Assumptions</h3>
                        </div>
                        <InputRow label="Trainer Commissions (₱/mo)"
                            hint={snapshot ? `Last 30d actual: ₱${snapshot.trainerCommissionsLast30d?.toLocaleString()}` : ''}
                            value={assumptions.trainerCommissions} onChange={v => updateAssumption('trainerCommissions', v)} color="red" />
                        <InputRow label="Staff Payroll (₱/mo)"
                            value={assumptions.staffPayroll} onChange={v => updateAssumption('staffPayroll', v)} color="red" />
                        <InputRow label="Fixed Costs / Overhead (₱/mo)"
                            hint={snapshot ? `Last 30d actual: ₱${snapshot.fixedExpensesLast30d?.toLocaleString()} (utilities, rent, etc.)` : ''}
                            value={assumptions.fixedCosts} onChange={v => updateAssumption('fixedCosts', v)} color="red" />
                        <InputRow label="Inventory / COGS (₱/mo)"
                            hint={snapshot ? `Last 30d actual: ₱${snapshot.inventoryCostLast30d?.toLocaleString()}` : ''}
                            value={assumptions.inventoryCost} onChange={v => updateAssumption('inventoryCost', v)} color="red" />
                    </div>
                </div>

                {/* ── RIGHT: Income Statement ── */}
                <div className="space-y-4">
                    {/* Net hero card */}
                    <div className={`rounded-2xl border p-6 text-center ${projection.isHealthy ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Projected Monthly Net</p>
                        <p className={`text-4xl font-bold ${projection.isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatPrice(projection.netProfit)}
                        </p>
                        {showComparison && actual && (
                            <p className="text-xs text-text-muted mt-2">
                                vs. <span className="font-bold text-white">{formatPrice(actual.netProfit)}</span> actual last 30d
                            </p>
                        )}
                        <p className={`text-sm mt-2 font-semibold ${projection.isHealthy ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                            {projection.isHealthy ? '✓ Business is profitable at this scale' : '✗ Expenses exceed revenue at this scale'}
                        </p>
                    </div>

                    {/* P&L statement with inline actual column */}
                    <div className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Projected Income Statement</h3>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70 mb-2">Income</p>
                            <div className="space-y-2 pl-3 border-l-2 border-emerald-500/20">
                                <PnLRow label="Membership Revenue" projected={projection.membershipRevenue} actual={cmp('membershipRevenue')}
                                    sub={`${assumptions.projectedMembers} members × ₱${assumptions.avgMemberRevenue.toLocaleString()}`} />
                                <PnLRow label="Product Sales" projected={assumptions.productSales} actual={cmp('productSales')} />
                            </div>
                            <PnLRow label="Gross Revenue" projected={projection.grossRevenue} actual={cmp('grossRevenue')} bold border />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 mb-2">Expenses</p>
                            <div className="space-y-2 pl-3 border-l-2 border-red-500/20">
                                <PnLRow label="Trainer Commissions" projected={assumptions.trainerCommissions} actual={cmp('trainerCommissions')} isExpense />
                                <PnLRow label="Staff Payroll" projected={assumptions.staffPayroll} actual={cmp('staffPayroll')} isExpense />
                                <PnLRow label="Fixed Costs / Overhead" projected={assumptions.fixedCosts} actual={cmp('fixedCosts')} isExpense />
                                <PnLRow label="Inventory / COGS" projected={assumptions.inventoryCost} actual={cmp('inventoryCost')} isExpense />
                            </div>
                            <PnLRow label="Total Expenses" projected={projection.totalExpenses} actual={cmp('totalExpenses')} bold border isExpense />
                        </div>

                        <PnLRow label="Net Profit / Loss" projected={projection.netProfit} actual={cmp('netProfit')} bold large border />
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface border border-white/5 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Profit Margin</p>
                            <p className={`text-2xl font-bold ${projection.profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {projection.profitMargin.toFixed(1)}%
                            </p>
                            <p className="text-[11px] text-text-muted mt-1">
                                {projection.profitMargin >= 20 ? 'Healthy' : projection.profitMargin >= 0 ? 'Thin margin' : 'Loss-making'}
                            </p>
                        </div>
                        <div className="bg-surface border border-white/5 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Break-Even Members</p>
                            <p className={`text-2xl font-bold ${assumptions.projectedMembers >= projection.breakEvenMembers ? 'text-emerald-400' : 'text-red-400'}`}>
                                {projection.breakEvenMembers > 0 ? projection.breakEvenMembers : '—'}
                            </p>
                            <p className="text-[11px] text-text-muted mt-1">
                                {assumptions.projectedMembers >= projection.breakEvenMembers
                                    ? `✓ ${assumptions.projectedMembers - projection.breakEvenMembers} above break-even`
                                    : `✗ Need ${projection.breakEvenMembers - assumptions.projectedMembers} more members`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
