import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';

const Payroll = () => {
    const { formatPrice } = useCurrency();
    const { user: currentUser } = useAuth();
    const [stats, setStats] = useState({ totalPayrollThisMonth: 0, pendingCommissions: 0, pendingMaterialDeductions: 0 });
    const [trainers, setTrainers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('TRAINERS'); // TRAINERS, STAFF
    const [trainerFilter, setTrainerFilter] = useState('ALL'); // ALL, FREELANCER, FULLTIME

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

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [statsRes, trainersRes, staffRes] = await Promise.all([
                axios.get('http://localhost:5000/api/admin/payroll/stats', { headers }),
                axios.get('http://localhost:5000/api/admin/payroll/trainers', { headers }),
                axios.get('http://localhost:5000/api/admin/payroll/staff', { headers })
            ]);

            setStats(statsRes.data);
            setTrainers(trainersRes.data);
            setStaff(staffRes.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch payroll data", error);
            setLoading(false);
        }
    };

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

            await axios.post('http://localhost:5000/api/expenses', data, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('Salary payment recorded successfully!');
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Payment Error:", error);
            alert(error.response?.data?.error || "Failed to record payment");
        }
    };

    const submitCommissionPayment = async () => {
        if (selectedSessions.length === 0 && selectedClasses.length === 0) return alert("Please select at least one item to pay.");

        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/admin/payroll/pay-commissions', {
                trainerId: selectedUser.id,
                sessionIds: selectedSessions,
                classHistoryIds: selectedClasses
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('Commissions paid successfully!');
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Commission Payment Error:", error);
            alert("Failed to pay commissions");
        }
    };

    const submitAutoCommissionPayment = async (trainerId, trainerName) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/admin/payroll/pay-commissions-auto', {
                trainerId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert(`Auto payout completed for ${trainerName}.`);
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Auto Commission Payment Error:", error);
            alert(error.response?.data?.error || "Failed to auto pay commissions");
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
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Payroll & Salaries</h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Payroll (This Month)</p>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white mt-2">{formatPrice(stats.totalPayrollThisMonth)}</h2>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Commissions</p>
                    <h2 className="text-3xl font-bold text-orange-500 mt-2">{formatPrice(stats.pendingCommissions)}</h2>
                    <p className="text-xs text-gray-400 mt-1">Unpaid commissions from completed sessions</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Material Deductions</p>
                    <h2 className="text-3xl font-bold text-red-500 mt-2">{formatPrice(stats.pendingMaterialDeductions || 0)}</h2>
                    <p className="text-xs text-gray-400 mt-1">To be deducted from trainer commission payouts</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('TRAINERS')}
                    className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'TRAINERS'
                        ? 'text-red-500 border-b-2 border-red-500'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    Trainers
                </button>
                <button
                    onClick={() => setActiveTab('STAFF')}
                    className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'STAFF'
                        ? 'text-red-500 border-b-2 border-red-500'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    Staff
                </button>
            </div>

            {/* Trainer Type Filter (only shows on Trainers tab) */}
            {activeTab === 'TRAINERS' && (
                <div className="flex gap-2 mb-4">
                    {[{ label: 'All', value: 'ALL' }, { label: 'Freelancers', value: 'FREELANCER' }, { label: 'Full-time', value: 'FULLTIME' }].map(f => (
                        <button
                            key={f.value}
                            onClick={() => setTrainerFilter(f.value)}
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${trainerFilter === f.value
                                    ? 'bg-orange-500/15 text-orange-500 border-orange-500/40'
                                    : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-700'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {loading ? (
                <p className="text-center text-gray-500">Loading payroll data...</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="p-4">Name</th>
                                {activeTab === 'TRAINERS' && <th className="p-4">Commission Rate</th>}
                                {activeTab === 'STAFF' && <th className="p-4">Base Salary</th>}
                                <th className="p-4">Paid (All Time)</th>
                                {activeTab === 'TRAINERS' && <th className="p-4">Unpaid Commissions</th>}
                                {activeTab === 'TRAINERS' && <th className="p-4">Material Deductions</th>}
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {activeTab === 'TRAINERS' ? (
                                trainers.length === 0 ? (
                                    <tr><td colSpan="6" className="p-4 text-center text-gray-500">No trainers found.</td></tr>
                                ) : (
                                    trainers
                                        .filter(t => trainerFilter === 'ALL' || t.type === trainerFilter)
                                        .map(trainer => (
                                            <tr key={trainer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-4 font-medium text-gray-800 dark:text-white flex items-center gap-3">
                                                    {trainer.imageUrl && (
                                                        <img src={`http://localhost:5000${trainer.imageUrl}`} alt={trainer.name} className="w-8 h-8 rounded-full object-cover" />
                                                    )}
                                                    {trainer.name}
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${trainer.type === 'FREELANCER'
                                                            ? 'bg-orange-500/15 text-orange-500'
                                                            : 'bg-blue-500/15 text-blue-500'
                                                        }`}>
                                                        {trainer.type === 'FREELANCER' ? 'Freelance' : 'Full-time'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-600 dark:text-gray-300">{(trainer.commissionRate * 100).toFixed(0)}%</td>
                                                <td className="p-4 text-green-600 font-medium">{formatPrice(trainer.totalPaid)}</td>
                                                <td className="p-4 text-orange-500 font-medium">{formatPrice(trainer.unpaidCommissions)}</td>
                                                <td className="p-4 text-red-500 font-medium">{formatPrice(trainer.outstandingMaterialDeductions || 0)}</td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handlePayCommission(trainer)}
                                                        className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={trainer.unpaidCommissions <= 0}
                                                    >
                                                        Pay Commission
                                                    </button>
                                                    <button
                                                        onClick={() => submitAutoCommissionPayment(trainer.id, trainer.name)}
                                                        className="px-3 py-1.5 bg-rose-500 text-white text-sm rounded-lg hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={trainer.unpaidCommissions <= 0}
                                                    >
                                                        Auto Settle
                                                    </button>
                                                    <button
                                                        onClick={() => handleRecordPayment(trainer, 'TRAINER')}
                                                        className={`px-3 py-1.5 text-white text-sm rounded-lg ${canPaySalary(trainer)
                                                            ? 'bg-blue-500 hover:bg-blue-600'
                                                            : 'bg-gray-300 cursor-not-allowed'
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
                                    <tr><td colSpan="4" className="p-4 text-center text-gray-500">No staff found.</td></tr>
                                ) : (
                                    staff.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="p-4 font-medium text-gray-800 dark:text-white">
                                                {user.name} <span className="text-xs text-gray-500 ml-2">({user.role})</span>
                                            </td>
                                            <td className="p-4 text-gray-600 dark:text-gray-300">
                                                {user.baseSalary ? formatPrice(user.baseSalary) : '-'}
                                            </td>
                                            <td className="p-4 text-green-600 font-medium">{formatPrice(user.totalPaid)}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleRecordPayment(user, 'STAFF')}
                                                    className={`px-3 py-1.5 text-white text-sm rounded-lg ${canPaySalary(user)
                                                        ? 'bg-blue-500 hover:bg-blue-600'
                                                        : 'bg-gray-300 cursor-not-allowed'
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
            )}

            {/* Payments Modal */}
            {showModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">
                            {modalType === 'SALARY' ? 'Record Salary Payment' : 'Pay Commissions'}
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            For: <span className="font-semibold text-gray-800 dark:text-white">{selectedUser.name}</span>
                        </p>

                        {modalType === 'SALARY' ? (
                            <form onSubmit={submitSalaryPayment} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1">Base Salary</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={salaryDetails.baseSalary}
                                        onChange={e => setSalaryDetails({ ...salaryDetails, baseSalary: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-500 mb-1">Bonus (+)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-green-500"
                                            value={salaryDetails.bonus}
                                            onChange={e => setSalaryDetails({ ...salaryDetails, bonus: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-500 mb-1">Deductions (-)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-red-500"
                                            value={salaryDetails.deductions}
                                            onChange={e => setSalaryDetails({ ...salaryDetails, deductions: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg flex justify-between items-center">
                                    <span className="font-medium text-gray-600 dark:text-gray-400">Net Pay:</span>
                                    <span className="text-xl font-bold text-gray-800 dark:text-white">
                                        {formatPrice(
                                            (parseFloat(salaryDetails.baseSalary) || 0) +
                                            (parseFloat(salaryDetails.bonus) || 0) -
                                            (parseFloat(salaryDetails.deductions) || 0)
                                        )}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-500 mb-1">Notes / Remarks</label>
                                    <textarea
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                                        className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        Pay Salary
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                {/* Training Sessions Table */}
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Training Sessions</h3>
                                    {selectedUser.unpaidSessions?.length > 0 && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSessions(selectedUser.unpaidSessions.map(s => s.id))}
                                                className="text-xs text-orange-500 hover:underline"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSessions([])}
                                                className="text-xs text-gray-400 hover:underline"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 sticky top-0">
                                            <tr>
                                                <th className="p-2 w-10">Select</th>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Member</th>
                                                <th className="p-2 text-right">Calculation</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {selectedUser.unpaidSessions?.map(session => {
                                                const rate = selectedUser.commissionRate || 0;
                                                const comm = session.price * rate;
                                                return (
                                                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="p-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSessions.includes(session.id)}
                                                                onChange={() => toggleSessionSelection(session.id)}
                                                                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-gray-600 dark:text-gray-300 text-xs">
                                                            {new Date(session.date).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-2 text-gray-800 dark:text-white">
                                                            {session.member ? `${session.member.firstName} ${session.member.lastName || ''}`.trim() : `Session #${session.id}`}
                                                        </td>
                                                        <td className="p-2 text-right text-xs">
                                                            <span className="text-gray-400">{formatPrice(session.price)} × {(rate * 100).toFixed(0)}% = </span>
                                                            <span className="text-orange-500 font-medium">{formatPrice(comm)}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {(!selectedUser.unpaidSessions || selectedUser.unpaidSessions.length === 0) && (
                                                <tr><td colSpan="4" className="p-4 text-center text-gray-500">No unpaid sessions.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Class History Table */}
                                <div className="flex items-center justify-between mb-1 pt-2">
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Class Commissions</h3>
                                    {selectedUser.classHistory?.length > 0 && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedClasses(selectedUser.classHistory.map(c => c.id))}
                                                className="text-xs text-orange-500 hover:underline"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedClasses([])}
                                                className="text-xs text-gray-400 hover:underline"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 sticky top-0">
                                            <tr>
                                                <th className="p-2 w-10">Select</th>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Class</th>
                                                <th className="p-2 text-right">Comm.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {selectedUser.classHistory?.map(cls => (
                                                <tr key={cls.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedClasses.includes(cls.id)}
                                                            onChange={() => toggleClassSelection(cls.id)}
                                                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-gray-600 dark:text-gray-300">
                                                        {new Date(cls.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-2 text-gray-800 dark:text-white">
                                                        {cls.class?.name} ({cls.attendeeCount} attendees)
                                                    </td>
                                                    <td className="p-2 text-right text-xs">
                                                        <span className="text-orange-500 font-medium">{formatPrice(cls.commissionAmount)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!selectedUser.classHistory || selectedUser.classHistory.length === 0) && (
                                                <tr><td colSpan="4" className="p-4 text-center text-gray-500">No unpaid classes.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Tagged Material Purchases Table */}
                                <div className="flex items-center justify-between mb-1 pt-2">
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tagged Material Purchases</h3>
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 sticky top-0">
                                            <tr>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Item</th>
                                                <th className="p-2 text-center">Qty</th>
                                                <th className="p-2 text-right">Unit</th>
                                                <th className="p-2 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {(selectedUser.materialDeductionItems || []).map((item) => (
                                                <tr key={item.paymentItemId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="p-2 text-gray-600 dark:text-gray-300 text-xs">
                                                        {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="p-2 text-gray-800 dark:text-white text-xs font-medium">
                                                        {item.name}
                                                    </td>
                                                    <td className="p-2 text-center text-gray-600 dark:text-gray-300 text-xs">
                                                        {item.unsettledQty}
                                                    </td>
                                                    <td className="p-2 text-right text-gray-600 dark:text-gray-300 text-xs">
                                                        {formatPrice(item.unitPrice)}
                                                    </td>
                                                    <td className="p-2 text-right text-red-500 text-xs font-semibold">
                                                        {formatPrice(item.unsettledTotal)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!selectedUser.materialDeductionItems || selectedUser.materialDeductionItems.length === 0) && (
                                                <tr><td colSpan="5" className="p-4 text-center text-gray-500">No tagged material purchases pending.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-900/50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-orange-800 dark:text-orange-200 font-medium">Gross Selected:</span>
                                        <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                            {formatPrice(calculateSelectedTotal())}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-red-700 dark:text-red-300 font-medium">Material Deductions:</span>
                                        <span className="font-bold text-red-600 dark:text-red-300">
                                            -{formatPrice(calculateTaggedMaterialTotal())}
                                        </span>
                                    </div>
                                    <div className="border-t border-orange-200 dark:border-orange-800 pt-2 flex justify-between items-center">
                                        <span className="text-orange-900 dark:text-orange-100 font-bold">Net Payout:</span>
                                        <span className={`text-xl font-extrabold ${calculateNetSelectedPayout() < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                            {formatPrice(Math.max(0, calculateNetSelectedPayout()))}
                                        </span>
                                    </div>
                                    {calculateNetSelectedPayout() < 0 && (
                                        <p className="text-[11px] text-red-600 dark:text-red-300">
                                            Selected commissions are lower than outstanding material deductions.
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitCommissionPayment}
                                        disabled={(selectedSessions.length === 0 && selectedClasses.length === 0) || calculateNetSelectedPayout() < 0}
                                        className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
