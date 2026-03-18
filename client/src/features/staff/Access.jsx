import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    const [scanError, setScanError] = useState('');

    const getEntity = (log) => {
        if (log?.member) {
            return {
                type: 'Member',
                name: `${log.member.firstName} ${log.member.lastName}`,
                subtitle: log.member?.membershipType || 'Member',
                initials: `${log.member?.firstName?.[0] || ''}${log.member?.lastName?.[0] || ''}` || 'M',
                imageUrl: log.member?.imageUrl
            };
        }
        if (log?.trainer) {
            return {
                type: 'Trainer',
                name: log.trainer.name || `Trainer #${log.trainer.id}`,
                subtitle: log.trainer.specialty || 'Trainer',
                initials: (log.trainer?.name || 'T').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
                imageUrl: log.trainer?.imageUrl
            };
        }
        return {
            type: 'Unknown',
            name: 'Unknown QR',
            subtitle: 'Unrecognized',
            initials: '?',
            imageUrl: null
        };
    };

    const isFreezeBlockedLog = (log) => {
        const member = log?.member;
        if (!member) return false;

        const normalizedStatus = String(member.status || '').toUpperCase();
        if (normalizedStatus === 'FREEZED' || normalizedStatus === 'FROZEN') return true;

        const freezeStart = member.freezeStartDate ? new Date(member.freezeStartDate) : null;
        const freezeEnd = member.freezeEndDate ? new Date(member.freezeEndDate) : null;
        const checkInAt = log?.checkIn ? new Date(log.checkIn) : new Date();

        return Boolean(
            freezeStart &&
            freezeEnd &&
            !Number.isNaN(freezeStart.getTime()) &&
            !Number.isNaN(freezeEnd.getTime()) &&
            !Number.isNaN(checkInAt.getTime()) &&
            checkInAt >= freezeStart &&
            checkInAt <= freezeEnd
        );
    };

    useEffect(() => {
        if (!user || user.role === ROLES.MEMBER) return;

        const checkLatestScan = async () => {
            try {
                
                const res = await axios.get('/api/access/logs');

                if (res.data && res.data.length > 0) {
                    const latest = res.data[0];
                    setHistory(res.data.slice(0, 10));

                    if (lastScanId.current === null) {
                        lastScanId.current = latest.id;
                    } else if (latest.id !== lastScanId.current) {
                        lastScanId.current = latest.id;
                        setScanError('');
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
            
            const res = await axios.post('/api/access/simulate', { status: 'ALLOWED' });

            setTimeout(() => {
                setScanError('');
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
        const accessTokenMatch = raw.match(/^access\s*:\s*(.+)$/i);
        if (accessTokenMatch?.[1]) {
            setScanning(true);
            try {
                
                const res = await axios.post(
                    '/api/access/checkin',
                    { qrToken: accessTokenMatch[1].trim() });

                if (res.data?.id) {
                    setScanError('');
                    lastScanId.current = res.data.id;
                    setLatestLogId(res.data.id);
                    setHistory((prev) => [res.data, ...prev].slice(0, 10));
                }
            } catch (err) {
                console.error('Token scan failed', err);
                setScanError(
                    err?.response?.data?.error
                    || err?.response?.data?.reason
                    || 'Access denied. QR is invalid or expired.'
                );
                setLatestLogId(null);
            } finally {
                setScanning(false);
            }
            return;
        }

        const memberMatch = raw.match(/member\s*:\s*(\d+)/i);
        const trainerMatch = raw.match(/trainer\s*:\s*(\d+)/i);
        const genericMatch = raw.match(/(\d+)/);
        if (!memberMatch && !trainerMatch && !genericMatch) {
            console.warn('Invalid QR payload:', raw);
            return;
        }

        const payload = trainerMatch
            ? { trainerId: Number(trainerMatch[1]) }
            : { memberId: Number((memberMatch || genericMatch)[1]) };
        if ((!payload.memberId && !payload.trainerId) || payload.memberId === 0 || payload.trainerId === 0) return;

        setScanning(true);
        try {
            
            const res = await axios.post(
                '/api/access/checkin',
                payload);

            if (res.data?.id) {
                setScanError('');
                lastScanId.current = res.data.id;
                setLatestLogId(res.data.id);
                setHistory((prev) => [res.data, ...prev].slice(0, 10));
            }
        } catch (err) {
            console.error('Scan failed', err);
            setScanError(
                err?.response?.data?.error
                || err?.response?.data?.reason
                || 'Access denied.'
            );
            setLatestLogId(null);
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

    const accessStats = useMemo(() => {
        const total = history.length;
        const allowed = history.filter((log) => String(log?.status || '').toUpperCase() === 'ALLOWED').length;
        const denied = total - allowed;
        const freezed = history.filter((log) => String(log?.status || '').toUpperCase() !== 'ALLOWED' && isFreezeBlockedLog(log)).length;
        return { total, allowed, denied, freezed };
    }, [history]);

    const latestFreezedLog = useMemo(
        () => history.find((log) => String(log?.status || '').toUpperCase() !== 'ALLOWED' && isFreezeBlockedLog(log)) || null,
        [history]
    );

    if (user?.role === ROLES.MEMBER) {
        return <Attendance />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Access Control</h1>
                    <p className="text-text-muted mt-1">Monitor scans and verify member or trainer access</p>
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

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-text-muted">Scans (Recent)</p>
                    <p className="mt-1 text-base font-bold text-white">{accessStats.total}</p>
                    <p className="text-[10px] text-text-muted">Latest 10 logs</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-300">Allowed</p>
                    <p className="mt-1 text-base font-bold text-emerald-300">{accessStats.allowed}</p>
                    <p className="text-[10px] text-emerald-300/80">Successful access</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-red-300">Denied</p>
                    <p className="mt-1 text-base font-bold text-red-300">{accessStats.denied}</p>
                    <p className="text-[10px] text-red-300/80">Blocked scans</p>
                </div>
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-blue-300">Freezed Monitor</p>
                    <p className="mt-1 text-base font-bold text-blue-300">{accessStats.freezed}</p>
                    <p className="text-[10px] text-blue-300/80">Denied while frozen</p>
                </div>
            </section>

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
                                    <p className="text-sm text-text-muted">Scan the latest dynamic QR from member/trainer app.</p>
                                </div>

                                <form onSubmit={handleManualScan} className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        value={scanInput}
                                        onChange={(e) => setScanInput(e.target.value)}
                                        placeholder="ACCESS:<dynamic-token>"
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
                                    {scanError && (
                                        <button
                                            onClick={() => setScanError('')}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl font-bold text-xs uppercase tracking-widest border border-red-500/20 transition-all"
                                        >
                                            Clear Error
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative min-h-[420px]">
                        {scanError ? (
                            <div className="bg-surface rounded-3xl border border-red-500/30 p-8 h-[calc(100vh-390px)] flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-4">
                                    <span className="material-icons-round text-red-400 text-3xl">block</span>
                                </div>
                                <h3 className="text-2xl font-bold text-red-300 mb-2">Scan Denied</h3>
                                <p className="text-text-secondary text-sm max-w-md">{scanError}</p>
                                <p className="text-text-muted text-xs mt-3 uppercase tracking-widest">Use latest dynamic QR and rescan</p>
                            </div>
                        ) : (
                            <ProfileResult
                                logId={latestLogId}
                                showHistory={false}
                                showToolbar={true}
                                compact={false}
                            />
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-blue-300">ac_unit</span>
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Freezed Membership Monitor</p>
                        </div>
                        {latestFreezedLog ? (
                            <div className="mt-3 rounded-xl border border-blue-400/20 bg-background/40 p-3">
                                <p className="text-sm font-semibold text-white truncate">
                                    {latestFreezedLog.member?.firstName} {latestFreezedLog.member?.lastName}
                                </p>
                                <p className="mt-1 text-[11px] text-blue-200">
                                    Last blocked at {new Date(latestFreezedLog.checkIn).toLocaleString()}
                                </p>
                            </div>
                        ) : (
                            <p className="mt-3 text-xs text-blue-200/80">No recent blocked scans due to freezed status.</p>
                        )}
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

                        <div className="max-h-[calc(100vh-360px)] overflow-y-auto p-4 space-y-3">
                            {history.map((log) => {
                                const entity = getEntity(log);
                                const isFreezeBlocked = String(log.status || '').toUpperCase() !== 'ALLOWED' && isFreezeBlockedLog(log);
                                return (
                                    <button
                                        key={log.id}
                                        onClick={() => setLatestLogId(log.id)}
                                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${latestLogId === log.id
                                            ? 'bg-primary/10 border-primary/30 shadow-lg'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            {entity.imageUrl ? (
                                                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10">
                                                    <img src={entity.imageUrl} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded-2xl bg-surfaceHighlight flex items-center justify-center border border-white/10">
                                                    <span className="text-lg font-bold text-text-muted">
                                                        {entity.initials}
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
                                                {entity.name}
                                            </h4>
                                            <p className="text-text-secondary text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                                {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {entity.type} - {entity.subtitle}
                                            </p>
                                            {isFreezeBlocked && (
                                                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">Freezed Membership</p>
                                            )}
                                        </div>

                                        <span className="material-icons-round text-text-muted/40">chevron_right</span>
                                    </button>
                                );
                            })}
                        </div>
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

