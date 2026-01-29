import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Access() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('ONLINE');

    useEffect(() => {
        fetchLogs();
        if (user.role !== 'MEMBER') {
            const interval = setInterval(fetchLogs, 5000); // Poll every 5s
            return () => clearInterval(interval);
        }
    }, [user.role]);

    const fetchLogs = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/access/logs');
            setLogs(res.data);
        } catch {
            // Fallback
            console.error("Failed to fetch logs");
        }
    };

    const simulateScan = async (accessStatus) => {
        try {
            // ID 1 is assumed to exist for demo seed
            await axios.post('http://localhost:5000/api/access/checkin', { memberId: 1, status: accessStatus });
            fetchLogs();
        } catch (e) {
            console.error("Scan failed", e);
        }
    };

    if (user.role === 'MEMBER') {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">My Attendance History</h2>
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date & Time</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Location</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {logs.length === 0 && (
                                <tr><td colSpan="3" className="p-6 text-center text-text-muted">No attendance records found.</td></tr>
                            )}
                            {logs.map((log, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-white font-medium">{new Date(log.checkIn).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-text-secondary">Main Entrance</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Staff/Admin View
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Attendance Scanner</h2>
                <div className="flex items-center gap-2 bg-surfaceHighlight px-4 py-2 rounded-full border border-white/10">
                    <span className={`w-2.5 h-2.5 rounded-full ${status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="text-sm font-bold text-text-secondary">Gate System {status}</span>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Simulation Panel */}
                <div className="bg-surface rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center sticky top-4 shadow-sm">
                    <span className="material-icons-round text-6xl text-text-muted mb-4 bg-white/5 p-6 rounded-full">gavel</span>
                    <h3 className="text-xl font-bold text-white mb-2">Manual Gate Override</h3>
                    <p className="text-text-muted text-center mb-8 max-w-xs text-sm">Use these buttons to simulate member cards being scanned at the turnstile.</p>

                    <div className="flex gap-4 w-full">
                        <button onClick={() => simulateScan(null)} className="flex-1 bg-primary hover:bg-orange-600 text-white px-6 py-4 rounded-2xl flex flex-col items-center transition-transform active:scale-95 shadow-lg shadow-primary/20">
                            <span className="material-icons-round text-3xl mb-1">contactless</span>
                            <span className="font-bold">Simulate Card Swipe</span>
                        </button>
                    </div>

                    <div className="flex gap-4 mt-6 pt-6 border-t border-white/5 w-full justify-center">
                        <button onClick={() => simulateScan('ALLOWED')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                            Force Allow
                        </button>
                        <button onClick={() => simulateScan('DENIED')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                            Force Deny
                        </button>
                    </div>
                </div>

                {/* Logs */}
                <div className="bg-surface rounded-3xl border border-white/5 p-6 overflow-hidden flex flex-col h-[calc(100vh-10rem)] shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Live Access Feed</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                        {logs.map((log, i) => (
                            <div key={i} className={`p-4 rounded-xl border-l-4 flex justify-between items-center bg-white/5 hover:bg-white/10 border hover:shadow-sm transition-all ${log.status === 'ALLOWED' ? 'border-l-emerald-500 border-white/5' : 'border-l-red-500 border-white/5'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <span className={`material-icons-round p-2 rounded-full ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {log.status === 'ALLOWED' ? 'check' : 'block'}
                                    </span>
                                    <div>
                                        <p className="text-white font-bold text-sm">
                                            {log.member ? `${log.member.firstName} ${log.member.lastName}` : 'Unknown Tag'}
                                        </p>
                                        <p className="text-xs text-text-muted">Main Entrance</p>
                                    </div>
                                </div>
                                <span className="text-xs text-text-muted font-mono font-medium">
                                    {new Date(log.checkIn).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted">
                                <span className="material-icons-round text-4xl mb-2">history</span>
                                <p>No scans yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
}
