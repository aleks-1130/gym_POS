import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProfileResult from '../../components/ProfileResult';

export default function DisplayMonitor() {
    const [latestLogId, setLatestLogId] = useState(null);
    const lastScanId = useRef(null);
    const clearTimerRef = useRef(null);

    useEffect(() => {
        const checkLatestScan = async () => {
            try {
                // IMPORTANT: The monitor needs the staff token to access logs
                const token = localStorage.getItem('token');
                if (!token) {
                    console.error("Monitor Error: No authentication token found. Please log in on this browser as STAFF first.");
                    return;
                }

                // Call directly to avoid issues with axios default header timing
                const res = await axios.get('http://localhost:5000/api/access/logs', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data && res.data.length > 0) {
                    const latest = res.data[0];

                    if (lastScanId.current !== latest.id) {
                        lastScanId.current = latest.id;
                        setLatestLogId(latest.id);

                        // Reset the 5-second auto-clear timer
                        if (clearTimerRef.current) {
                            clearTimeout(clearTimerRef.current);
                        }

                        clearTimerRef.current = setTimeout(() => {
                            setLatestLogId(null);
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

    return (
        <div className="bg-background min-h-screen w-full flex items-center justify-center p-0 m-0 overflow-hidden">
            {/* Background Graphic */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-primary/5 rounded-full blur-[120px]"></div>
            </div>

            {/* Header / Brand Overlay */}
            <div className="absolute top-12 left-12 flex items-center gap-4 z-20">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3">
                    <span className="material-icons-round text-white text-3xl">fitness_center</span>
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">FitOS</h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Live Monitor</p>
                </div>
            </div>

            {/* Time Overlay */}
            <div className="absolute top-12 right-12 text-right z-20">
                <div className="text-white font-black text-5xl italic tracking-tighter leading-none">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="w-full max-w-6xl relative z-10 px-8">
                {latestLogId ? (
                    <div className="animate-pop">
                        <ProfileResult
                            logId={latestLogId}
                            showHistory={false}
                            showToolbar={false}
                            fullScreen={false}
                            compact={false}
                        />
                    </div>
                ) : (
                    <div className="text-center animate-fade-in pointer-events-none select-none">
                        <div className="w-64 h-64 bg-white/5 rounded-[3rem] flex items-center justify-center mx-auto mb-12 border-4 border-dashed border-white/10 animate-pulse relative">
                            <span className="material-icons-round text-[120px] text-text-muted/10">qr_code_scanner</span>
                            <div className="absolute inset-4 border-2 border-primary/20 rounded-[2rem] animate-pulse"></div>
                        </div>
                        <h2 className="text-8xl font-black text-white/10 uppercase tracking-tighter italic leading-none">Welcome Member</h2>
                        <p className="text-text-muted/30 text-3xl font-bold mt-6 uppercase tracking-[0.4em]">Ready for Verification</p>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes pop {
                    0% { transform: scale(0.9); opacity: 0; filter: blur(10px); }
                    100% { transform: scale(1); opacity: 1; filter: blur(0); }
                }
                .animate-pop {
                    animation: pop 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 1s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
            `}</style>
        </div>
    );
}
