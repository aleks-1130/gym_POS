import React, { useState, useEffect } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import axios from 'axios';

const Expenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: 'UTILITIES',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/expenses', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpenses(res.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/expenses/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchExpenses();
        } catch (error) {
            alert('Failed to delete expense');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/expenses', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            setFormData({
                title: '',
                amount: '',
                category: 'UTILITIES',
                date: new Date().toISOString().split('T')[0],
                notes: ''
            });
            fetchExpenses();
        } catch (error) {
            alert('Failed to add expense');
        }
    };

    const { formatPrice } = useCurrency();
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const mtdExpenses = expenses.reduce((sum, item) => {
        const itemDate = new Date(item.date);
        if (itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear) {
            return sum + item.amount;
        }
        return sum;
    }, 0);

    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const [viewMode, setViewMode] = useState('LIST'); // LIST, DAILY, MONTHLY, YEARLY

    const groupExpenses = () => {
        if (viewMode === 'LIST') return null;

        return expenses.reduce((groups, expense) => {
            let key;
            const date = new Date(expense.date);

            if (viewMode === 'DAILY') {
                key = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            } else if (viewMode === 'MONTHLY') {
                key = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            } else if (viewMode === 'YEARLY') {
                key = date.getFullYear().toString();
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(expense);
            return groups;
        }, {});
    };

    const groupedExpenses = groupExpenses();

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Operational Expenses</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and track your business spending</p>
                </div>

                <div className="flex gap-2">
                    <div className="bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 flex">
                        {['LIST', 'DAILY', 'MONTHLY', 'YEARLY'].map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === mode
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                {mode.charAt(0) + mode.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                        + Add Expense
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* All Time */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Expenses (All Time)</p>
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mt-2">
                            {formatPrice(totalExpenses)}
                        </h2>
                    </div>
                </div>

                {/* MTD */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Expenses ({currentMonthName})</p>
                        <h2 className="text-3xl font-bold text-red-500 mt-2">
                            {formatPrice(mtdExpenses)}
                        </h2>
                    </div>
                    {/* Decorative Icon Background */}
                    <div className="absolute -right-4 -bottom-4 text-red-500/10">
                        <span className="material-icons-round text-9xl">calendar_today</span>
                    </div>
                </div>
            </div>

            {/* View Rendering */}
            {viewMode === 'LIST' ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Title</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Notes</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {expenses.map((expense) => (
                                <tr key={expense.id} className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-4">{new Date(expense.date).toLocaleDateString()}</td>
                                    <td className="p-4 font-medium">{expense.title}</td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="p-4 font-semibold text-red-500">
                                        {formatPrice(expense.amount)}
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">{expense.notes || '-'}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {expenses.length === 0 && !loading && (
                        <div className="p-8 text-center text-gray-500">No expenses recorded yet.</div>
                    )}
                </div>
            ) : (
                <div className="space-y-8">
                    {groupedExpenses && Object.entries(groupedExpenses).map(([group, groupExpenses]) => (
                        <div key={group} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-700 dark:text-gray-300">{group}</h3>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {groupExpenses.length} transaction{groupExpenses.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-50 dark:border-gray-700">
                                    <tr>
                                        {viewMode !== 'DAILY' && <th className="p-4">Date</th>}
                                        <th className="p-4 w-1/4">Title</th>
                                        <th className="p-4">Category</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4 w-1/3">Notes</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {groupExpenses.map((expense) => (
                                        <tr key={expense.id} className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            {viewMode !== 'DAILY' && <td className="p-4 text-gray-500">{new Date(expense.date).toLocaleDateString()}</td>}
                                            <td className="p-4 font-medium">{expense.title}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                    {expense.category}
                                                </span>
                                            </td>
                                            <td className="p-4 font-semibold text-red-500">
                                                {formatPrice(expense.amount)}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">{expense.notes || '-'}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Group Footer with Total */}
                                <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                                    <tr>
                                        <td colSpan={viewMode !== 'DAILY' ? 3 : 2} className="p-4 text-right font-medium text-gray-500 dark:text-gray-400">
                                            Total for {group}:
                                        </td>
                                        <td className="p-4 font-bold text-red-500 text-lg">
                                            {formatPrice(groupExpenses.reduce((sum, e) => sum + e.amount, 0))}
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ))}
                    {expenses.length === 0 && !loading && (
                        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">No expenses recorded yet.</p>
                            <button
                                onClick={() => setShowModal(true)}
                                className="mt-4 text-blue-500 hover:text-blue-600 font-medium"
                            >
                                Record your first expense
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">New Expense</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-500 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1">Amount</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1">Category</label>
                                    <select
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="UTILITIES">Utilities</option>
                                        <option value="SALARY">Salary</option>
                                        <option value="SUPPLIES">Supplies</option>
                                        <option value="MAINTENANCE">Maintenance</option>
                                        <option value="RENT">Rent</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-500 mb-1">Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-500 mb-1">Notes</label>
                                <textarea
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
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
                                    className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                >
                                    Save Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
