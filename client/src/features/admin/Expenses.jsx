import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../../context/CurrencyContext';
import { EXPENSE_CATEGORIES } from '../../constants/categories';
import { useConfirm } from '../../context/ConfirmContext';

const VIEW_MODES = ['LIST', 'DAILY', 'MONTHLY', 'YEARLY'];
const EXPENSE_PAGE_SIZE = 10;

const categoryLabel = (value) => String(value || '').replace(/_/g, ' ');

const formatDate = (value) => new Date(value).toLocaleDateString();

const getGroupMeta = (expense, mode) => {
    const date = new Date(expense.date);
    if (mode === 'DAILY') {
        const key = date.toISOString().split('T')[0];
        return {
            key,
            label: date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            sortValue: new Date(key).getTime()
        };
    }
    if (mode === 'MONTHLY') {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return {
            key,
            label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
            sortValue: new Date(date.getFullYear(), date.getMonth(), 1).getTime()
        };
    }
    return {
        key: String(date.getFullYear()),
        label: String(date.getFullYear()),
        sortValue: new Date(date.getFullYear(), 0, 1).getTime()
    };
};

const Expenses = () => {
    const { confirm, alert: showAlert } = useConfirm();
    const { formatPrice } = useCurrency();
    const queryClient = useQueryClient();

    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [viewMode, setViewMode] = useState('LIST');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [dateFilterType, setDateFilterType] = useState('ALL');
    const [customDateRange, setCustomDateRange] = useState({
        start: '',
        end: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: EXPENSE_CATEGORIES.UTILITIES,
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    // Queries
    const { data: expenses = [], isLoading: loading } = useQuery({
        queryKey: ['adminExpenses'],
        queryFn: async () => {
            const res = await axios.get('/api/expenses');
            return res.data || [];
        }
    });

    // Mutations
    const submitMutation = useMutation({
        mutationFn: async (payload) => {
            if (editingExpense) {
                return axios.put(`/api/expenses/${editingExpense.id}`, payload);
            }
            return axios.post('/api/expenses', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminExpenses'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            setShowModal(false);
            resetForm();
            showAlert({ 
                title: editingExpense ? 'Updated' : 'Saved', 
                message: editingExpense ? 'Expense updated successfully.' : 'Expense recorded successfully.', 
                type: 'success' 
            });
        },
        onError: () => {
            showAlert({ 
                title: 'Submission Failed', 
                message: editingExpense ? 'Failed to update expense.' : 'Failed to add expense. Please check your inputs.', 
                type: 'danger' 
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => axios.delete(`/api/expenses/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminExpenses'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            showAlert({ title: 'Delete Failed', message: 'Failed to delete expense. Please try again.', type: 'danger' });
        }
    });

    useEffect(() => {
        if (dateFilterType !== 'CUSTOM') return;
        if (!customDateRange.start || !customDateRange.end) return;
        if (customDateRange.end < customDateRange.start) {
            setCustomDateRange((prev) => ({ ...prev, end: prev.start }));
        }
    }, [customDateRange.end, customDateRange.start, dateFilterType]);

    const resetForm = () => {
        setFormData({
            title: '',
            amount: '',
            category: EXPENSE_CATEGORIES.UTILITIES,
            date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setEditingExpense(null);
    };

    const handleEdit = (expense) => {
        setEditingExpense(expense);
        setFormData({
            title: expense.title || '',
            amount: String(expense.amount || ''),
            category: expense.category || EXPENSE_CATEGORIES.UTILITIES,
            date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            notes: expense.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const isConfirmed = await confirm({
            title: 'Delete Expense',
            message: 'Are you sure you want to delete this expense? This action cannot be undone.',
            type: 'danger',
            confirmLabel: 'Delete'
        });
        if (isConfirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...formData, amount: Number(formData.amount) };
        submitMutation.mutate(payload);
    };


    const filteredExpenses = useMemo(() => {
        const now = new Date();
        const byCategory = expenses.filter((expense) => selectedCategory === 'ALL' || expense.category === selectedCategory);

        const byDate = byCategory.filter((expense) => {
            const expenseDate = new Date(expense.date);
            if (Number.isNaN(expenseDate.getTime())) return false;

            if (dateFilterType === 'ALL') return true;
            if (dateFilterType === 'THIS_MONTH') {
                return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
            }
            if (dateFilterType === 'LAST_MONTH') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return expenseDate.getMonth() === lastMonth.getMonth() && expenseDate.getFullYear() === lastMonth.getFullYear();
            }
            if (dateFilterType === 'THIS_YEAR') {
                return expenseDate.getFullYear() === now.getFullYear();
            }
            if (dateFilterType === 'CUSTOM') {
                if (!customDateRange.start || !customDateRange.end) return true;
                const start = new Date(customDateRange.start);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customDateRange.end);
                end.setHours(23, 59, 59, 999);
                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
                return expenseDate >= start && expenseDate <= end;
            }
            return true;
        });

        return [...byDate].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [customDateRange.end, customDateRange.start, dateFilterType, expenses, selectedCategory]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, dateFilterType, customDateRange.start, customDateRange.end, viewMode]);

    const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / EXPENSE_PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginatedExpenses = useMemo(() => {
        const start = (safePage - 1) * EXPENSE_PAGE_SIZE;
        return filteredExpenses.slice(start, start + EXPENSE_PAGE_SIZE);
    }, [filteredExpenses, safePage]);

    const groupedExpenses = useMemo(() => {
        if (viewMode === 'LIST') return [];
        const buckets = new Map();
        paginatedExpenses.forEach((expense) => {
            const meta = getGroupMeta(expense, viewMode);
            if (!buckets.has(meta.key)) {
                buckets.set(meta.key, {
                    key: meta.key,
                    label: meta.label,
                    sortValue: meta.sortValue,
                    total: 0,
                    items: []
                });
            }
            const bucket = buckets.get(meta.key);
            bucket.items.push(expense);
            bucket.total += Number(expense.amount || 0);
        });
        return [...buckets.values()].sort((a, b) => b.sortValue - a.sortValue);
    }, [paginatedExpenses, viewMode]);

    const totalExpenses = useMemo(
        () => filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
        [filteredExpenses]
    );
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const mtdExpenses = useMemo(
        () =>
            filteredExpenses.reduce((sum, expense) => {
                const date = new Date(expense.date);
                if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                    return sum + Number(expense.amount || 0);
                }
                return sum;
            }, 0),
        [filteredExpenses, currentMonth, currentYear]
    );
    const averageExpense = filteredExpenses.length ? totalExpenses / filteredExpenses.length : 0;
    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const exportCurrentExpenses = () => {
        if (filteredExpenses.length === 0) {
            showAlert({ title: 'Nothing to Export', message: 'No expenses in the current filter.', type: 'warning' });
            return;
        }

        const escapeCsv = (value) => {
            const str = String(value ?? '').replace(/"/g, '""');
            return /[",\n]/.test(str) ? `"${str}"` : str;
        };
        const headers = ['Date', 'Title', 'Category', 'Amount', 'Notes'];
        const rows = filteredExpenses.map((expense) => ([
            formatDate(expense.date),
            expense.title,
            categoryLabel(expense.category),
            Number(expense.amount || 0).toFixed(2),
            expense.notes || ''
        ]));
        const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `expenses-${viewMode.toLowerCase()}-${selectedCategory.toLowerCase()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-5 p-6">
            <header className="rounded-3xl border border-white/10 bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Operational Expenses</h1>
                        <p className="mt-1 text-sm text-text-muted">Track, group, and audit expense records with cleaner controls.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={exportCurrentExpenses}
                            className="rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-primary/50 hover:text-primary"
                        >
                            Export CSV
                        </button>
                        <select
                            value={dateFilterType}
                            onChange={(e) => setDateFilterType(e.target.value)}
                            className="rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white outline-none transition-colors focus:border-primary"
                        >
                            <option value="ALL">All Dates</option>
                            <option value="THIS_MONTH">This Month</option>
                            <option value="LAST_MONTH">Last Month</option>
                            <option value="THIS_YEAR">This Year</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>
                        {dateFilterType === 'CUSTOM' && (
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surfaceHighlight p-1.5">
                                <input
                                    type="date"
                                    value={customDateRange.start}
                                    onChange={(e) => setCustomDateRange((prev) => ({ ...prev, start: e.target.value }))}
                                    className="rounded-lg bg-transparent px-2 py-1 text-sm text-white outline-none"
                                />
                                <span className="text-text-muted">→</span>
                                <input
                                    type="date"
                                    value={customDateRange.end}
                                    onChange={(e) => setCustomDateRange((prev) => ({ ...prev, end: e.target.value }))}
                                    className="rounded-lg bg-transparent px-2 py-1 text-sm text-white outline-none"
                                />
                            </div>
                        )}
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white outline-none transition-colors focus:border-primary"
                        >
                            <option value="ALL">All Categories</option>
                            {Object.values(EXPENSE_CATEGORIES)
                                .filter((cat) => cat !== 'INVENTORY')
                                .map((cat) => (
                                    <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                                ))}
                        </select>
                        <button
                            onClick={() => setShowModal(true)}
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-background transition-colors hover:bg-orange-600"
                        >
                            + Add Expense
                        </button>
                    </div>
                </div>
            </header>

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-text-muted">Total Expenses</p>
                    <p className="mt-1 text-base font-bold text-white">{formatPrice(totalExpenses)}</p>
                    <p className="text-[10px] text-text-muted">Current filter</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-red-300">This Month</p>
                    <p className="mt-1 text-base font-bold text-red-300">{formatPrice(mtdExpenses)}</p>
                    <p className="text-[10px] text-red-300/80">{currentMonthName}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-text-muted">Average Expense</p>
                    <p className="mt-1 text-base font-bold text-white">{formatPrice(averageExpense)}</p>
                    <p className="text-[10px] text-text-muted">Per transaction</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-text-muted">Records</p>
                    <p className="mt-1 text-base font-bold text-white">{filteredExpenses.length}</p>
                    <p className="text-[10px] text-text-muted">Current view</p>
                </div>
            </section>

            <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="grid w-full grid-cols-4 rounded-xl border border-white/10 bg-surfaceHighlight p-1 md:max-w-xl">
                    {VIEW_MODES.map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${viewMode === mode
                                ? 'bg-white/10 text-white'
                                : 'text-text-secondary hover:text-white'
                                }`}
                        >
                            {mode.charAt(0) + mode.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-text-muted">
                    {viewMode === 'LIST' ? 'Chronological list view' : `Grouped by ${viewMode.toLowerCase()}`}
                </p>
            </section>

            {loading ? (
                <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center text-text-muted">
                    Loading expenses...
                </div>
            ) : viewMode === 'LIST' ? (
                <div className="rounded-2xl border border-white/10 bg-surface shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed text-left text-sm tabular-nums">
                            <colgroup>
                                <col className="w-[13%]" />
                                <col className="w-[24%]" />
                                <col className="w-[16%]" />
                                <col className="w-[14%]" />
                                <col className="w-[25%]" />
                                <col className="w-[8%]" />
                            </colgroup>
                            <thead className="sticky top-0 z-10 border-b border-white/10 bg-surface/95 text-[11px] uppercase tracking-wide text-text-muted backdrop-blur">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Title</th>
                                    <th className="p-3">Category</th>
                                    <th className="p-3 text-right">Amount</th>
                                    <th className="p-3">Notes</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredExpenses.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-6 text-center text-text-muted">No expenses recorded yet.</td>
                                    </tr>
                                ) : (
                                    paginatedExpenses.map((expense, index) => (
                                        <tr key={expense.id} className={`${index % 2 === 0 ? 'bg-white/[0.01]' : ''} transition-colors hover:bg-white/5`}>
                                            <td className="p-3 text-text-secondary">{formatDate(expense.date)}</td>
                                            <td className="p-3 font-medium text-white">{expense.title}</td>
                                            <td className="p-3">
                                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-text-secondary">
                                                    {categoryLabel(expense.category)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-semibold text-red-300">{formatPrice(expense.amount)}</td>
                                            <td className="p-3 text-sm text-text-muted">{expense.notes || '-'}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleEdit(expense)}
                                                        className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(expense.id)}
                                                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    {groupedExpenses.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/20 bg-surface p-12 text-center">
                            <p className="text-text-muted">No grouped expenses in this filter.</p>
                        </div>
                    ) : (
                        groupedExpenses.map((group) => (
                            <div key={group.key} className="rounded-2xl border border-white/10 bg-surface shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                                    <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-text-muted">{group.items.length} transaction{group.items.length !== 1 ? 's' : ''}</span>
                                        <span className="font-semibold text-red-300">{formatPrice(group.total)}</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm tabular-nums">
                                        <thead className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wide text-text-muted">
                                            <tr>
                                                {viewMode !== 'DAILY' && <th className="p-3">Date</th>}
                                                <th className="p-3">Title</th>
                                                <th className="p-3">Category</th>
                                                <th className="p-3 text-right">Amount</th>
                                                <th className="p-3">Notes</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {group.items.map((expense, index) => (
                                                <tr key={expense.id} className={`${index % 2 === 0 ? 'bg-white/[0.01]' : ''} transition-colors hover:bg-white/5`}>
                                                    {viewMode !== 'DAILY' && <td className="p-3 text-text-secondary">{formatDate(expense.date)}</td>}
                                                    <td className="p-3 font-medium text-white">{expense.title}</td>
                                                    <td className="p-3">
                                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-text-secondary">
                                                            {categoryLabel(expense.category)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-semibold text-red-300">{formatPrice(expense.amount)}</td>
                                                    <td className="p-3 text-sm text-text-muted">{expense.notes || '-'}</td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => handleEdit(expense)}
                                                                className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(expense.id)}
                                                                className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {!loading && filteredExpenses.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-text-muted">
                        Page {safePage} of {totalPages} • Showing {paginatedExpenses.length} of {filteredExpenses.length} records
                    </p>
                    <div className="inline-flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={safePage <= 1}
                            className="rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={safePage >= totalPages}
                            className="rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-5 shadow-2xl">
                        <h2 className="text-lg font-bold text-white">{editingExpense ? 'Edit Expense' : 'New Expense'}</h2>
                        <p className="mt-1 text-xs text-text-muted">{editingExpense ? 'Update the details for this expense.' : 'Capture operational spending details.'}</p>

                        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Title</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-white outline-none transition-colors focus:border-primary"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Amount</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-white outline-none transition-colors focus:border-primary"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Category</label>
                                    <select
                                        className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-white outline-none transition-colors focus:border-primary"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {Object.values(EXPENSE_CATEGORIES)
                                            .filter((cat) => cat !== 'INVENTORY')
                                            .map((cat) => (
                                                <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-white outline-none transition-colors focus:border-primary"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Notes</label>
                                <textarea
                                    rows="3"
                                    className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-white outline-none transition-colors focus:border-primary"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <div className="mt-5 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-background transition-colors hover:bg-orange-600"
                                >
                                    {editingExpense ? 'Save Changes' : 'Save Expense'}
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
