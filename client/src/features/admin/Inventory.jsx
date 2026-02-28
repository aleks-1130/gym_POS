import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import DataTable from '../../components/common/DataTable';
import { useConfirm } from '../../context/ConfirmContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import Suppliers from './Suppliers';

const PRODUCT_PAGE_SIZE = 10;
const STOCK_ORDER_PAGE_SIZE = 10;

const INVENTORY_TABS = [
    { key: 'products', label: 'Products', icon: 'inventory_2', hint: 'Catalog, pricing, and stock signals' },
    { key: 'categories', label: 'Categories', icon: 'category', hint: 'Organize inventory groups' },
    { key: 'stock', label: 'Stock', icon: 'local_shipping', hint: 'Purchase orders and receiving' },
    { key: 'suppliers', label: 'Suppliers', icon: 'business', hint: 'Vendor records and contacts' }
];

const statusBadgeClasses = {
    PENDING: 'bg-amber-500/10 border border-amber-500/20 text-amber-300',
    RECEIVED: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300',
    CANCELLED: 'bg-red-500/10 border border-red-500/20 text-red-300'
};

const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const safeInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
};

const toLocalDateTime = (value) => {
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value || 'N/A';
    }
};

export default function Inventory() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { id: routeIdParam } = useParams();

    const isProductCreatePage = location.pathname === '/inventory/products/new';
    const isProductEditPage = /^\/inventory\/products\/\d+\/edit$/.test(location.pathname);
    const isStockEditPage = /^\/inventory\/stock-orders\/\d+\/edit$/.test(location.pathname);
    const isStockCreatePage = location.pathname === '/inventory/stock-orders/new';

    if (isProductCreatePage || isProductEditPage) {
        return (
            <ProductFormPage
                productId={isProductEditPage ? routeIdParam : null}
                onCancel={() => navigate('/inventory?tab=products')}
                onSaved={() => navigate('/inventory?tab=products')}
            />
        );
    }

    if (isStockCreatePage || isStockEditPage) {
        return (
            <CreateStockOrderPage
                orderId={isStockEditPage ? routeIdParam : null}
                onCancel={() => navigate('/inventory?tab=stock')}
                onCreated={() => navigate('/inventory?tab=stock')}
            />
        );
    }

    return <InventoryTabsPage user={user} navigate={navigate} location={location} />;
}

function InventoryTabsPage({ user, navigate, location }) {
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const requestedTab = String(searchParams.get('tab') || 'products').toLowerCase();

    const availableTabs = useMemo(() => {
        if (user?.role === 'ADMIN' || user?.role === 'OWNER') return INVENTORY_TABS;
        return INVENTORY_TABS.filter((tab) => tab.key !== 'suppliers');
    }, [user?.role]);

    const activeTab = availableTabs.some((tab) => tab.key === requestedTab)
        ? requestedTab
        : availableTabs[0]?.key || 'products';

    const openTab = (tabKey) => {
        const params = new URLSearchParams(location.search);
        params.set('tab', tabKey);
        navigate(`/inventory?${params.toString()}`);
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventory Management</h1>
                    <p className="text-text-muted mt-1">Products, categories, stock orders, and supplier operations</p>
                </div>
                <div />
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {availableTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => openTab(tab.key)}
                        className={`w-full rounded-2xl border px-4 py-4 text-sm transition-all text-left ${activeTab === tab.key
                            ? 'bg-primary/20 border-primary text-white shadow shadow-primary/20'
                            : 'bg-surface border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <span className={`material-icons-round text-lg ${activeTab === tab.key ? 'text-white' : 'text-text-muted'}`}>{tab.icon}</span>
                            <div className="min-w-0">
                                <p className="font-semibold">{tab.label}</p>
                                <p className={`text-xs mt-1 ${activeTab === tab.key ? 'text-white/80' : 'text-text-muted'}`}>{tab.hint}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {activeTab === 'products' && <ProductsTab navigate={navigate} />}
            {activeTab === 'categories' && <CategoriesTab />}
            {activeTab === 'stock' && <StockOrdersTab user={user} navigate={navigate} />}
            {activeTab === 'suppliers' && <Suppliers />}
        </div>
    );
}

function ProductsTab({ navigate }) {
    const { formatPrice } = useCurrency();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [viewMode, setViewMode] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState([]);

    const fetchProducts = async (targetPage = page, targetSearch = searchTerm, targetCategory = categoryFilter) => {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            qs.set('page', String(targetPage));
            qs.set('limit', String(PRODUCT_PAGE_SIZE));
            if (targetSearch.trim()) qs.set('search', targetSearch.trim());
            if (targetCategory.trim()) qs.set('category', targetCategory.trim());

            const res = await axios.get(`/api/products?${qs.toString()}`);
            if (res.data?.meta) {
                setProducts(res.data.data || []);
                setPage(res.data.meta.page || 1);
                setTotalPages(res.data.meta.totalPages || 1);
                setTotalCount(res.data.meta.total || 0);
            } else {
                const rows = Array.isArray(res.data) ? res.data : [];
                setProducts(rows);
                setPage(1);
                setTotalPages(1);
                setTotalCount(rows.length);
            }
        } catch (error) {
            await showAlert({ title: 'Load Failed', message: 'Failed to fetch products', type: 'danger' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts(page, searchTerm, categoryFilter);
    }, [page, searchTerm, categoryFilter]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await axios.get('/api/inventory/categories');
                setCategories(Array.isArray(res.data) ? res.data : []);
            } catch {
                setCategories([]);
            }
        };
        fetchCategories();
    }, []);

    const applySearch = (event) => {
        const value = event.target.value;
        setPage(1);
        setSearchTerm(value);
    };

    const applyCategory = (event) => {
        const value = event.target.value;
        setPage(1);
        setCategoryFilter(value);
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm({
            title: 'Delete Product?',
            message: 'This will permanently remove the product.',
            confirmLabel: 'Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        try {
            await axios.delete(`/api/products/${id}`);
            await fetchProducts(page);
        } catch (error) {
            await showAlert({ title: 'Delete Failed', message: error.response?.data?.error || 'Failed to delete product', type: 'danger' });
        }
    };

    return (
        <div className="space-y-5">
            <div className="bg-surface border border-white/5 rounded-2xl p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-white font-semibold">Product Directory</p>
                        <p className="text-xs text-text-muted mt-1">
                            Showing <span className="text-white">{products.length}</span> of <span className="text-white">{totalCount}</span> products
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${viewMode === 'list'
                                ? 'border-primary bg-primary/20 text-white'
                                : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${viewMode === 'grid'
                                ? 'border-primary bg-primary/20 text-white'
                                : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            Grid
                        </button>
                        <button
                            onClick={() => navigate('/inventory/products/new')}
                            className="bg-primary hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                            <span className="material-icons-round text-base">add</span>
                            Add Product
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
                    <input
                        value={searchTerm}
                        onChange={applySearch}
                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                        placeholder="Search name or barcode"
                    />
                    <select
                        value={categoryFilter}
                        onChange={applyCategory}
                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                    >
                        <option value="">All Categories</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.name}>{category.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => {
                            setPage(1);
                            setSearchTerm('');
                            setCategoryFilter('');
                        }}
                        className="w-full lg:w-auto px-4 py-2.5 rounded-xl border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>

            {viewMode === 'list' ? (
                <DataTable
                    isLoading={loading}
                    data={products}
                    emptyMessage="No products yet. Add your first product."
                    columns={[
                        {
                            header: 'Product',
                            accessor: (product) => (
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                                        {product.imageUrl
                                            ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                            : <span className="material-icons-round text-text-muted text-base">image</span>}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white font-semibold truncate">{product.name}</p>
                                        <p className="text-xs text-text-muted truncate">{product.description || 'No description'}</p>
                                    </div>
                                </div>
                            )
                        },
                        {
                            header: 'Barcode',
                            accessor: (product) => <span className="font-mono text-text-secondary">{product.barcode || 'N/A'}</span>
                        },
                        {
                            header: 'Category',
                            accessor: (product) => (
                                <span className="px-2 py-1 rounded-lg text-[11px] bg-white/5 border border-white/10 text-text-secondary font-semibold uppercase">
                                    {product.category}
                                </span>
                            )
                        },
                        {
                            header: 'Cost',
                            accessor: (product) => <span className="text-white font-semibold">{formatPrice(safeNumber(product.cost, safeNumber(product.price)))}</span>,
                            className: 'text-right',
                            cellClassName: 'text-right'
                        },
                        {
                            header: 'Stock',
                            accessor: (product) => {
                                const isLow = safeInt(product.stock) <= safeInt(product.minStock);
                                return (
                                    <span className={`font-mono font-semibold ${isLow ? 'text-red-300' : 'text-emerald-300'}`}>
                                        {safeInt(product.stock)}
                                    </span>
                                );
                            },
                            className: 'text-center',
                            cellClassName: 'text-center'
                        },
                        {
                            header: 'Low Alert',
                            accessor: (product) => <span className="text-text-secondary font-mono">{safeInt(product.minStock)}</span>,
                            className: 'text-center',
                            cellClassName: 'text-center'
                        }
                    ]}
                    actions={(product) => (
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => navigate(`/inventory/products/${product.id}/edit`)}
                                className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                                title="Edit"
                            >
                                <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button
                                onClick={() => handleDelete(product.id)}
                                className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete"
                            >
                                <span className="material-icons-round text-lg">delete</span>
                            </button>
                        </div>
                    )}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {products.map((product) => {
                        const isLow = safeInt(product.stock) <= safeInt(product.minStock);
                        return (
                            <div key={product.id} className="bg-surface border border-white/5 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-14 h-14 rounded-xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center flex-shrink-0">
                                        {product.imageUrl
                                            ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                            : <span className="material-icons-round text-text-muted text-base">image</span>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-white font-semibold truncate">{product.name}</p>
                                        <p className="text-xs text-text-muted truncate mt-0.5">{product.description || 'No description'}</p>
                                        <p className="text-[11px] text-text-secondary font-mono mt-1 truncate">Barcode: {product.barcode || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-text-secondary font-semibold uppercase">{product.category}</span>
                                    <span className="text-white font-semibold">{formatPrice(safeNumber(product.cost, safeNumber(product.price)))}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-text-secondary">Stock: <span className={isLow ? 'text-red-300 font-semibold' : 'text-emerald-300 font-semibold'}>{safeInt(product.stock)}</span></span>
                                    <span className="text-text-muted">Low alert: <span className="text-white">{safeInt(product.minStock)}</span></span>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        onClick={() => navigate(`/inventory/products/${product.id}/edit`)}
                                        className="px-3 py-1.5 rounded-lg border border-white/10 text-text-secondary hover:text-white hover:bg-white/5 text-xs"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product.id)}
                                        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {!loading && products.length === 0 && (
                        <div className="md:col-span-2 xl:col-span-3 text-center py-10 text-text-muted bg-surface border border-white/5 rounded-2xl">
                            No products found.
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <span className="text-sm text-text-muted">
                    Page <span className="text-white font-semibold">{page}</span> of {totalPages}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}

function CategoriesTab() {
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [viewMode, setViewMode] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 8;

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/inventory/categories');
            setCategories(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            await showAlert({ title: 'Load Failed', message: 'Failed to fetch categories', type: 'danger' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const filteredCategories = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return categories;
        return categories.filter((category) =>
            `${category.name || ''} ${category.description || ''}`.toLowerCase().includes(keyword)
        );
    }, [categories, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
    const paginatedCategories = filteredCategories.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const openCreate = () => {
        setEditingCategory(null);
        setFormData({ name: '', description: '' });
        setShowForm(true);
    };

    const openEdit = (category) => {
        setEditingCategory(category);
        setFormData({ name: category.name || '', description: category.description || '' });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingCategory(null);
        setFormData({ name: '', description: '' });
    };

    const submitCategory = async (event) => {
        event.preventDefault();
        try {
            if (editingCategory) {
                await axios.put(`/api/inventory/categories/${editingCategory.id}`, formData);
            } else {
                await axios.post('/api/inventory/categories', formData);
            }
            closeForm();
            await fetchCategories();
        } catch (error) {
            await showAlert({ title: 'Save Failed', message: error.response?.data?.error || 'Failed to save category', type: 'danger' });
        }
    };

    const deleteCategory = async (category) => {
        const confirmed = await showConfirm({
            title: 'Delete Category?',
            message: `Delete "${category.name}"?`,
            confirmLabel: 'Delete',
            type: 'danger'
        });
        if (!confirmed) return;

        try {
            await axios.delete(`/api/inventory/categories/${category.id}`);
            await fetchCategories();
        } catch (error) {
            await showAlert({ title: 'Delete Failed', message: error.response?.data?.error || 'Failed to delete category', type: 'danger' });
        }
    };

    return (
        <div className="space-y-5">
            <div className="bg-surface border border-white/5 rounded-2xl p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-white font-semibold">Category Management</p>
                        <p className="text-xs text-text-muted mt-1">
                            {filteredCategories.length} category records
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${viewMode === 'list'
                                ? 'border-primary bg-primary/20 text-white'
                                : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${viewMode === 'grid'
                                ? 'border-primary bg-primary/20 text-white'
                                : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            Grid
                        </button>
                        <button
                            onClick={openCreate}
                            className="bg-primary hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <span className="material-icons-round text-base">add</span>
                            Add Category
                        </button>
                    </div>
                </div>
                <div className="mt-4">
                    <input
                        value={searchTerm}
                        onChange={(event) => {
                            setPage(1);
                            setSearchTerm(event.target.value);
                        }}
                        className="w-full lg:max-w-md bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                        placeholder="Search category name or description"
                    />
                </div>
            </div>

            {viewMode === 'list' ? (
                <DataTable
                    isLoading={loading}
                    data={paginatedCategories}
                    emptyMessage="No categories available."
                    columns={[
                        {
                            header: 'Category Name',
                            accessor: (category) => <span className="text-white font-semibold">{category.name}</span>
                        },
                        {
                            header: 'Description',
                            accessor: (category) => <span className="text-text-secondary">{category.description || 'No description'}</span>
                        },
                        {
                            header: 'Products',
                            accessor: (category) => <span className="text-white font-mono">{safeInt(category.productCount)}</span>,
                            className: 'text-center',
                            cellClassName: 'text-center'
                        }
                    ]}
                    actions={(category) => (
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => openEdit(category)}
                                className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button
                                onClick={() => deleteCategory(category)}
                                className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <span className="material-icons-round text-lg">delete</span>
                            </button>
                        </div>
                    )}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedCategories.map((category) => (
                        <div key={category.id} className="bg-surface border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-white font-semibold">{category.name}</p>
                                    <p className="text-xs text-text-muted mt-1">{category.description || 'No description'}</p>
                                </div>
                                <span className="text-xs text-white bg-white/10 border border-white/10 rounded-lg px-2 py-1 font-mono">
                                    {safeInt(category.productCount)} items
                                </span>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => openEdit(category)}
                                    className="px-3 py-1.5 rounded-lg border border-white/10 text-text-secondary hover:text-white hover:bg-white/5 text-xs"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => deleteCategory(category)}
                                    className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {!loading && paginatedCategories.length === 0 && (
                        <div className="md:col-span-2 xl:col-span-3 text-center py-10 text-text-muted bg-surface border border-white/5 rounded-2xl">
                            No categories found.
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <span className="text-sm text-text-muted">
                    Page <span className="text-white font-semibold">{page}</span> of {totalPages}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-surface border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">{editingCategory ? 'Edit Category' : 'New Category'}</h3>
                            <button onClick={closeForm} className="text-text-muted hover:text-white">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <form onSubmit={submitCategory} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Category Name</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    placeholder="e.g. Supplements"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Category Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none min-h-[110px]"
                                    placeholder="Describe this category"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeForm} className="px-4 py-2 text-text-muted hover:text-white">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2 rounded-xl bg-primary hover:bg-orange-600 text-white font-semibold">
                                    {editingCategory ? 'Save Changes' : 'Create Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function StockOrdersTab({ user, navigate }) {
    const { formatPrice } = useCurrency();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const canManageOrder = user?.role === 'ADMIN' || user?.role === 'OWNER';
    const canEditOrder = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'STAFF';

    const fetchOrders = async (targetPage = page, targetStatus = statusFilter) => {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            qs.set('page', String(targetPage));
            qs.set('limit', String(STOCK_ORDER_PAGE_SIZE));
            if (targetStatus !== 'ALL') qs.set('status', targetStatus);
            const res = await axios.get(`/api/inventory/stock-orders?${qs.toString()}`);
            setOrders(res.data?.data || []);
            setPage(res.data?.meta?.page || 1);
            setTotalPages(res.data?.meta?.totalPages || 1);
        } catch (error) {
            await showAlert({ title: 'Load Failed', message: 'Failed to fetch stock orders', type: 'danger' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders(page, statusFilter);
    }, [page, statusFilter]);

    const filteredOrders = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return orders;
        return orders.filter((order) =>
            `${order.orderNumber || ''} ${order.supplierName || ''} ${order.status || ''}`.toLowerCase().includes(keyword)
        );
    }, [orders, searchTerm]);

    const markReceived = async (order) => {
        const confirmed = await showConfirm({
            title: 'Mark As Received?',
            message: `Confirm receipt for ${order.orderNumber}?`,
            confirmLabel: 'Mark Received',
            type: 'success'
        });
        if (!confirmed) return;

        try {
            await axios.put(`/api/inventory/stock-orders/${order.id}/receive`);
            await fetchOrders(page, statusFilter);
        } catch (error) {
            await showAlert({ title: 'Receive Failed', message: error.response?.data?.error || 'Failed to receive order', type: 'danger' });
        }
    };

    const cancelOrder = async (order) => {
        const confirmed = await showConfirm({
            title: 'Cancel Stock Order?',
            message: `Cancel ${order.orderNumber}?`,
            confirmLabel: 'Cancel Order',
            type: 'danger'
        });
        if (!confirmed) return;

        try {
            await axios.put(`/api/inventory/stock-orders/${order.id}/cancel`);
            await fetchOrders(page, statusFilter);
        } catch (error) {
            await showAlert({ title: 'Cancel Failed', message: error.response?.data?.error || 'Failed to cancel order', type: 'danger' });
        }
    };

    return (
        <div className="space-y-5">
            <div className="bg-surface border border-white/5 rounded-2xl p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-white font-semibold">Stock Orders</p>
                        <p className="text-xs text-text-muted mt-1">{filteredOrders.length} orders on this page</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${viewMode === 'list'
                                ? 'border-primary bg-primary/20 text-white'
                                : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${viewMode === 'grid'
                                ? 'border-primary bg-primary/20 text-white'
                                : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            Grid
                        </button>
                        <button
                            onClick={() => navigate('/inventory/stock-orders/new')}
                            className="bg-primary hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <span className="material-icons-round text-base">playlist_add</span>
                            Create Stock Order
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
                    <div className="flex flex-wrap gap-2">
                        {['ALL', 'PENDING', 'RECEIVED', 'CANCELLED'].map((status) => (
                            <button
                                key={status}
                                onClick={() => {
                                    setPage(1);
                                    setStatusFilter(status);
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${statusFilter === status
                                    ? 'border-primary text-white bg-primary/20'
                                    : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                    <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                        placeholder="Search order number or supplier"
                    />
                </div>
            </div>

            {viewMode === 'list' ? (
                <DataTable
                    isLoading={loading}
                    data={filteredOrders}
                    emptyMessage="No stock orders found."
                    columns={[
                        {
                            header: 'Order',
                            accessor: (order) => (
                                <div>
                                    <p className="text-white font-semibold">{order.orderNumber}</p>
                                    <p className="text-xs text-text-muted">{toLocalDateTime(order.createdAt)}</p>
                                </div>
                            )
                        },
                        {
                            header: 'Supplier',
                            accessor: (order) => <span className="text-text-secondary">{order.supplierName || 'N/A'}</span>
                        },
                        {
                            header: 'Items',
                            accessor: (order) => <span className="text-white font-mono">{safeInt(order.summary?.totalLineItems)}</span>,
                            className: 'text-center',
                            cellClassName: 'text-center'
                        },
                        {
                            header: 'Total Cost',
                            accessor: (order) => <span className="text-white font-semibold">{formatPrice(safeNumber(order.summary?.subtotal))}</span>,
                            className: 'text-right',
                            cellClassName: 'text-right'
                        },
                        {
                            header: 'Status',
                            accessor: (order) => (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadgeClasses[order.status] || 'bg-white/10 text-white'}`}>
                                    {order.status}
                                </span>
                            ),
                            className: 'text-center',
                            cellClassName: 'text-center'
                        }
                    ]}
                    actions={(order) => (
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setSelectedOrder(order)}
                                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                            >
                                View
                            </button>
                            {order.status === 'PENDING' && canEditOrder && (
                                <button
                                    onClick={() => navigate(`/inventory/stock-orders/${order.id}/edit`)}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                                >
                                    Edit
                                </button>
                            )}
                            {order.status === 'PENDING' && canManageOrder && (
                                <>
                                    <button
                                        onClick={() => markReceived(order)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                    >
                                        Mark Received
                                    </button>
                                    <button
                                        onClick={() => cancelOrder(order)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredOrders.map((order) => (
                        <div key={order.id} className="bg-surface border border-white/5 rounded-2xl p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-white font-semibold">{order.orderNumber}</p>
                                    <p className="text-xs text-text-muted mt-1">{toLocalDateTime(order.createdAt)}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClasses[order.status] || 'bg-white/10 text-white'}`}>
                                    {order.status}
                                </span>
                            </div>
                            <div className="text-sm">
                                <p className="text-text-secondary">Supplier: <span className="text-white">{order.supplierName || 'N/A'}</span></p>
                                <p className="text-text-secondary mt-1">Items: <span className="text-white">{safeInt(order.summary?.totalLineItems)}</span></p>
                                <p className="text-text-secondary mt-1">Total: <span className="text-white font-semibold">{formatPrice(safeNumber(order.summary?.subtotal))}</span></p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                                <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                                >
                                    View
                                </button>
                                {order.status === 'PENDING' && canEditOrder && (
                                    <button
                                        onClick={() => navigate(`/inventory/stock-orders/${order.id}/edit`)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                                    >
                                        Edit
                                    </button>
                                )}
                                {order.status === 'PENDING' && canManageOrder && (
                                    <>
                                        <button
                                            onClick={() => markReceived(order)}
                                            className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                        >
                                            Mark Received
                                        </button>
                                        <button
                                            onClick={() => cancelOrder(order)}
                                            className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {!loading && filteredOrders.length === 0 && (
                        <div className="md:col-span-2 xl:col-span-3 text-center py-10 text-text-muted bg-surface border border-white/5 rounded-2xl">
                            No stock orders found.
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <span className="text-sm text-text-muted">
                    Page <span className="text-white font-semibold">{page}</span> of {totalPages}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            {selectedOrder && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-surface border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-bold text-lg">{selectedOrder.orderNumber}</h3>
                                <p className="text-xs text-text-muted">{toLocalDateTime(selectedOrder.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedOrder.status === 'PENDING' && canEditOrder && (
                                    <button
                                        onClick={() => {
                                            setSelectedOrder(null);
                                            navigate(`/inventory/stock-orders/${selectedOrder.id}/edit`);
                                        }}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                                    >
                                        Edit
                                    </button>
                                )}
                                <button onClick={() => setSelectedOrder(null)} className="text-text-muted hover:text-white">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <InfoPill label="Supplier" value={selectedOrder.supplierName || 'N/A'} />
                                <InfoPill label="Status" value={selectedOrder.status} />
                                <InfoPill label="Total" value={formatPrice(safeNumber(selectedOrder.summary?.subtotal))} />
                            </div>
                            <div className="border border-white/10 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-white/5 text-text-muted">
                                        <tr>
                                            <th className="text-left px-4 py-2">Product</th>
                                            <th className="text-right px-4 py-2">Qty</th>
                                            <th className="text-right px-4 py-2">Cost</th>
                                            <th className="text-right px-4 py-2">Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(selectedOrder.items || []).map((item) => (
                                            <tr key={`${selectedOrder.id}-${item.productId}`}>
                                                <td className="px-4 py-2 text-white">{item.name}</td>
                                                <td className="px-4 py-2 text-right text-text-secondary">{safeInt(item.quantity)}</td>
                                                <td className="px-4 py-2 text-right text-text-secondary">{formatPrice(safeNumber(item.cost))}</td>
                                                <td className="px-4 py-2 text-right text-white">{formatPrice(safeNumber(item.quantity) * safeNumber(item.cost))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {selectedOrder.notes && (
                                <div className="text-sm text-text-secondary bg-white/5 border border-white/10 rounded-xl p-3">
                                    {selectedOrder.notes}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProductFormPage({ productId, onCancel, onSaved }) {
    const { alert: showAlert } = useConfirm();
    const { formatPrice } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        imageUrl: '',
        barcode: '',
        name: '',
        description: '',
        category: '',
        cost: '',
        stock: '',
        minStock: '5'
    });

    const isEditing = Boolean(productId);

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/inventory/categories');
            const rows = Array.isArray(res.data) ? res.data : [];
            setCategories(rows);
            if (!formData.category && rows[0]?.name) {
                setFormData((prev) => ({ ...prev, category: rows[0].name }));
            }
        } catch (error) {
            setCategories([]);
        }
    };

    const fetchProduct = async () => {
        if (!isEditing) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/products/${productId}`);
            const product = res.data;
            setFormData({
                imageUrl: product.imageUrl || '',
                barcode: product.barcode || product.sku || '',
                name: product.name || '',
                description: product.description || '',
                category: product.category || '',
                cost: String(safeNumber(product.cost, safeNumber(product.price))),
                stock: String(safeInt(product.stock)),
                minStock: String(safeInt(product.minStock, 5))
            });
        } catch (error) {
            await showAlert({ title: 'Load Failed', message: 'Failed to load product details', type: 'danger' });
            onCancel();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchProduct();
    }, [productId]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const payload = {
            imageUrl: formData.imageUrl || null,
            barcode: String(formData.barcode || '').trim(),
            name: String(formData.name || '').trim(),
            description: String(formData.description || '').trim(),
            category: String(formData.category || '').trim(),
            cost: safeNumber(formData.cost),
            price: safeNumber(formData.cost),
            stock: safeInt(formData.stock),
            minStock: safeInt(formData.minStock)
        };

        try {
            if (isEditing) {
                await axios.put(`/api/products/${productId}`, payload);
            } else {
                await axios.post('/api/products', payload);
            }
            await showAlert({
                title: isEditing ? 'Product Updated' : 'Product Added',
                message: isEditing ? 'Product details saved successfully.' : 'New product created successfully.',
                type: 'success'
            });
            onSaved();
        } catch (error) {
            await showAlert({ title: 'Save Failed', message: error.response?.data?.error || 'Failed to save product', type: 'danger' });
        }
    };

    const normalizedName = formData.name?.trim() || 'New Product';
    const normalizedCategory = formData.category?.trim() || 'Uncategorized';
    const costValue = safeNumber(formData.cost);
    const stockValue = safeInt(formData.stock);
    const lowStockValue = safeInt(formData.minStock);
    const isLowStock = stockValue <= lowStockValue;

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">{isEditing ? 'Edit Product' : 'Add Product'}</h1>
                    <p className="text-text-muted mt-1">{isEditing ? 'Update product details and stock info' : 'Create a new inventory item'}</p>
                </div>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                >
                    Cancel
                </button>
            </header>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-5">
                    <section className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-primary">badge</span>
                            <h2 className="text-white font-semibold">Basic Details</h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Product Name</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    placeholder="e.g. Whey Protein"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Barcode</label>
                                <input
                                    required
                                    value={formData.barcode}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, barcode: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none font-mono"
                                    placeholder="e.g. 1234567890123"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Category</label>
                            {categories.length > 0 ? (
                                <select
                                    required
                                    value={formData.category}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                >
                                    {!formData.category && <option value="">Select category</option>}
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.name}>{category.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    required
                                    value={formData.category}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    placeholder="Enter category"
                                />
                            )}
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none min-h-[120px]"
                                placeholder="Brief product description"
                            />
                        </div>
                    </section>

                    <section className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-primary">inventory</span>
                            <h2 className="text-white font-semibold">Inventory And Pricing</h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Cost of Product</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.cost}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, cost: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Stock Count</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    value={formData.stock}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, stock: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Low Stock Alert</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    value={formData.minStock}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, minStock: event.target.value }))}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    placeholder="5"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-5 xl:sticky xl:top-6 h-fit">
                    <section className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-primary">visibility</span>
                            <h2 className="text-white font-semibold">Live Preview</h2>
                        </div>
                        <div className="w-full aspect-square max-h-[220px] rounded-2xl border border-white/10 bg-surfaceHighlight overflow-hidden flex items-center justify-center">
                            {formData.imageUrl
                                ? <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                : <span className="material-icons-round text-text-muted text-4xl">image</span>}
                        </div>
                        <div>
                            <p className="text-white font-semibold">{normalizedName}</p>
                            <p className="text-xs text-text-muted mt-1">{formData.description?.trim() || 'No description yet.'}</p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className="px-2 py-1 rounded-lg text-[11px] bg-white/5 border border-white/10 text-text-secondary uppercase font-semibold">
                                    {normalizedCategory}
                                </span>
                                <span className="px-2 py-1 rounded-lg text-[11px] bg-white/5 border border-white/10 text-text-secondary font-mono">
                                    {formData.barcode?.trim() || 'No barcode'}
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InfoPill label="Cost" value={formatPrice(costValue)} />
                            <InfoPill label="Stock" value={String(stockValue)} />
                        </div>
                        <div className={`text-xs rounded-xl px-3 py-2 border ${isLowStock ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
                            {isLowStock ? 'Stock is at or below low alert threshold.' : 'Stock level is above low alert threshold.'}
                        </div>
                    </section>

                    <section className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Product Image URL</label>
                            <input
                                value={formData.imageUrl}
                                onChange={(event) => setFormData((prev) => ({ ...prev, imageUrl: event.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                placeholder="https://image-url..."
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-1">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-text-muted hover:text-white"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold disabled:opacity-60"
                                disabled={loading}
                            >
                                {isEditing ? 'Save Changes' : 'Create Product'}
                            </button>
                        </div>
                    </section>
                </aside>
            </form>
        </div>
    );
}

function CreateStockOrderPage({ onCancel, onCreated, orderId }) {
    const { formatPrice } = useCurrency();
    const { alert: showAlert } = useConfirm();
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [supplierId, setSupplierId] = useState('');
    const [notes, setNotes] = useState('');
    const [search, setSearch] = useState('');
    const [catalogView, setCatalogView] = useState('grid');
    const [cartItems, setCartItems] = useState([]);
    const [createdAtValue, setCreatedAtValue] = useState(null);
    const [orderNumber, setOrderNumber] = useState('');
    const isEditing = Boolean(orderId);
    const createdAtLabel = useMemo(
        () => (createdAtValue ? toLocalDateTime(createdAtValue) : new Date().toLocaleString()),
        [createdAtValue]
    );

    useEffect(() => {
        const bootstrap = async () => {
            setLoading(true);
            try {
                const orderRequest = isEditing
                    ? axios.get(`/api/inventory/stock-orders/${orderId}`)
                    : Promise.resolve(null);

                const [productsRes, suppliersRes, orderRes] = await Promise.all([
                    axios.get('/api/products'),
                    axios.get('/api/suppliers'),
                    orderRequest
                ]);
                setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
                setSuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : []);

                if (isEditing) {
                    const order = orderRes?.data;
                    if (!order) {
                        await showAlert({ title: 'Load Failed', message: 'Stock order not found.', type: 'danger' });
                        onCancel();
                        return;
                    }
                    if (order.status !== 'PENDING') {
                        await showAlert({ title: 'Edit Not Allowed', message: 'Only pending stock orders can be edited.', type: 'danger' });
                        onCancel();
                        return;
                    }

                    setSupplierId(String(order.supplierId || ''));
                    setNotes(order.notes || '');
                    setCreatedAtValue(order.createdAt || null);
                    setOrderNumber(order.orderNumber || '');
                    setCartItems(
                        (Array.isArray(order.items) ? order.items : [])
                            .map((item) => ({
                                productId: safeInt(item.productId),
                                name: item.name || '',
                                barcode: item.barcode || '',
                                imageUrl: item.imageUrl || '',
                                quantity: Math.max(1, safeInt(item.quantity, 1)),
                                cost: Math.max(0, safeNumber(item.cost, 0))
                            }))
                            .filter((item) => item.productId > 0)
                    );
                }
            } catch (error) {
                await showAlert({
                    title: 'Load Failed',
                    message: isEditing ? 'Failed to load stock order details' : 'Failed to load products/suppliers',
                    type: 'danger'
                });
                if (isEditing) onCancel();
            } finally {
                setLoading(false);
            }
        };
        bootstrap();
    }, [orderId]);

    const filteredProducts = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return products;
        return products.filter((product) => {
            const haystack = `${product.name || ''} ${product.category || ''} ${product.barcode || product.sku || ''}`.toLowerCase();
            return haystack.includes(keyword);
        });
    }, [products, search]);

    const addToCart = (product) => {
        setCartItems((prev) => {
            const exists = prev.find((item) => item.productId === product.id);
            if (exists) {
                return prev.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }

            return [
                ...prev,
                {
                    productId: product.id,
                    name: product.name,
                    barcode: product.barcode || product.sku || '',
                    imageUrl: product.imageUrl || '',
                    quantity: 1,
                    cost: safeNumber(product.cost, safeNumber(product.price))
                }
            ];
        });
    };

    const updateCartItem = (productId, key, value) => {
        setCartItems((prev) => prev.map((item) => {
            if (item.productId !== productId) return item;
            if (key === 'quantity') {
                return { ...item, quantity: Math.max(1, safeInt(value, 1)) };
            }
            if (key === 'cost') {
                return { ...item, cost: Math.max(0, safeNumber(value, 0)) };
            }
            return item;
        }));
    };

    const removeCartItem = (productId) => {
        setCartItems((prev) => prev.filter((item) => item.productId !== productId));
    };

    const summary = useMemo(() => {
        const totalQuantity = cartItems.reduce((acc, item) => acc + item.quantity, 0);
        const subtotal = cartItems.reduce((acc, item) => acc + item.quantity * item.cost, 0);
        return {
            totalQuantity,
            totalLineItems: cartItems.length,
            subtotal
        };
    }, [cartItems]);

    const submitOrder = async () => {
        if (!supplierId) {
            await showAlert({ title: 'Missing Supplier', message: 'Please select a supplier before creating the order.', type: 'danger' });
            return;
        }
        if (!cartItems.length) {
            await showAlert({ title: 'Empty Cart', message: 'Add at least one product to the stock order.', type: 'danger' });
            return;
        }

        try {
            setLoading(true);
            const payload = {
                supplierId: safeInt(supplierId),
                notes,
                items: cartItems.map((item) => ({
                    productId: item.productId,
                    quantity: safeInt(item.quantity),
                    cost: safeNumber(item.cost)
                }))
            };

            if (isEditing) {
                await axios.put(`/api/inventory/stock-orders/${orderId}`, payload);
            } else {
                await axios.post('/api/inventory/stock-orders', payload);
            }

            await showAlert({
                title: isEditing ? 'Stock Order Updated' : 'Stock Order Created',
                message: isEditing
                    ? 'Order changes have been saved successfully.'
                    : 'Order has been added to stock orders.',
                type: 'success'
            });
            onCreated();
        } catch (error) {
            await showAlert({
                title: isEditing ? 'Update Failed' : 'Create Failed',
                message: error.response?.data?.error || (isEditing ? 'Failed to update stock order' : 'Failed to create stock order'),
                type: 'danger'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">{isEditing ? 'Edit Stock Order' : 'Create Stock Order'}</h1>
                    <p className="text-text-muted mt-1">
                        {isEditing ? 'Modify supplier, items, quantities, and costs before saving.' : 'Build and submit a supplier stock order'}
                    </p>
                </div>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                >
                    Cancel
                </button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <section className="xl:col-span-3 space-y-4">
                    <div className="bg-surface border border-white/5 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-white font-semibold">Product Catalog</p>
                                <p className="text-xs text-text-muted mt-1">{filteredProducts.length} products shown</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCatalogView('list')}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${catalogView === 'list'
                                        ? 'border-primary bg-primary/20 text-white'
                                        : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    List
                                </button>
                                <button
                                    onClick={() => setCatalogView('grid')}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${catalogView === 'grid'
                                        ? 'border-primary bg-primary/20 text-white'
                                        : 'border-white/10 text-text-secondary hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Grid
                                </button>
                            </div>
                        </div>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                            placeholder="Search by name, category, barcode"
                        />
                    </div>
                    {catalogView === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredProducts.map((product) => (
                                <div key={product.id} className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-16 h-16 rounded-xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                                            {product.imageUrl
                                                ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                : <span className="material-icons-round text-text-muted">image</span>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white font-semibold truncate">{product.name}</p>
                                            <p className="text-xs text-text-muted truncate">{product.category}</p>
                                            <p className="text-xs text-text-secondary font-mono">Barcode: {product.barcode || product.sku || 'N/A'}</p>
                                            <p className="text-xs text-emerald-300">Current Stock: {safeInt(product.stock)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white font-semibold">{formatPrice(safeNumber(product.cost, safeNumber(product.price)))}</span>
                                        <button
                                            onClick={() => addToCart(product)}
                                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-orange-600 text-white text-sm font-semibold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!loading && filteredProducts.length === 0 && (
                                <div className="md:col-span-2 text-center py-10 text-text-muted bg-surface border border-white/5 rounded-2xl">
                                    No products matched your search.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredProducts.map((product) => (
                                <div key={product.id} className="bg-surface border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-11 h-11 rounded-lg border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {product.imageUrl
                                                ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                : <span className="material-icons-round text-text-muted text-sm">image</span>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white font-semibold text-sm truncate">{product.name}</p>
                                            <p className="text-xs text-text-muted truncate">{product.category} | {product.barcode || product.sku || 'No barcode'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary">Stock: <span className="text-white">{safeInt(product.stock)}</span></span>
                                        <span className="text-sm text-white font-semibold">{formatPrice(safeNumber(product.cost, safeNumber(product.price)))}</span>
                                        <button
                                            onClick={() => addToCart(product)}
                                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-orange-600 text-white text-xs font-semibold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!loading && filteredProducts.length === 0 && (
                                <div className="text-center py-10 text-text-muted bg-surface border border-white/5 rounded-2xl">
                                    No products matched your search.
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <aside className="xl:col-span-2">
                    <div className="bg-surface border border-white/5 rounded-2xl p-5 space-y-5 xl:sticky xl:top-6">
                        <div className="space-y-3">
                            <h2 className="text-white font-bold text-lg">Order Details</h2>
                            {isEditing && <InfoPill label="Order No." value={orderNumber || `#${orderId}`} />}
                            <InfoPill label="Created At" value={createdAtLabel} />
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Supplier</label>
                                <select
                                    value={supplierId}
                                    onChange={(event) => setSupplierId(event.target.value)}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-primary outline-none"
                                >
                                    <option value="">Select supplier</option>
                                    {suppliers.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-primary outline-none min-h-[80px]"
                                    placeholder="Optional notes for this order"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-white font-semibold">Order Cart</h3>
                            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                {cartItems.map((item) => (
                                    <div key={item.productId} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                                                <p className="text-xs text-text-muted font-mono">{item.barcode || 'No barcode'}</p>
                                            </div>
                                            <button
                                                onClick={() => removeCartItem(item.productId)}
                                                className="text-red-300 hover:text-red-200"
                                            >
                                                <span className="material-icons-round text-base">delete</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] text-text-muted mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(event) => updateCartItem(item.productId, 'quantity', event.target.value)}
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-text-muted mb-1">Cost</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.cost}
                                                    onChange={(event) => updateCartItem(item.productId, 'cost', event.target.value)}
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-text-secondary">
                                            Line Total: <span className="text-white font-semibold">{formatPrice(safeNumber(item.quantity) * safeNumber(item.cost))}</span>
                                        </div>
                                    </div>
                                ))}
                                {!cartItems.length && (
                                    <div className="text-sm text-text-muted text-center py-4 bg-white/5 border border-white/10 rounded-xl">
                                        No items added yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm text-text-secondary">
                                <span>Line Items</span>
                                <span>{summary.totalLineItems}</span>
                            </div>
                            <div className="flex justify-between text-sm text-text-secondary">
                                <span>Total Qty</span>
                                <span>{summary.totalQuantity}</span>
                            </div>
                            <div className="flex justify-between text-base text-white font-bold pt-2 border-t border-white/10">
                                <span>Total</span>
                                <span>{formatPrice(summary.subtotal)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-secondary hover:text-white hover:bg-white/5"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitOrder}
                                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-orange-600 text-white font-semibold disabled:opacity-60"
                                disabled={loading}
                            >
                                {isEditing ? 'Update Order' : 'Create Order'}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function InfoPill({ label, value }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
            <p className="text-sm text-white font-semibold break-words">{value || 'N/A'}</p>
        </div>
    );
}
