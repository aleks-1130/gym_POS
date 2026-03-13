import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import DataTable from '../../components/common/DataTable';

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

    const columns = useMemo(() => [
        {
            header: 'Action',
            accessor: (log) => <span className="font-mono text-primary font-bold">{log.action}</span>
        },
        {
            header: 'Performed By',
            accessor: (log) => <span className="text-white">{log.performedBy}</span>
        },
        {
            header: 'Target',
            accessor: (log) => <span className="text-text-secondary">{log.target}</span>
        },
        {
            header: 'Details',
            accessor: (log) => <span className="text-text-muted italic">{log.details}</span>
        },
        {
            header: 'Timestamp',
            accessor: (log) => <span className="text-text-muted">{new Date(log.timestamp).toLocaleString()}</span>
        }
    ], []);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">System Audit Logs</h1>
                <p className="text-text-muted mt-1">Track security events and sensitive actions</p>
            </header>

            <DataTable
                columns={columns}
                data={logs}
                isLoading={loading}
                emptyMessage="No logs found."
                className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm"
            />
        </div>
    );
}

