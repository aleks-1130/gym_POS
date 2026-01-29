import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Attendance() {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/access/logs');
            setLogs(res.data);
        } catch {
            console.error("Failed to fetch logs");
        }
    };

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
