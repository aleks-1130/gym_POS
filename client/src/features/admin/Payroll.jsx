import { useConfirm } from '../../context/ConfirmContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';

const Payroll = () => {
    const { alert: showAlert } = useConfirm();
    const { formatPrice } = useCurrency();
    const { user: currentUser } = useAuth();
    const [stats, setStats] = useState({ totalPayrollThisMonth: 0, pendingCommissions: 0, pendingMaterialDeductions: 0 });
    const [trainers, setTrainers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('TRAINERS'); // TRAINERS, STAFF
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

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const params = { startDate: dateRange.start, endDate: dateRange.end };

            const [statsRes, trainersRes, staffRes] = await Promise.all([
                axios.get('/api/admin/payroll/stats', { headers, params }),
                axios.get('/api/admin/payroll/trainers', { headers, params }),
                axios.get('/api/admin/payroll/staff', { headers, params })
            ]);

            setStats(statsRes.data);
            setTrainers(trainersRes.data);
            setStaff(staffRes.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch payroll data", error);
            setLoading(false);
        }
    }, [dateRange.end, dateRange.start]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
    }, [fetchData]);

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

    const submitSalaryPayment = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const base = parseFloat(salaryDetails.baseSalary) || 0;
            const bonus = parseFloat(salaryDetails.bonus) || 0;
            const deductions = parseFloat(salaryDetails.deductions) || 0;
            const netPay = base + bonus - deductions;

            const notes = `Base: ${formatPrice(base)}, Bonus: ${formatPrice(bonus)}, Deductions: -${formatPrice(deductions)}. ${salaryDetails.notes}`;

            const data = {
                title: `Salary Payment: ${selectedUser.name}`,
                amount: netPay,
                category: 'SALARY',
                date: new Date().toISOString(),
                notes: notes,
                [selectedUser.type === 'TRAINER' ? 'trainerId' : 'staffId']: selectedUser.id
            };

            await axios.post('/api/expenses', data, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({ title: 'Payment Recorded', message: 'Salary payment recorded successfully!', type: 'success' });
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Payment Error:", error);
            showAlert({ title: 'Payment Failed', message: error.response?.data?.error || "Failed to record payment", type: 'danger' });
        }
    };

    const submitCommissionPayment = async () => {
        if (selectedSessions.length === 0 && selectedClasses.length === 0) { await showAlert({ title: "Select Items", message: "Please select at least one item to pay.", type: "warning" }); return; }

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/admin/payroll/pay-commissions', {
                trainerId: selectedUser.id,
                sessionIds: selectedSessions,
                classHistoryIds: selectedClasses
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({ title: 'Paid!', message: 'Commissions paid successfully!', type: 'success' });
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Commission Payment Error:", error);
            showAlert({ title: "Payment Failed", message: "Failed to pay commissions", type: "danger" });
        }
    };

    const submitAutoCommissionPayment = async (trainerId, trainerName) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/admin/payroll/pay-commissions-auto', {
                trainerId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({ title: "Auto-Pay Complete", message: `Auto payout completed for ${trainerName}.`, type: "success" });
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Auto Commission Payment Error:", error);
            showAlert({ title: "Auto-Pay Failed", message: error.response?.data?.error || "Failed to auto pay commissions", type: "danger" });
        }
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

    return (
        <div className="space-y-5">
            <header className="rounded-3xl border border-white/10 bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Payroll & Salaries</h1>
                        <p className="mt-1 text-sm text-text-muted">Track compensation, commissions, and deduction settlements.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
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

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-surface p-4">
                    <p className="text-xs uppercase tracking-wide text-text-muted">Total Payroll</p>
                    <p className="mt-1 text-2xl font-bold text-white">{formatPrice(stats.totalPayrollThisMonth)}</p>
                    <p className="mt-1 text-[11px] text-text-muted">Selected date range</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-surface p-4">
                    <p className="text-xs uppercase tracking-wide text-text-muted">Pending Commissions</p>
                    <p className="mt-1 text-2xl font-bold text-amber-300">{formatPrice(stats.pendingCommissions)}</p>
                    <p className="mt-1 text-[11px] text-text-muted">From unpaid sessions and classes</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-surface p-4">
                    <p className="text-xs uppercase tracking-wide text-text-muted">Material Deductions</p>
                    <p className="mt-1 text-2xl font-bold text-red-300">{formatPrice(stats.pendingMaterialDeductions || 0)}</p>
                    <p className="mt-1 text-[11px] text-text-muted">Outstanding tagged purchases</p>
                </article>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface p-3">
                <div className="inline-flex rounded-xl border border-white/10 bg-surfaceHighlight p-1">
                    <button
                        onClick={() => setActiveTab('TRAINERS')}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeTab === 'TRAINERS' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                    >
                        Trainers
                    </button>
                    <button
                        onClick={() => setActiveTab('STAFF')}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeTab === 'STAFF' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                    >
                        Staff
                    </button>
                </div>

                {activeTab === 'TRAINERS' && (
                    <div className="inline-flex flex-wrap gap-2">
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
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center text-text-muted">
                    Loading payroll data...
                </div>
            ) : (
                <div className="rounded-2xl border border-white/10 bg-surface shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-text-muted border-b border-white/10">
                            <tr>
                                <th className="p-4">Name</th>
                                {activeTab === 'TRAINERS' && <th className="p-4">Commission Rate</th>}
                                {activeTab === 'STAFF' && <th className="p-4">Base Salary</th>}
                                <th className="p-4">Paid (Selected Period)</th>
                                {activeTab === 'TRAINERS' && <th className="p-4">Unpaid Commissions</th>}
                                {activeTab === 'TRAINERS' && <th className="p-4">Material Deductions</th>}
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {activeTab === 'TRAINERS' ? (
                                trainers.length === 0 ? (
                                    <tr><td colSpan="7" className="p-6 text-center text-text-muted">No trainers found.</td></tr>
                                ) : (
                                    trainers
                                        .filter(t => trainerFilter === 'ALL' || t.type === trainerFilter)
                                        .map(trainer => (
                                            <tr key={trainer.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-medium text-white flex items-center gap-3">
                                                    {trainer.imageUrl && (
                                                        <img src={`${trainer.imageUrl}`} alt={trainer.name} className="w-8 h-8 rounded-full object-cover" />
                                                    )}
                                                    {trainer.name}
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${trainer.type === 'FREELANCER'
                                                        ? 'bg-orange-500/15 text-orange-300'
                                                        : 'bg-blue-500/15 text-blue-300'
                                                        }`}>
                                                        {trainer.type === 'FREELANCER' ? 'Freelance' : 'Full-time'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-text-secondary">{(trainer.commissionRate * 100).toFixed(0)}%</td>
                                                <td className="p-4 text-emerald-300 font-semibold">{formatPrice(trainer.totalPaid)}</td>
                                                <td className="p-4 text-amber-300 font-semibold">{formatPrice(trainer.unpaidCommissions)}</td>
                                                <td className="p-4 text-red-300 font-semibold">{formatPrice(trainer.outstandingMaterialDeductions || 0)}</td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handlePayCommission(trainer)}
                                                        className="px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={trainer.unpaidCommissions <= 0}
                                                    >
                                                        Pay Commission
                                                    </button>
                                                    <button
                                                        onClick={() => submitAutoCommissionPayment(trainer.id, trainer.name)}
                                                        className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={trainer.unpaidCommissions <= 0}
                                                    >
                                                        Auto Settle
                                                    </button>
                                                    <button
                                                        onClick={() => handleRecordPayment(trainer, 'TRAINER')}
                                                        className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg ${canPaySalary(trainer)
                                                            ? 'bg-blue-500 hover:bg-blue-600'
                                                            : 'bg-white/20 cursor-not-allowed'
                                                            }`}
                                                        disabled={!canPaySalary(trainer)}
                                                        title={!canPaySalary(trainer) ? "Only Owner can pay Admins" : ""}
                                                    >
                                                        Pay Salary
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                )
                            ) : (
                                staff.length === 0 ? (
                                    <tr><td colSpan="4" className="p-6 text-center text-text-muted">No staff found.</td></tr>
                                ) : (
                                    staff.map(user => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-medium text-white">
                                                {user.name} <span className="text-xs text-text-muted ml-2">({user.role})</span>
                                            </td>
                                            <td className="p-4 text-text-secondary">
                                                {user.baseSalary ? formatPrice(user.baseSalary) : '-'}
                                            </td>
                                            <td className="p-4 text-emerald-300 font-semibold">{formatPrice(user.totalPaid)}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleRecordPayment(user, 'STAFF')}
                                                    className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg ${canPaySalary(user)
                                                        ? 'bg-blue-500 hover:bg-blue-600'
                                                        : 'bg-white/20 cursor-not-allowed'
                                                        }`}
                                                    disabled={!canPaySalary(user)}
                                                    title={!canPaySalary(user) ? "Only Owner can pay Admins/Owners" : ""}
                                                >
                                                    Pay Salary
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                    </div>
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
                                        className="flex-1 py-2.5 bg-primary text-background font-bold rounded-xl hover:bg-orange-600"
                                    >
                                        Pay Salary
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


