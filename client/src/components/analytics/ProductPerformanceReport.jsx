import React, { useMemo } from 'react';
import { useCurrency } from '../../context/CurrencyContext';

const ProductPerformanceReport = ({ data }) => {
    const { formatPrice } = useCurrency();
    const { productSales, products, totalRevenue } = data;

    // Logic duplicated from ProductPerformanceView for consistency
    // In a real app, this logic should be extracted to a hook or utility
    const allProductPerformance = useMemo(() => {
        if (!products || !productSales) return [];
        return products.map(p => {
            const salesData = productSales[p.id] || { totalSales: 0, totalProfit: 0, unitsSold: 0 };

            const realizedMargin = salesData.totalSales > 0 ? ((salesData.totalProfit / salesData.totalSales) * 100) : 0;
            const currentSupplyCost = p.supplyCost || 0;
            const currentPrice = p.price || 0;
            const potentialMargin = currentPrice > 0 ? ((currentPrice - currentSupplyCost) / currentPrice) * 100 : 0;

            // Calculate COGS
            const cogs = salesData.totalSales - salesData.totalProfit;

            return {
                id: p.id,
                name: p.name,
                category: p.category,
                price: p.price,
                stock: p.stock,
                minStock: p.minStock,
                unitsSold: salesData.unitsSold,
                totalSales: salesData.totalSales,
                totalProfit: salesData.totalProfit,
                cogs: cogs,
                margin: salesData.totalSales > 0 ? realizedMargin.toFixed(1) : potentialMargin.toFixed(1),
                isPotentialMargin: salesData.totalSales === 0,
                contributionPercent: totalRevenue > 0 ? ((salesData.totalSales / totalRevenue) * 100).toFixed(1) : 0
            };
        }).sort((a, b) => b.totalSales - a.totalSales);
    }, [products, productSales, totalRevenue]);

    return (
        <div className="w-full">
            {/* Summary Metrics */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-xs text-gray-500 uppercase">Total Products</p>
                    <p className="text-2xl font-bold">{products.length}</p>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-xs text-gray-500 uppercase">Total Items Sold</p>
                    <p className="text-2xl font-bold">{allProductPerformance.reduce((acc, p) => acc + p.unitsSold, 0)}</p>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-xs text-gray-500 uppercase">Total COGS</p>
                    <p className="text-2xl font-bold">{formatPrice(allProductPerformance.reduce((acc, p) => acc + (p.cogs || 0), 0))}</p>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-xs text-gray-500 uppercase">Total Profit</p>
                    <p className="text-2xl font-bold text-green-600">{formatPrice(allProductPerformance.reduce((acc, p) => acc + p.totalProfit, 0))}</p>
                </div>
            </div>

            {/* Product Table */}
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs border-b-2 border-gray-300">
                    <tr>
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2 text-right">Sold</th>
                        <th className="px-2 py-2 text-right">Revenue</th>
                        <th className="px-2 py-2 text-right">COGS</th>
                        <th className="px-2 py-2 text-right">Profit</th>
                        <th className="px-2 py-2 text-right">Margin</th>
                        <th className="px-2 py-2 text-right">Stock</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {allProductPerformance.map((p, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-2">
                                <div className="font-bold text-gray-800">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.category}</div>
                            </td>
                            <td className="px-2 py-2 text-right">{p.unitsSold}</td>
                            <td className="px-2 py-2 text-right">{formatPrice(p.totalSales)}</td>
                            <td className="px-2 py-2 text-right text-red-600">{formatPrice(p.cogs)}</td>
                            <td className="px-2 py-2 text-right text-green-600">{formatPrice(p.totalProfit)}</td>
                            <td className="px-2 py-2 text-right">
                                <div className="flex flex-col items-end">
                                    <span className={parseFloat(p.margin) >= 30 ? 'text-green-600' : 'text-yellow-600'}>
                                        {p.margin}%
                                    </span>
                                    {p.isPotentialMargin && (
                                        <span className="text-[9px] text-gray-400 uppercase">Pot.</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-2 py-2 text-right">
                                <span className={p.stock <= p.minStock ? 'text-red-500 font-bold' : ''}>
                                    {p.stock}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ProductPerformanceReport;
