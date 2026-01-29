import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export default function PurchaseHistory() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/payments');
            setHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch history");
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">
                    My Purchase History
                </h1>
            </div>

            <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-text-secondary">
                    <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Method</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {history.length === 0 && (
                            <tr><td colSpan="4" className="p-6 text-center text-text-muted">No transactions found.</td></tr>
                        )}
                        {history.map(pay => (
                            <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 text-white font-medium">{new Date(pay.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(pay.date).toLocaleTimeString()}</span></td>
                                <td className="px-6 py-4"><span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold">{pay.type}</span></td>
                                <td className="px-6 py-4 text-white font-bold">{formatPrice(pay.amount)}</td>
                                <td className="px-6 py-4 text-text-secondary">{pay.method}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
