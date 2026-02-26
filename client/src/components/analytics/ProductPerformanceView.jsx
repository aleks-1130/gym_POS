import React, { useState } from 'react';
import { Package, AlertCircle, Search } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import DataTable from '../common/DataTable';

const ProductPerformanceView = ({ data }) => {
    const { formatPrice } = useCurrency();
    const { productSales, products, totalRevenue, topCategories } = data;
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = (products || []).filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* 1. Category Performance (Top Summary) */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4">Category Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {topCategories.map((cat, i) => (
                        <div key={i} className="p-4 bg-surface rounded-xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white text-lg">{cat.category}</h4>
                                <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted">
                                    {cat.unitsSold} sold
                                </span>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-sm text-text-muted">Revenue</span>
                                    <span className="text-xl font-bold text-emerald-400">{formatPrice(cat.revenue)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted">Profit</span>
                                    <span className="text-emerald-400">{formatPrice(cat.profit)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted">Margin</span>
                                    <span className={`${parseFloat(cat.margin) >= 30 ? 'text-green-400' : 'text-yellow-400'}`}>{cat.margin}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. All Products Performance Table (Full Width) */}
            <div className="bg-surface p-6 rounded-2xl border border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-white">Product Performance</h3>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DataTable
                    columns={[
                        {
                            header: "Product",
                            accessor: (row) => (
                                <div>
                                    <span className="font-medium text-white">{row.name}</span>
                                    <span className="block text-xs text-text-muted mt-0.5">{row.category}</span>
                                </div>
                            )
                        },
                        {
                            header: "Sold",
                            accessor: "unitsSold",
                            className: "text-right",
                            cellClassName: "text-right text-text-muted"
                        },
                        {
                            header: "Revenue",
                            accessor: (row) => <span className="text-emerald-400 font-medium">{formatPrice(row.totalSales)}</span>,
                            className: "text-right",
                            cellClassName: "text-right"
                        },
                        {
                            header: "COGS",
                            accessor: (row) => <span className="text-rose-400">{formatPrice(row.totalSales - row.totalProfit)}</span>,
                            className: "text-right",
                            cellClassName: "text-right"
                        },
                        {
                            header: "Profit",
                            accessor: (row) => <span className="text-emerald-400 font-medium">{formatPrice(row.totalProfit)}</span>,
                            className: "text-right",
                            cellClassName: "text-right"
                        },
                        {
                            header: "Margin",
                            accessor: (row) => (
                                <div className="flex flex-col items-end">
                                    <span className={`${parseFloat(row.margin) >= 30 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {row.margin}%
                                    </span>
                                    {row.isPotentialMargin && (
                                        <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Potential</span>
                                    )}
                                </div>
                            ),
                            className: "text-right",
                            cellClassName: "text-right"
                        },
                        {
                            header: "Stock",
                            accessor: (row) => (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${row.stock <= row.minStock ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-white/5 text-text-muted'}`}>
                                    {row.stock}
                                </span>
                            ),
                            className: "text-right",
                            cellClassName: "text-right"
                        }
                    ]}
                    data={filteredProducts}
                    emptyMessage={`No products found matching "${searchTerm}"`}
                    className="border-none shadow-none bg-transparent"
                />
            </div>

            {/* 3. Low Stock Alert Section */}
            <div className="bg-surface p-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="text-orange-400" />
                    <h3 className="text-lg font-bold text-white">Low Stock Alerts</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.lowStockItems && data.lowStockItems.length > 0 ? (
                        data.lowStockItems.map((p, i) => (
                            <div key={i} className="p-4 bg-orange-500/10 border border-orange-500/20 flex justify-between items-center rounded-xl">
                                <div>
                                    <p className="font-bold text-orange-200">{p.name}</p>
                                    <p className="text-sm text-orange-400/80">
                                        Only <span className="font-bold">{p.stock}</span> remaining
                                    </p>
                                </div>
                                <span className="text-xs text-orange-400/60 bg-orange-500/10 px-2 py-1 rounded">
                                    Min: {p.minStock}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full p-8 text-center bg-white/5 rounded-xl border border-white/5 border-dashed">
                            <p className="text-text-muted">All inventory levels are healthy.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductPerformanceView;
