import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function DisplayMonitor() {
    const [latestEvent, setLatestEvent] = useState(null);
    const lastScanId = useRef(null);
    const clearTimerRef = useRef(null);

    useEffect(() => {
        const checkLatestScan = async () => {
            try {
                const res = await axios.get('/api/access/latest-event');

                if (res.data) {
                    const latest = res.data;

                    if (lastScanId.current !== latest.id) {
                        lastScanId.current = latest.id;
                        setLatestEvent(latest);

                        // Reset the 5-second auto-clear timer
                        if (clearTimerRef.current) {
                            clearTimeout(clearTimerRef.current);
                        }

                        clearTimerRef.current = setTimeout(() => {
                            setLatestEvent(null);
                        }, 5000);
                    }
                }
            } catch (err) {
                console.error("Monitor sync error", err);
            }
        };

        const interval = setInterval(checkLatestScan, 1000);
        return () => {
            clearInterval(interval);
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        };
    }, []);

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getStatusColor = (status) => {
        switch(status?.toLowerCase()) {
            case 'allowed': return 'text-green-400';
            case 'denied': return 'text-red-400';
            case 'expired': return 'text-orange-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusBg = (status) => {
        switch(status?.toLowerCase()) {
            case 'allowed': return 'bg-green-500/10 border-green-500/30';
            case 'denied': return 'bg-red-500/10 border-red-500/30';
            case 'expired': return 'bg-orange-500/10 border-orange-500/30';
            default: return 'bg-gray-500/10 border-gray-500/30';
        }
    };

    const getStatusIcon = (status) => {
        switch(status?.toLowerCase()) {
            case 'allowed': return 'check_circle';
            case 'denied': return 'cancel';
            case 'expired': return 'schedule';
            default: return 'help';
        }
    };

    const latestLog = latestEvent?.log || null;
    const isErrorEvent = latestEvent?.type === 'ERROR';
    const joinedDate = latestLog?.member?.startDate || latestLog?.member?.createdAt || latestLog?.member?.joinDate || latestLog?.member?.joinedDate;
    const scannedEntity = latestLog?.member
        ? {
            kind: 'Member',
            name: `${latestLog.member.firstName} ${latestLog.member.lastName}`,
            id: latestLog.member.id,
            imageUrl: latestLog.member.imageUrl,
            initials: getInitials(`${latestLog.member.firstName} ${latestLog.member.lastName}`),
            primary: latestLog.member.membershipType || 'Standard',
            secondary: joinedDate ? new Date(joinedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
            tertiary: latestLog.member.expiryDate ? new Date(latestLog.member.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'
        }
        : latestLog?.trainer
            ? {
                kind: 'Trainer',
                name: latestLog.trainer.name || `Trainer #${latestLog.trainer.id}`,
                id: latestLog.trainer.id,
                imageUrl: latestLog.trainer.imageUrl,
                initials: getInitials(latestLog.trainer.name || 'Trainer'),
                primary: latestLog.trainer.specialty || 'Trainer',
                secondary: latestLog.trainer.email || 'N/A',
                tertiary: 'Trainer Access'
            }
            : null;

    return (
        <div className="bg-background min-h-screen w-full flex items-center justify-center p-0 m-0 overflow-hidden">
            {/* Background Graphic */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute -top-1/2 -left-1/3 w-full h-full bg-primary/10 rounded-full blur-[140px]"></div>
                <div className="absolute -bottom-1/2 -right-1/3 w-full h-full bg-primary/5 rounded-full blur-[140px]"></div>
            </div>

            {/* Top Bar */}
            <div className="absolute top-10 left-10 right-10 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3">
                        <span className="material-icons-round text-white text-3xl">fitness_center</span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">FitOS</h1>
                        <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Access Monitor</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-white font-black text-5xl italic tracking-tighter leading-none">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </div>

            <div className="w-full max-w-[90rem] relative z-10 px-4">
                {latestEvent && (scannedEntity || isErrorEvent) ? (
                    <div className="animate-pop">
                        {isErrorEvent ? (
                            <div className="bg-white/5 backdrop-blur-xl rounded-[4rem] p-16 border-2 border-red-500/30 shadow-[0_0_80px_rgba(80,0,0,0.5)] text-center">
                                <div className="w-48 h-48 bg-red-500/15 rounded-[3rem] border-4 border-red-500/30 flex items-center justify-center mx-auto mb-10">
                                    <span className="material-icons-round text-[120px] text-red-400">block</span>
                                </div>
                                <p className="text-red-300 text-lg font-black uppercase tracking-[0.4em] mb-4">Scan Denied</p>
                                <h2 className="text-5xl font-black text-white italic tracking-tight leading-tight mb-6">
                                    {latestEvent?.reason || 'Invalid or expired QR'}
                                </h2>
                                <p className="text-text-muted text-xl font-bold uppercase tracking-[0.3em]">
                                    Please use the latest dynamic QR
                                </p>
                            </div>
                        ) : (
                        <>
                        {/* Giant Member Card */}
                        <div className="bg-white/5 backdrop-blur-xl rounded-[4rem] p-16 border-2 border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
                            {/* Massive Member Header */}
                            <div className="flex items-center gap-12 mb-14">
                                {scannedEntity.imageUrl ? (
                                    <div className="w-56 h-56 rounded-[3rem] overflow-hidden shadow-2xl flex-shrink-0 border-4 border-white/20 ring-4 ring-primary/20">
                                        <img src={scannedEntity.imageUrl} className="w-full h-full object-cover" alt="" />
                                    </div>
                                ) : (
                                    <div className="w-56 h-56 bg-gradient-to-br from-primary to-orange-600 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-primary/40 flex-shrink-0 ring-4 ring-primary/30">
                                        <span className="text-9xl font-black text-white drop-shadow-2xl">
                                            {scannedEntity.initials}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-text-muted text-lg font-black uppercase tracking-[0.4em] mb-4 drop-shadow">{scannedEntity.kind}</div>
                                    <h2 className="text-8xl font-black text-white italic tracking-tighter leading-none mb-6 drop-shadow-2xl">
                                        {scannedEntity.name}
                                    </h2>
                                    <div className="inline-flex items-center gap-3 bg-white/10 px-6 py-3 rounded-2xl border border-white/20">
                                        <span className="material-icons-round text-primary text-2xl">badge</span>
                                        <span className="text-white text-2xl font-black">ID: {scannedEntity.id}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Large Member Details Grid */}
                            <div className="grid grid-cols-3 gap-8 mb-10">
                                {/* Membership Plan */}
                                <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-10 border-2 border-white/20 shadow-xl">
                                    <div className="flex items-center gap-3 mb-5">
                                        <span className="material-icons-round text-primary text-4xl">workspace_premium</span>
                                        <div className="text-text-muted text-sm font-black uppercase tracking-[0.3em]">
                                            {scannedEntity.kind === 'Member' ? 'Plan' : 'Specialty'}
                                        </div>
                                    </div>
                                    <div className="text-white text-5xl font-black italic tracking-tight leading-tight">
                                        {scannedEntity.primary}
                                    </div>
                                </div>

                                {/* Joined Date */}
                                <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-10 border-2 border-white/20 shadow-xl">
                                    <div className="flex items-center gap-3 mb-5">
                                        <span className="material-icons-round text-emerald-400 text-4xl">event_available</span>
                                        <div className="text-text-muted text-sm font-black uppercase tracking-[0.3em]">
                                            {scannedEntity.kind === 'Member' ? 'Joined' : 'Contact'}
                                        </div>
                                    </div>
                                    <div className="text-white text-5xl font-black italic tracking-tight leading-tight">
                                        {scannedEntity.secondary}
                                    </div>
                                </div>

                                {/* Expiry Date */}
                                <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-10 border-2 border-white/20 shadow-xl">
                                    <div className="flex items-center gap-3 mb-5">
                                        <span className="material-icons-round text-orange-400 text-4xl">schedule</span>
                                        <div className="text-text-muted text-sm font-black uppercase tracking-[0.3em]">
                                            {scannedEntity.kind === 'Member' ? 'Expires' : 'Access'}
                                        </div>
                                    </div>
                                    <div className="text-white text-5xl font-black italic tracking-tight leading-tight">
                                        {scannedEntity.tertiary}
                                    </div>
                                </div>
                            </div>

                            {/* Scan Timestamp - Bigger */}
                            <div className="text-center pt-8 border-t-2 border-white/10">
                                <div className="inline-flex items-center gap-3 bg-white/5 px-8 py-4 rounded-2xl border border-white/10">
                                    <span className="material-icons-round text-text-muted text-2xl">access_time</span>
                                    <div className="text-text-muted text-xl font-bold uppercase tracking-[0.3em]">
                                        Scanned at {new Date(latestEvent?.checkIn || latestLog.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </>
                        )}
                    </div>
                ) : (
                    <div className="text-center animate-fade-in pointer-events-none select-none">
                        <div className="w-80 h-80 bg-white/5 rounded-[4rem] flex items-center justify-center mx-auto mb-14 border-8 border-dashed border-white/10 animate-pulse-slow relative shadow-2xl">
                            <span className="material-icons-round text-[160px] text-text-muted/10">qr_code_scanner</span>
                            <div className="absolute inset-6 border-4 border-primary/20 rounded-[3rem] animate-pulse-slow"></div>
                            <div className="absolute inset-12 border-2 border-primary/10 rounded-[2rem] animate-pulse-slow animation-delay-150"></div>
                        </div>
                        <h2 className="text-9xl font-black text-white/10 uppercase tracking-tighter italic leading-none mb-6 drop-shadow-2xl">Ready to Scan</h2>
                        <p className="text-text-muted/40 text-4xl font-bold uppercase tracking-[0.4em]">Awaiting Scan</p>
                        
                        {/* Decorative accent */}
                        <div className="mt-12 flex items-center justify-center gap-4">
                            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-full"></div>
                            <span className="material-icons-round text-primary/20 text-3xl">sensors</span>
                            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-full"></div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes pop {
                    0% { transform: scale(0.85); opacity: 0; filter: blur(20px); }
                    100% { transform: scale(1); opacity: 1; filter: blur(0); }
                }
                .animate-pop {
                    animation: pop 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                .animation-delay-150 {
                    animation-delay: 150ms;
                }
            `}</style>
        </div>
    );
}
