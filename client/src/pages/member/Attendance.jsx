import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Attendance() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/access/logs');
            setLogs(res.data);
        } catch {
            console.error("Failed to fetch logs");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-white p-6 text-center">Loading attendance...</div>;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Attendance History</h1>
                <p className="text-text-muted text-xs sm:text-sm mt-1">Your check-in records</p>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 text-center">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Total Check-ins</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">{logs.length}</p>
                </div>
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 text-center">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">This Month</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                        {logs.filter(l => new Date(l.checkIn).getMonth() === new Date().getMonth()).length}
                    </p>
                </div>
                <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5 text-center col-span-2 sm:col-span-1">
                    <p className="text-text-muted text-xs sm:text-sm mb-1">Last Visited</p>
                    <p className="text-xs sm:text-sm font-bold text-yellow-400">
                        {logs.length > 0 ? new Date(logs[0].checkIn).toLocaleDateString() : 'Never'}
                    </p>
                </div>
            </div>

            {/* Attendance List */}
            {logs.length === 0 ? (
                <div className="text-center py-12">
                    <span className="material-icons-round text-4xl text-text-muted opacity-50 block mb-2">history</span>
                    <p className="text-text-muted">No attendance records yet</p>
                </div>
            ) : (
                <div className="space-y-2 sm:space-y-3">
                    {/* Desktop Table View */}
                    <div className="hidden sm:block bg-surface rounded-2xl border border-white/5 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 sm:px-6 py-3">Date & Time</th>
                                    <th className="px-4 sm:px-6 py-3">Status</th>
                                    <th className="px-4 sm:px-6 py-3">Location</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.map((log, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 sm:px-6 py-4 text-white font-medium">{new Date(log.checkIn).toLocaleString()}</td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                                                log.status === 'ALLOWED'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${log.status === 'ALLOWED' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-text-secondary">Main Entrance</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-3">
                        {logs.map((log, i) => (
                            <div key={i} className="bg-surface rounded-xl p-4 border border-white/5">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div>
                                        <p className="font-bold text-white text-sm">{new Date(log.checkIn).toLocaleDateString()}</p>
                                        <p className="text-text-muted text-xs">{new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 flex-shrink-0 ${
                                        log.status === 'ALLOWED'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-red-500/10 text-red-400'
                                    }`}>
                                        <span className={`w-2 h-2 rounded-full ${log.status === 'ALLOWED' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                        {log.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-text-secondary text-xs">
                                    <span className="material-icons-round text-sm">location_on</span>
                                    <span>Main Entrance</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
