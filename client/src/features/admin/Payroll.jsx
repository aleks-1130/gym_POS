import { useConfirm } from '../../context/ConfirmContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/common/DataTable';

const Payroll = () => {
    const { alert: showAlert } = useConfirm();
    const { formatPrice } = useCurrency();
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const activeTab = 'TRAINERS';
    const [trainerFilter, setTrainerFilter] = useState('ALL'); // ALL, FREELANCER, FULLTIME

    // Date Filter State
    const [dateFilterType, setDateFilterType] = useState('THIS_MONTH');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });

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
            default:
                break;
        }
        if (start && end) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDateRange({
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            });
        }
    }, [dateFilterType]);

    // ... (state definitions remain same)

    // Helper: Can current user pay target user?
    const canPaySalary = (targetUser) => {
        if (!currentUser) return false;
        if (currentUser.role === 'OWNER') return true;
        if (currentUser.role === 'ADMIN') {
            // Admin cannot pay Owner or other Admins
            if (targetUser.role === 'OWNER' || targetUser.role === 'ADMIN') return false;
            return true;
        }
        return false;
    };

    // ... (rest of code)


    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('SALARY'); // SALARY, COMMISSION
    const [selectedUser, setSelectedUser] = useState(null); // { id, name, type: 'TRAINER' | 'STAFF', baseSalary, ... }

    // Salary Form State
    const [salaryDetails, setSalaryDetails] = useState({
        baseSalary: '',
        bonus: '',
        deductions: '',
        notes: ''
    });

    // Commission Form State
    const [selectedSessions, setSelectedSessions] = useState([]); // Array of session IDs
    const [selectedClasses, setSelectedClasses] = useState([]); // Array of ClassHistory IDs

    const { data: payrollData, isLoading: loading } = useQuery({
        queryKey: ['adminPayroll', dateRange.start, dateRange.end],
        queryFn: async () => {
            const params = { startDate: dateRange.start, endDate: dateRange.end };
            const [statsRes, trainersRes] = await Promise.all([
                axios.get('/api/admin/payroll/stats', { params }),
                axios.get('/api/admin/payroll/trainers', { params })
            ]);
            return {
                stats: statsRes.data,
                trainers: trainersRes.data
            };
        }
    });

    const stats = payrollData?.stats || { totalPayrollThisMonth: 0, pendingCommissions: 0, pendingMaterialDeductions: 0 };
    const trainers = payrollData?.trainers || [];

    const handleRecordPayment = (user, type) => {
        setSelectedUser({ ...user, type });
        setModalType('SALARY');
        setSalaryDetails({
            baseSalary: user.baseSalary || '',
            bonus: '',
            deductions: '',
            notes: ''
        });
        setShowModal(true);
    };

    const handlePayCommission = (trainer) => {
        setSelectedUser({ ...trainer, type: 'TRAINER' });
        setModalType('COMMISSION');
        setSelectedSessions([]);
        setSelectedClasses([]);
        setShowModal(true);
    };

    const toggleSessionSelection = (sessionId) => {
        setSelectedSessions(prev =>
            prev.includes(sessionId)
                ? prev.filter(id => id !== sessionId)
                : [...prev, sessionId]
        );
    };

    const toggleClassSelection = (classId) => {
        setSelectedClasses(prev =>
            prev.includes(classId)
                ? prev.filter(id => id !== classId)
                : [...prev, classId]
        );
    };

    const salaryMutation = useMutation({
        mutationFn: async (payload) => axios.post('/api/expenses', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPayroll'] });
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            setShowModal(false);
            showAlert({ title: 'Payment Recorded', message: 'Salary payment recorded successfully!', type: 'success' });
        },
        onError: (error) => showAlert({ title: 'Payment Failed', message: error.response?.data?.error || "Failed to record payment", type: 'danger' })
    });

    const submitSalaryPayment = async (e) => {
        e.preventDefault();
        const base = parseFloat(salaryDetails.baseSalary) || 0;
        const bonus = parseFloat(salaryDetails.bonus) || 0;
        const deductions = parseFloat(salaryDetails.deductions) || 0;
        const netPay = base + bonus - deductions;

        const notes = `Base: ${formatPrice(base)}, Bonus: ${formatPrice(bonus)}, Deductions: -${formatPrice(deductions)}. ${salaryDetails.notes}`;

        salaryMutation.mutate({
            title: `Salary Payment: ${selectedUser.name}`,
            amount: netPay,
            category: 'SALARY',
            date: new Date().toISOString(),
            notes: notes,
            trainerId: selectedUser.id
        });
    };

    const commissionMutation = useMutation({
        mutationFn: async (payload) => axios.post('/api/admin/payroll/pay-commissions', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPayroll'] });
            setShowModal(false);
            showAlert({ title: 'Paid!', message: 'Commissions paid successfully!', type: 'success' });
        },
        onError: () => showAlert({ title: "Payment Failed", message: "Failed to pay commissions", type: "danger" })
    });

    const autoCommissionMutation = useMutation({
        mutationFn: async (trainerId) => axios.post('/api/admin/payroll/pay-commissions-auto', { trainerId }),
        onSuccess: (_, trainerId) => {
            queryClient.invalidateQueries({ queryKey: ['adminPayroll'] });
            setShowModal(false);
            showAlert({ title: "Auto-Pay Complete", message: `Auto payout completed.`, type: "success" });
        },
        onError: (error) => showAlert({ title: "Auto-Pay Failed", message: error.response?.data?.error || "Failed to auto pay commissions", type: "danger" })
    });

    const submitCommissionPayment = async () => {
        if (selectedSessions.length === 0 && selectedClasses.length === 0) { await showAlert({ title: "Select Items", message: "Please select at least one item to pay.", type: "warning" }); return; }
        commissionMutation.mutate({
            trainerId: selectedUser.id,
            sessionIds: selectedSessions,
            classHistoryIds: selectedClasses
        });
    };

    const submitAutoCommissionPayment = async (trainerId, trainerName) => {
        autoCommissionMutation.mutate(trainerId);
    };

    // Helper to calculate total of selected sessions
    const calculateSelectedTotal = () => {
        if (!selectedUser) return 0;

        const sessionsTotal = (selectedUser.unpaidSessions || [])
            .filter(s => selectedSessions.includes(s.id))
            .reduce((sum, s) => sum + (s.price * (selectedUser.commissionRate || 0)), 0);

        const classesTotal = (selectedUser.classHistory || [])
            .filter(c => selectedClasses.includes(c.id))
            .reduce((sum, c) => sum + c.commissionAmount, 0);

        return sessionsTotal + classesTotal;
    };

    const calculateNetSelectedPayout = () => {
        if (!selectedUser) return 0;
        return calculateSelectedTotal() - Number(selectedUser.outstandingMaterialDeductions || 0);
    };

    const calculateTaggedMaterialTotal = () => {
        if (!selectedUser) return 0;
        return (selectedUser.materialDeductionItems || []).reduce(
            (sum, item) => sum + Number(item.unsettledTotal || 0),
            0
        );
    };

    const filteredTrainers = trainers.filter((trainer) => trainerFilter === 'ALL' || trainer.type === trainerFilter);
    const trainerGrossPending = filteredTrainers.reduce((sum, trainer) => sum + Number(trainer.unpaidCommissions || 0), 0);
    const trainerOutstandingDeductions = filteredTrainers.reduce((sum, trainer) => sum + Number(trainer.outstandingMaterialDeductions || 0), 0);
    const trainerNetRelease = Math.max(0, trainerGrossPending - trainerOutstandingDeductions);
    const trainerEligibleCount = filteredTrainers.filter((trainer) => Number(trainer.unpaidCommissions || 0) > 0).length;
    const deductionPercent = trainerGrossPending > 0
        ? Math.min(100, (trainerOutstandingDeductions / trainerGrossPending) * 100)
        : 0;
    const netPercent = trainerGrossPending > 0
        ? Math.max(0, (trainerNetRelease / trainerGrossPending) * 100)
        : 0;

    const escapeCsv = (value) => {
        const str = String(value ?? '').replace(/"/g, '""');
        return /[",\n]/.test(str) ? `"${str}"` : str;
    };

    const exportCurrentPayroll = () => {
        const rows = filteredTrainers.map((trainer) => ([
            trainer.name,
            trainer.type === 'FREELANCER' ? 'Freelance' : 'Full-time',
            `${Number(trainer.commissionRate || 0) * 100}%`,
            Number(trainer.totalPaid || 0).toFixed(2),
            Number(trainer.unpaidCommissions || 0).toFixed(2),
            Number(trainer.outstandingMaterialDeductions || 0).toFixed(2)
        ]));

        if (rows.length === 0) {
            showAlert({ title: 'Nothing to Export', message: 'No trainer payroll rows available for export.', type: 'warning' });
            return;
        }

        const headers = ['Name', 'Type', 'Commission Rate', 'Paid Selected Period', 'Unpaid Commissions', 'Material Deductions'];
        const csvBody = [headers, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n');
        const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `payroll-${activeTab.toLowerCase()}-${dateRange.start}-to-${dateRange.end}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const settleAllEligible = async () => {
        const eligibleTrainers = filteredTrainers.filter((trainer) => Number(trainer.unpaidCommissions || 0) > 0);
        if (eligibleTrainers.length === 0) {
            await showAlert({
                title: 'No Eligible Trainers',
                message: 'There are no trainers with unpaid commissions in the current filter.',
                type: 'warning'
            });
            return;
        }

        try {
            const results = await Promise.allSettled(
                eligibleTrainers.map((trainer) =>
                    axios.post('/api/admin/payroll/pay-commissions-auto', { trainerId: trainer.id })
                )
            );
            const successCount = results.filter((entry) => entry.status === 'fulfilled').length;
            const failedCount = results.length - successCount;
            queryClient.invalidateQueries({ queryKey: ['adminPayroll'] });
            await showAlert({
                title: 'Batch Settle Complete',
                message: `Settled ${successCount} trainer(s)${failedCount ? `, ${failedCount} failed.` : '.'}`,
                type: failedCount ? 'warning' : 'success'
            });
        } catch (error) {
            console.error('Settle all error:', error);
            await showAlert({ title: 'Batch Settle Failed', message: 'Unable to settle all eligible trainers.', type: 'danger' });
        }
    };

    const payrollTable = (
        <DataTable
            columns={[
                {
                    header: 'Name',
                    accessor: (trainer) => (
                        <div className="flex items-center gap-3">
                            {trainer.imageUrl && (
                                <img src={`${trainer.imageUrl}`} alt={trainer.name} className="h-8 w-8 rounded-full object-cover" />
                            )}
                            <span className="truncate font-medium text-white">{trainer.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${trainer.type === 'FREELANCER'
                                ? 'bg-orange-500/15 text-orange-300'
                                : 'bg-blue-500/15 text-blue-300'
                                }`}>
                                {trainer.type === 'FREELANCER' ? 'Freelance' : 'Full-time'}
                            </span>
                        </div>
                    ),
                    className: 'w-[38%]'
                },
                {
                    header: 'Commission',
                    accessor: (trainer) => <span className="text-text-secondary font-semibold">{(Number(trainer.commissionRate || 0) * 100).toFixed(0)}%</span>,
                    className: 'w-[12%] text-right',
                    cellClassName: 'text-right'
                },
                {
                    header: 'Paid (Period)',
                    accessor: (trainer) => <span className="font-semibold text-emerald-300">{formatPrice(trainer.totalPaid)}</span>,
                    className: 'w-[12%] text-right',
                    cellClassName: 'text-right'
                },
                {
                    header: 'Unpaid',
                    accessor: (trainer) => <span className="font-semibold text-amber-300">{formatPrice(trainer.unpaidCommissions)}</span>,
                    className: 'w-[10%] text-right',
                    cellClassName: 'text-right'
                },
                {
                    header: 'Deductions',
                    accessor: (trainer) => <span className="font-semibold text-red-300">{formatPrice(trainer.outstandingMaterialDeductions || 0)}</span>,
                    className: 'w-[10%] text-right',
                    cellClassName: 'text-right'
                }
            ]}
            data={filteredTrainers}
            emptyMessage="No trainers found."
            actions={(row) => (
                <div className="flex justify-end gap-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePayCommission(row); }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${row.unpaidCommissions > 0
                            ? 'bg-primary text-background hover:bg-orange-600'
                            : 'cursor-not-allowed border border-white/10 bg-white/5 text-text-muted'
                            }`}
                        disabled={row.unpaidCommissions <= 0}
                    >
                        Pay Commission
                    </button>
                    <details className="relative" onClick={(e) => e.stopPropagation()}>
                        <summary className="list-none cursor-pointer rounded-lg border border-white/10 px-2.5 py-1.5 text-sm font-semibold text-text-secondary transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
                            ⋯
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-white/10 bg-surfaceHighlight p-1 shadow-2xl">
                            <button
                                onClick={() => submitAutoCommissionPayment(row.id, row.name)}
                                className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${row.unpaidCommissions > 0
                                    ? 'text-rose-300 hover:bg-white/5'
                                    : 'cursor-not-allowed text-text-muted'
                                    }`}
                                disabled={row.unpaidCommissions <= 0}
                            >
                                Auto Settle
                            </button>
                            <button
                                onClick={() => handleRecordPayment(row, 'TRAINER')}
                                className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${canPaySalary(row)
                                    ? 'text-blue-300 hover:bg-white/5'
                                    : 'cursor-not-allowed text-text-muted'
                                    }`}
                                disabled={!canPaySalary(row) || salaryMutation.isPending}
                                title={!canPaySalary(row) ? "Only Owner can pay Admins" : ""}
                            >
                                Pay Salary
                            </button>
                        </div>
                    </details>
                </div>
            )}
        />
    );

    return (
        <div className="space-y-5">
            <header className="rounded-3xl border border-white/10 bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Payroll & Salaries</h1>
                        <p className="mt-1 text-sm text-text-muted">Track compensation, commissions, and deduction settlements.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={exportCurrentPayroll}
                            className="rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-primary/50 hover:text-primary"
                        >
                            Export CSV
                        </button>
                        <select
                            value={dateFilterType}
                            onChange={(e) => setDateFilterType(e.target.value)}
                            className="rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white outline-none transition-colors focus:border-primary"
                        >
                            <option value="THIS_MONTH">This Month</option>
                            <option value="LAST_MONTH">Last Month</option>
                            <option value="THIS_YEAR">This Year</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>

                        {dateFilterType === 'CUSTOM' && (
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surfaceHighlight p-1.5">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="rounded-lg bg-transparent px-2 py-1 text-sm text-white outline-none"
                                />
                                <span className="text-text-muted">→</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="rounded-lg bg-transparent px-2 py-1 text-sm text-white outline-none"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <section className="flex flex-wrap gap-2">
                <div className="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-text-muted">Total Payroll</p>
                        <p className="mt-1 text-base font-bold text-white">{formatPrice(stats.totalPayrollThisMonth)}</p>
                        <p className="text-[10px] text-text-muted">Current period</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-amber-300">Pending Commission</p>
                        <p className="mt-1 text-base font-bold text-amber-300">{formatPrice(stats.pendingCommissions)}</p>
                        <p className="text-[10px] text-amber-300/80">Awaiting payout</p>
                    </div>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-red-300">Deductions</p>
                        <p className="mt-1 text-base font-bold text-red-300">{formatPrice(stats.pendingMaterialDeductions || 0)}</p>
                        <p className="text-[10px] text-red-300/80">Tagged purchases</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-text-muted">Records</p>
                        <p className="mt-1 text-base font-bold text-white">{filteredTrainers.length}</p>
                        <p className="text-[10px] text-text-muted">In current view</p>
                    </div>
                </div>
            </section>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="rounded-xl border border-white/10 bg-surfaceHighlight px-4 py-2.5 md:max-w-xl">
                    <p className="text-sm font-semibold text-white">Trainer Payroll View</p>
                </div>

                <div className="inline-flex flex-wrap gap-2 md:justify-end">
                    {[{ label: 'All', value: 'ALL' }, { label: 'Freelancers', value: 'FREELANCER' }, { label: 'Full-time', value: 'FULLTIME' }].map(f => (
                        <button
                            key={f.value}
                            onClick={() => setTrainerFilter(f.value)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${trainerFilter === f.value
                                ? 'border-primary/50 bg-primary/10 text-primary'
                                : 'border-white/10 text-text-secondary hover:text-white'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center text-text-muted">
                    Loading payroll data...
                </div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    {payrollTable}
                    <aside className="h-fit rounded-2xl border border-white/10 bg-surface p-4 shadow-sm xl:sticky xl:top-24">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Release Summary</h3>
                        <div className="mt-3 space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-text-muted">Trainers in view</span>
                                <span className="font-bold text-white">{filteredTrainers.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-text-muted">Selected payouts</span>
                                <span className="font-bold text-amber-300">{formatPrice(trainerGrossPending)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-text-muted">Outstanding deductions</span>
                                <span className="font-bold text-red-300">-{formatPrice(trainerOutstandingDeductions)}</span>
                            </div>
                            <div className="space-y-1.5">
                                <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                                    <div className="h-full bg-red-400/70" style={{ width: `${deductionPercent}%` }} />
                                </div>
                                <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                                    <div className="h-full bg-emerald-400/80" style={{ width: `${netPercent}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-text-muted">
                                    <span>Deductions</span>
                                    <span>Net</span>
                                </div>
                            </div>
                            <div className="border-t border-white/10 pt-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-white">Net to release</span>
                                    <span className={`text-lg font-extrabold ${trainerNetRelease > 0 ? 'text-emerald-300' : 'text-text-muted'}`}>
                                        {formatPrice(trainerNetRelease)}
                                    </span>
                                </div>
                                {trainerGrossPending < trainerOutstandingDeductions && (
                                    <p className="mt-2 text-[11px] text-red-300">
                                        Deductions currently exceed pending commissions.
                                    </p>
                                )}
                                <button
                                    onClick={settleAllEligible}
                                    disabled={trainerEligibleCount === 0}
                                    className={`mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${trainerEligibleCount > 0
                                        ? 'bg-primary text-background hover:bg-orange-600'
                                        : 'cursor-not-allowed border border-white/10 bg-white/5 text-text-muted'
                                        }`}
                                >
                                    Settle All Eligible ({trainerEligibleCount})
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            {/* Payments Modal */}
            {showModal && selectedUser && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
                        <h2 className="text-xl font-bold mb-2 text-white">
                            {modalType === 'SALARY' ? 'Record Salary Payment' : 'Pay Commissions'}
                        </h2>
                        <p className="text-sm text-text-muted mb-6">
                            For: <span className="font-semibold text-white">{selectedUser.name}</span>
                        </p>

                        {modalType === 'SALARY' ? (
                            <form onSubmit={submitSalaryPayment} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-text-muted mb-1">Base Salary</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight p-2.5 text-white outline-none focus:border-primary"
                                        value={salaryDetails.baseSalary}
                                        onChange={e => setSalaryDetails({ ...salaryDetails, baseSalary: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-text-muted mb-1">Bonus (+)</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-xl border border-white/10 bg-surfaceHighlight p-2.5 text-emerald-300 outline-none focus:border-primary"
                                            value={salaryDetails.bonus}
                                            onChange={e => setSalaryDetails({ ...salaryDetails, bonus: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-text-muted mb-1">Deductions (-)</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-xl border border-white/10 bg-surfaceHighlight p-2.5 text-red-300 outline-none focus:border-primary"
                                            value={salaryDetails.deductions}
                                            onChange={e => setSalaryDetails({ ...salaryDetails, deductions: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 bg-surfaceHighlight rounded-xl border border-white/10 flex justify-between items-center">
                                    <span className="font-medium text-text-muted">Net Pay:</span>
                                    <span className="text-xl font-bold text-white">
                                        {formatPrice(
                                            (parseFloat(salaryDetails.baseSalary) || 0) +
                                            (parseFloat(salaryDetails.bonus) || 0) -
                                            (parseFloat(salaryDetails.deductions) || 0)
                                        )}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-sm text-text-muted mb-1">Notes / Remarks</label>
                                    <textarea
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight p-2.5 text-white outline-none focus:border-primary"
                                        value={salaryDetails.notes}
                                        onChange={e => setSalaryDetails({ ...salaryDetails, notes: e.target.value })}
                                        placeholder="Specific details..."
                                        rows="2"
                                    />
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 border border-white/10 bg-white/5 text-text-secondary rounded-xl hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={salaryMutation.isPending}
                                        className="flex-1 py-2.5 bg-primary text-background font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50"
                                    >
                                        {salaryMutation.isPending ? 'Saving...' : 'Pay Salary'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                {/* Training Sessions Table */}
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-semibold text-white">Training Sessions</h3>
                                    {selectedUser.unpaidSessions?.length > 0 && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSessions(selectedUser.unpaidSessions.map(s => s.id))}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSessions([])}
                                                className="text-xs text-text-muted hover:underline"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white/5 text-text-muted sticky top-0">
                                            <tr>
                                                <th className="p-2 w-10">Select</th>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Member</th>
                                                <th className="p-2 text-right">Calculation</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {selectedUser.unpaidSessions?.map(session => {
                                                const rate = selectedUser.commissionRate || 0;
                                                const comm = session.price * rate;
                                                return (
                                                    <tr key={session.id} className="hover:bg-white/5">
                                                        <td className="p-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSessions.includes(session.id)}
                                                                onChange={() => toggleSessionSelection(session.id)}
                                                                className="rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-text-secondary text-xs">
                                                            {new Date(session.date).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-2 text-white">
                                                            {session.member ? `${session.member.firstName} ${session.member.lastName || ''}`.trim() : `Session #${session.id}`}
                                                        </td>
                                                        <td className="p-2 text-right text-xs">
                                                            <span className="text-text-muted">{formatPrice(session.price)} × {(rate * 100).toFixed(0)}% = </span>
                                                            <span className="text-amber-300 font-medium">{formatPrice(comm)}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {(!selectedUser.unpaidSessions || selectedUser.unpaidSessions.length === 0) && (
                                                <tr><td colSpan="4" className="p-4 text-center text-text-muted">No unpaid sessions.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Class History Table */}
                                <div className="flex items-center justify-between mb-1 pt-2">
                                    <h3 className="text-sm font-semibold text-white">Class Commissions</h3>
                                    {selectedUser.classHistory?.length > 0 && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedClasses(selectedUser.classHistory.map(c => c.id))}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedClasses([])}
                                                className="text-xs text-text-muted hover:underline"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white/5 text-text-muted sticky top-0">
                                            <tr>
                                                <th className="p-2 w-10">Select</th>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Class</th>
                                                <th className="p-2 text-right">Comm.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {selectedUser.classHistory?.map(cls => (
                                                <tr key={cls.id} className="hover:bg-white/5">
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedClasses.includes(cls.id)}
                                                            onChange={() => toggleClassSelection(cls.id)}
                                                            className="rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-text-secondary">
                                                        {new Date(cls.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-2 text-white">
                                                        {cls.class?.name} ({cls.attendeeCount} attendees)
                                                    </td>
                                                    <td className="p-2 text-right text-xs">
                                                        <span className="text-amber-300 font-medium">{formatPrice(cls.commissionAmount)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!selectedUser.classHistory || selectedUser.classHistory.length === 0) && (
                                                <tr><td colSpan="4" className="p-4 text-center text-text-muted">No unpaid classes.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Tagged Material Purchases Table */}
                                <div className="flex items-center justify-between mb-1 pt-2">
                                    <h3 className="text-sm font-semibold text-white">Tagged Material Purchases</h3>
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white/5 text-text-muted sticky top-0">
                                            <tr>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Item</th>
                                                <th className="p-2 text-center">Qty</th>
                                                <th className="p-2 text-right">Unit</th>
                                                <th className="p-2 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {(selectedUser.materialDeductionItems || []).map((item) => (
                                                <tr key={item.paymentItemId} className="hover:bg-white/5">
                                                    <td className="p-2 text-text-secondary text-xs">
                                                        {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="p-2 text-white text-xs font-medium">
                                                        {item.name}
                                                    </td>
                                                    <td className="p-2 text-center text-text-secondary text-xs">
                                                        {item.unsettledQty}
                                                    </td>
                                                    <td className="p-2 text-right text-text-secondary text-xs">
                                                        {formatPrice(item.unitPrice)}
                                                    </td>
                                                    <td className="p-2 text-right text-red-300 text-xs font-semibold">
                                                        {formatPrice(item.unsettledTotal)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!selectedUser.materialDeductionItems || selectedUser.materialDeductionItems.length === 0) && (
                                                <tr><td colSpan="5" className="p-4 text-center text-text-muted">No tagged material purchases pending.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                    <div className="flex justify-between items-center">
                                        <span className="text-amber-300 font-medium">Gross Selected:</span>
                                        <span className="text-xl font-bold text-amber-300">
                                            {formatPrice(calculateSelectedTotal())}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-red-300 font-medium">Material Deductions:</span>
                                        <span className="font-bold text-red-300">
                                            -{formatPrice(calculateTaggedMaterialTotal())}
                                        </span>
                                    </div>
                                    <div className="border-t border-amber-500/20 pt-2 flex justify-between items-center">
                                        <span className="text-white font-bold">Net Payout:</span>
                                        <span className={`text-xl font-extrabold ${calculateNetSelectedPayout() < 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                                            {formatPrice(Math.max(0, calculateNetSelectedPayout()))}
                                        </span>
                                    </div>
                                    {calculateNetSelectedPayout() < 0 && (
                                        <p className="text-[11px] text-red-300">
                                            Selected commissions are lower than outstanding material deductions.
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 border border-white/10 bg-white/5 text-text-secondary rounded-xl hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitCommissionPayment}
                                        disabled={(selectedSessions.length === 0 && selectedClasses.length === 0) || calculateNetSelectedPayout() < 0}
                                        className="flex-1 py-2.5 bg-primary text-background font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Pay Selected ({selectedSessions.length + selectedClasses.length})
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payroll;


