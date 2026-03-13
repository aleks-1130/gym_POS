import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function DoorScanner() {
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('ONLINE');
    const [scanning, setScanning] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            
            const res = await axios.get('/api/access/logs');
            setLogs(res.data);
        } catch {
            console.error("Failed to fetch logs");
        }
    };

    const simulateScan = async (accessStatus) => {
        setScanning(true);
        try {
            // Real simulation call
            
            const res = await axios.post('/api/access/simulate',
                { status: accessStatus });

            // Delay for animation effect
            setTimeout(() => {
                navigate(`/scan-result/${res.data.id}`);
                setScanning(false);
            }, 1200);
        } catch (e) {
            // Fallback to dummy if server simulation fails or no members
            setTimeout(() => {
                navigate('/scan-result/dummy');
                setScanning(false);
            }, 1200);
        }
    };

    const handleLogClick = (logId) => {
        navigate(`/scan-result/${logId}`);
    };

    const getEntity = (log) => {
        if (log?.member) {
            return {
                name: `${log.member.firstName} ${log.member.lastName}`,
                initials: `${log.member.firstName?.[0] || ''}${log.member.lastName?.[0] || ''}` || 'M',
                imageUrl: log.member.imageUrl,
                type: 'Member'
            };
        }
        if (log?.trainer) {
            return {
                name: log.trainer.name || `Trainer #${log.trainer.id}`,
                initials: (log.trainer.name || 'T').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
                imageUrl: log.trainer.imageUrl,
                type: 'Trainer'
            };
        }
        return { name: 'Unknown QR Code', initials: '?', imageUrl: null, type: 'Unknown' };
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">QR Scanner Attendance</h2>
                <div className="flex items-center gap-2 bg-surfaceHighlight px-4 py-2 rounded-full border border-white/10">
                    <span className={`w-2.5 h-2.5 rounded-full ${status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="text-sm font-bold text-text-secondary">Scanner {status}</span>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* QR Scanner Panel */}
                <div className="bg-surface rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center sticky top-4 shadow-sm">
                    <div className={`relative mb-6 ${scanning ? 'animate-pulse' : ''}`}>
                        <div className="w-48 h-48 bg-white/5 rounded-3xl flex items-center justify-center border-2 border-dashed border-white/20 relative overflow-hidden">
                            {scanning && (
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent animate-scan"></div>
                            )}
                            <span className="material-icons-round text-7xl text-text-muted">qr_code_scanner</span>
                        </div>
                        {/* Scanner corners */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl"></div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">QR Code Scanner</h3>
                    <p className="text-text-muted text-center mb-8 max-w-xs text-sm">Use the button below to simulate an access QR code being scanned at the entrance.</p>

                    <div className="flex gap-4 w-full">
                        <button
                            onClick={() => simulateScan(null)}
                            disabled={scanning}
                            className="flex-1 bg-primary hover:bg-orange-600 disabled:bg-primary/50 text-white px-6 py-4 rounded-2xl flex flex-col items-center transition-transform active:scale-95 shadow-lg shadow-primary/20 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons-round text-3xl mb-1">
                                {scanning ? 'sync' : 'qr_code_2'}
                            </span>
                            <span className="font-bold">{scanning ? 'Scanning...' : 'Simulate QR Scan'}</span>
                        </button>
                    </div>

                    <div className="flex gap-4 mt-6 pt-6 border-t border-white/5 w-full justify-center">
                        <button
                            onClick={() => simulateScan('ALLOWED')}
                            disabled={scanning}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Force Allow
                        </button>
                        <button
                            onClick={() => simulateScan('DENIED')}
                            disabled={scanning}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Force Deny
                        </button>
                    </div>
                </div>

                {/* Logs */}
                <div className="bg-surface rounded-3xl border border-white/5 p-6 overflow-hidden flex flex-col h-[calc(100vh-10rem)] shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Live Access Feed</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                        {logs.map((log, i) => {
                            const entity = getEntity(log);
                            return (
                            <div
                                key={i}
                                onClick={() => handleLogClick(log.id)}
                                className={`p-4 rounded-xl border-l-4 flex justify-between items-center bg-white/5 hover:bg-white/10 border hover:shadow-sm transition-all cursor-pointer ${log.status === 'ALLOWED'
                                    ? 'border-l-emerald-500 border-white/5'
                                    : 'border-l-red-500 border-white/5'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {entity.imageUrl ? (
                                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                            <img src={entity.imageUrl} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    ) : (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${log.status === 'ALLOWED'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-red-500/10 text-red-400'
                                            }`}>
                                            {entity.initials}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-white font-bold text-sm">
                                            {entity.name}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'ALLOWED' ? 'bg-emerald-500' : 'bg-red-500'
                                                }`}></span>
                                            <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">
                                                Entrance - {entity.type} - {log.status}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-text-muted font-mono font-medium">
                                        {new Date(log.checkIn).toLocaleTimeString()}
                                    </span>
                                    <span className="material-icons-round text-text-muted text-sm">chevron_right</span>
                                </div>
                            </div>
                            );
                        })}
                        {logs.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted">
                                <span className="material-icons-round text-4xl mb-2">history</span>
                                <p>No scans yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
                .animate-scan {
                    animation: scan 0.8s ease-in-out;
                }
            `}</style>
        </div>
    );
}

