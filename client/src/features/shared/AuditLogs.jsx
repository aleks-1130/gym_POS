import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get('/api/owner/audit-logs');
                setLogs(res.data);
            } catch (error) {
                console.error("Failed to fetch logs");
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    if (loading) return <div className="text-white p-8">Loading Logs...</div>;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">System Audit Logs</h1>
                <p className="text-text-muted mt-1">Track security events and sensitive actions</p>
            </header>

            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 text-text-muted text-sm bg-white/5">
                            <th className="p-4">Action</th>
                            <th className="p-4">Performed By</th>
                            <th className="p-4">Target</th>
                            <th className="p-4">Details</th>
                            <th className="p-4">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-mono text-primary font-bold">{log.action}</td>
                                <td className="p-4 text-white">{log.performedBy}</td>
                                <td className="p-4 text-text-secondary">{log.target}</td>
                                <td className="p-4 text-text-muted italic">{log.details}</td>
                                <td className="p-4 text-text-muted">{new Date(log.timestamp).toLocaleString()}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-text-muted">No logs found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
