import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import Attendance from '../member/Attendance';
import ProfileResult from '../../components/ProfileResult';
import axios from 'axios';

export default function Access() {
    const { user } = useAuth();
    const [latestLogId, setLatestLogId] = useState(null);
    const [status, setStatus] = useState('ONLINE');
    const [scanning, setScanning] = useState(false);
    const lastScanId = useRef(null);
    const [history, setHistory] = useState([]);
    const scanBufferRef = useRef('');
    const scanTimerRef = useRef(null);
    const [scanInput, setScanInput] = useState('');

    useEffect(() => {
        if (!user || user.role === ROLES.MEMBER) return;

        const checkLatestScan = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/access/logs', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data && res.data.length > 0) {
                    const latest = res.data[0];
                    setHistory(res.data.slice(0, 10));

                    if (lastScanId.current === null) {
                        lastScanId.current = latest.id;
                    } else if (latest.id !== lastScanId.current) {
                        lastScanId.current = latest.id;
                        setScanning(true);
                        setTimeout(() => {
                            setLatestLogId(latest.id);
                            setScanning(false);
                        }, 800);
                    }
                }
            } catch (err) {
                console.error("Scanner sync error", err);
                setStatus('OFFLINE');
            }
        };

        const interval = setInterval(checkLatestScan, 2000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        if (!user || user.role === ROLES.MEMBER) return;

        const handleKeyDown = (e) => {
            const target = e.target;
            const isTyping =
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.isContentEditable;
            if (isTyping) return;

            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);

            if (e.key === 'Enter') {
                const raw = scanBufferRef.current.trim();
                scanBufferRef.current = '';
                if (raw) processScan(raw);
                return;
            }

            if (e.key.length === 1) {
                scanBufferRef.current += e.key;
                scanTimerRef.current = setTimeout(() => {
                    const raw = scanBufferRef.current.trim();
                    scanBufferRef.current = '';
                    if (raw) processScan(raw);
                }, 300);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        };
    }, [user]);

    const simulateScan = async () => {
        setScanning(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/access/simulate', { status: 'ALLOWED' }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setTimeout(() => {
                setLatestLogId(res.data.id);
                lastScanId.current = res.data.id;
                setScanning(false);
                setHistory(prev => [res.data, ...prev].slice(0, 10));
            }, 800);

        } catch (err) {
            console.error("Simulation failed", err);
            setScanning(false);
        }
    };

    const processScan = async (raw) => {
        const match = raw.match(/member\s*:\s*(\d+)/i) || raw.match(/(\d+)/);
        if (!match) {
            console.warn('Invalid QR payload:', raw);
            return;
        }

        const memberId = Number(match[1]);
        if (!memberId) return;

        setScanning(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(
                'http://localhost:5000/api/access/checkin',
                { memberId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data?.id) {
                lastScanId.current = res.data.id;
                setLatestLogId(res.data.id);
                setHistory((prev) => [res.data, ...prev].slice(0, 10));
            }
        } catch (err) {
            console.error('Scan failed', err);
        } finally {
            setScanning(false);
        }
    };

    const handleManualScan = async (e) => {
        e.preventDefault();
        if (!scanInput.trim()) return;
        await processScan(scanInput.trim());
        setScanInput('');
    };

    if (user?.role === ROLES.MEMBER) {
        return <Attendance />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Access Control</h1>
                    <p className="text-text-muted mt-1">Monitor scans and verify member access</p>
                </div>
                <div className="flex items-center gap-3">
                    <a
                        href="/display-monitor"
                        target="_blank"
                        className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl border border-primary/20 transition-all text-xs font-bold uppercase tracking-wider"
                    >
                        <span className="material-icons-round text-lg">desktop_windows</span>
                        Display Monitor
                    </a>
                    <div className="flex items-center gap-2 bg-surfaceHighlight px-3 py-2 rounded-xl border border-white/10">
                        <span className={`w-2.5 h-2.5 rounded-full ${status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className="text-xs font-bold text-text-secondary">Scanner {status}</span>
                    </div>
                </div>
            </header>

            <div className="grid lg:grid-cols-[1.4fr_0.6fr] gap-6">
                {/* Scanner + Result */}
                <div className="space-y-6">
                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                        <div className="flex flex-col lg:flex-row items-center gap-6">
                            <div className="w-32 h-32 bg-surfaceHighlight rounded-2xl border border-white/10 flex items-center justify-center relative overflow-hidden">
                                {scanning && (
                                    <div className="absolute inset-0 bg-gradient-to-b from-primary/25 to-transparent animate-scan"></div>
                                )}
                                <span className={`material-icons-round text-5xl ${scanning ? 'text-primary' : 'text-text-muted/40'}`}>
                                    qr_code_scanner
                                </span>
                                {scanning && (
                                    <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_12px_rgba(249,115,22,0.8)] animate-scan-line"></div>
                                )}
                            </div>

                            <div className="flex-1 space-y-4 w-full">
                                <div>
                                    <h3 className="text-xl font-bold text-white">Scanner Ready</h3>
                                    <p className="text-sm text-text-muted">Scan a member QR or type the code to verify access.</p>
                                </div>

                                <form onSubmit={handleManualScan} className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        value={scanInput}
                                        onChange={(e) => setScanInput(e.target.value)}
                                        placeholder="Member: 40"
                                        className="flex-1 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    />
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 bg-primary hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all"
                                    >
                                        Verify
                                    </button>
                                </form>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={simulateScan}
                                        disabled={scanning}
                                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 disabled:bg-primary/5 text-primary rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-primary/20"
                                    >
                                        Test Scan
                                    </button>
                                    <button
                                        onClick={() => setLatestLogId(null)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest border border-white/5 transition-all"
                                    >
                                        Clear Result
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative min-h-[420px]">
                        <ProfileResult
                            logId={latestLogId}
                            showHistory={false}
                            showToolbar={true}
                            compact={false}
                        />
                    </div>
                </div>

                {/* Live Feed */}
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <span className="material-icons-round text-primary text-xl">sensors</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Live Feed</h2>
                                <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Entry History</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                            Active
                        </span>
                    </div>

                    <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-4 space-y-3">
                        {history.map((log) => (
                            <button
                                key={log.id}
                                onClick={() => setLatestLogId(log.id)}
                                className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${latestLogId === log.id
                                    ? 'bg-primary/10 border-primary/30 shadow-lg'
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                    }`}
                            >
                                <div className="relative flex-shrink-0">
                                    {log.member?.imageUrl ? (
                                        <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10">
                                            <img src={log.member.imageUrl} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-2xl bg-surfaceHighlight flex items-center justify-center border border-white/10">
                                            <span className="text-lg font-bold text-text-muted">
                                                {log.member?.firstName?.[0]}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-surface ${log.status === 'ALLOWED' ? 'bg-emerald-500' : 'bg-red-500'
                                        }`}>
                                        <span className="material-icons-round text-white text-[10px]">
                                            {log.status === 'ALLOWED' ? 'check' : 'close'}
                                        </span>
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h4 className="text-white font-bold text-sm truncate">
                                        {log.member ? `${log.member.firstName} ${log.member.lastName}` : 'Guest User'}
                                    </h4>
                                    <p className="text-text-secondary text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                        {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.member?.membershipType || 'Standard'}
                                    </p>
                                </div>

                                <span className="material-icons-round text-text-muted/40">chevron_right</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
                @keyframes scan-line { 0% { top: 0; } 100% { top: 100%; } }
                .animate-scan { animation: scan 2s infinite ease-in-out; }
                .animate-scan-line { animation: scan-line 2s infinite ease-in-out; }
            `}</style>
        </div>
    );
}
