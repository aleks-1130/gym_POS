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

    useEffect(() => {
        if (!user || user.role === ROLES.MEMBER) return;

        const checkLatestScan = async () => {
            try {
                // FIXED: Added Auth Token
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

    const simulateScan = async () => {
        setScanning(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/access/simulate', { status: 'ALLOWED' }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Immediate update (don't wait for poll)
            setTimeout(() => {
                setLatestLogId(res.data.id);
                lastScanId.current = res.data.id;
                setScanning(false);
                // Update history locally to be snappy
                setHistory(prev => [res.data, ...prev].slice(0, 10));
            }, 1000); // Consistent animation duration

        } catch (err) {
            console.error("Simulation failed", err);
            setScanning(false);
        }
    };

    if (user.role === ROLES.MEMBER) {
        return <Attendance />;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-screen pb-10 animate-fade-in relative">

            {/* LEFT SIDE: SCANNER & ACTIVE PROFILE */}
            <div className="flex-1 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Access Control Hub</h1>
                        <p className="text-text-muted font-medium text-lg">Entrance Point: Main Gate</p>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* 2nd Screen Link */}
                        <a
                            href="/display-monitor"
                            target="_blank"
                            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-5 py-2.5 rounded-2xl border border-primary/20 transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/10"
                        >
                            <span className="material-icons-round text-lg">desktop_windows</span>
                            Open 2nd Screen
                        </a>

                        <div className="flex items-center gap-2 bg-surfaceHighlight px-4 py-2 rounded-2xl border border-white/5 shadow-lg">
                            <span className={`w-2.5 h-2.5 rounded-full ${status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Scanner {status}</span>
                        </div>
                    </div>
                </div>

                {/* Compact Scanner Box (Always visible) */}
                <div className="bg-surface rounded-[2.5rem] border border-white/5 p-6 relative overflow-hidden group shadow-2xl">
                    <div className="flex items-center gap-8 relative z-10">
                        {/* QR Scanner Box */}
                        <div className={`relative flex-shrink-0`}>
                            <div className="w-32 h-32 bg-white/5 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-white/20 relative overflow-hidden backdrop-blur-md">
                                {scanning && (
                                    <div className="absolute inset-0 bg-gradient-to-b from-primary/30 to-transparent animate-scan z-10"></div>
                                )}
                                <span className={`material-icons-round text-5xl ${scanning ? 'text-primary' : 'text-text-muted/40'} transition-all duration-500`}>
                                    qr_code_scanner
                                </span>
                                {scanning && (
                                    <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_15px_rgba(249,115,22,0.8)] z-20 animate-scan-line"></div>
                                )}
                            </div>
                        </div>

                        {/* Scanner Actions */}
                        <div className="flex-1 space-y-4">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Scanner Online</h3>
                                <p className="text-text-muted text-sm font-medium">Ready for member entry verification.</p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={simulateScan}
                                    disabled={scanning}
                                    className="px-6 py-2.5 bg-primary hover:bg-orange-600 disabled:bg-primary/50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-primary/20 flex items-center gap-2 group"
                                >
                                    <span className={`material-icons-round text-lg ${scanning ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`}>sync</span>
                                    {scanning ? 'Verifying...' : 'Test Scan'}
                                </button>
                                <button
                                    onClick={() => setLatestLogId(null)}
                                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-xs uppercase tracking-widest border border-white/5 transition-all"
                                >
                                    Clear Result
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Result View */}
                <div className="relative min-h-[400px]">
                    <ProfileResult
                        logId={latestLogId}
                        showHistory={false}
                        showToolbar={true}
                        compact={false}
                    />
                </div>
            </div>

            {/* RIGHT SIDE: LIVE FEED */}
            <div className="lg:w-[400px] flex flex-col h-full sticky top-8">
                <div className="bg-surface rounded-[2.5rem] border border-white/5 flex flex-col flex-1 overflow-hidden shadow-2xl h-[calc(100vh-100px)]">
                    <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                                <span className="material-icons-round text-primary text-2xl">sensors</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">Live Feed</h2>
                                <p className="text-[10px] text-text-muted uppercase font-black tracking-widest">Entry History</p>
                            </div>
                        </div>
                        <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                            Active
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
                        {history.map((log) => (
                            <button
                                key={log.id}
                                onClick={() => setLatestLogId(log.id)}
                                className={`w-full flex items-center gap-4 p-5 rounded-[2rem] border transition-all text-left group ${latestLogId === log.id
                                    ? 'bg-primary/10 border-primary/30 shadow-2xl'
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                    }`}
                            >
                                <div className="relative flex-shrink-0">
                                    {log.member?.imageUrl ? (
                                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10">
                                            <img src={log.member.imageUrl} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-2xl bg-surfaceHighlight flex items-center justify-center border border-white/10">
                                            <span className="text-xl font-black text-text-muted">
                                                {log.member?.firstName?.[0]}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-surface ${log.status === 'ALLOWED' ? 'bg-emerald-500' : 'bg-red-500'
                                        }`}>
                                        <span className="material-icons-round text-white text-xs">
                                            {log.status === 'ALLOWED' ? 'check' : 'close'}
                                        </span>
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h4 className="text-white font-black text-base truncate">
                                        {log.member ? `${log.member.firstName} ${log.member.lastName}` : 'Guest User'}
                                    </h4>
                                    <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest mt-0.5">
                                        {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.member?.membershipType || 'Standard'}
                                    </p>
                                </div>

                                <span className="material-icons-round text-text-muted/40 group-hover:text-primary transition-all group-hover:translate-x-1">
                                    chevron_right
                                </span>
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
                @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
