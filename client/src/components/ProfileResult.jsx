import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ProfileResult({
    logId: propLogId,
    showHistory = true,
    showToolbar = true,
    onScanUpdate,
    compact = false,
    fullScreen = false
}) {
    const { logId: paramLogId } = useParams();
    const logId = propLogId || paramLogId;
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (logId) {
            fetchLogDetails();
        } else {
            setLog(null);
            setLoading(false);
        }
        if (showHistory) fetchRecentLogs();
    }, [logId]);

    const fetchRecentLogs = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/access/logs');
            const data = res.data.slice(0, 10);
            setLogs(data);
            if (onScanUpdate) onScanUpdate(data);
        } catch (err) {
            console.error("Failed to fetch history", err);
        }
    };

    const fetchLogDetails = async () => {
        setLoading(true);
        setError(null);

        if (logId === 'dummy') {
            await new Promise(resolve => setTimeout(resolve, 800));
            setLog({
                id: 'dummy',
                status: 'ALLOWED',
                checkIn: new Date().toISOString(),
                member: {
                    id: 999,
                    firstName: 'Bruce',
                    lastName: 'Wayne',
                    email: 'bruce@wayne.com',
                    phone: '+1 555-BATMAN',
                    imageUrl: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&q=80&w=300',
                    membershipStatus: 'ACTIVE',
                    membershipType: 'Platinum Yearly',
                    joinDate: '2023-01-01T00:00:00.000Z',
                    expiryDate: '2025-12-31T00:00:00.000Z',
                    plan: { name: 'Platinum Yearly' }
                }
            });
            setLoading(false);
            return;
        }

        try {
            const res = await axios.get(`http://localhost:5000/api/access/logs/${logId}`);
            setLog(res.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load scan details');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 bg-surface rounded-[2rem] border border-white/5 shadow-xl ${fullScreen ? 'min-h-screen bg-background' : ''}`}>
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-primary/20 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="mt-4 text-primary font-black tracking-widest uppercase text-[10px] animate-pulse">Verifying...</p>
            </div>
        );
    }

    if (error || (!log && logId)) {
        return (
            <div className={`flex items-center justify-center p-2 ${fullScreen ? 'min-h-screen bg-background' : ''}`}>
                <div className="bg-surface rounded-[2rem] border border-white/5 p-6 max-w-md w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-icons-round text-4xl text-red-500">error_outline</span>
                    </div>
                    <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">System Error</h2>
                    <p className="text-text-muted text-sm font-medium">{error || 'Scan record not found.'}</p>
                </div>
            </div>
        );
    }

    const member = log?.member;
    const isAllowed = log?.status === 'ALLOWED';

    return (
        <div className={`animate-fade-in ${fullScreen ? 'min-h-screen bg-background flex flex-col items-center justify-center p-8' : ''}`}>
            <div className={`${fullScreen ? 'w-full max-w-5xl' : 'w-full'} space-y-6`}>

                {/* Result Header - Optional */}
                {!propLogId && !fullScreen && (
                    <div className="flex items-center justify-between">
                        <button onClick={() => navigate('/access')} className="flex items-center gap-2 text-text-muted hover:text-white transition-colors">
                            <span className="material-icons-round">arrow_back</span>
                            <span className="font-bold uppercase text-xs">Access Hub</span>
                        </button>
                    </div>
                )}

                {log && (
                    <div className={`relative overflow-hidden rounded-[2.5rem] border-4 transition-all shadow-2xl ${isAllowed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
                        } ${fullScreen || !compact ? 'p-10' : 'p-6'}`}>
                        {/* Animated Glow */}
                        <div className={`absolute -right-32 -top-32 w-96 h-96 rounded-full blur-[120px] opacity-20 ${isAllowed ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                        <div className={`relative flex flex-col ${fullScreen || !compact ? 'lg:flex-row' : ''} items-center gap-8 text-center lg:text-left`}>
                            {/* Profile Image / Initials */}
                            <div className="relative flex-shrink-0">
                                {member?.imageUrl ? (
                                    <div className={`rounded-[2rem] overflow-hidden border-4 border-white/10 shadow-2xl rotate-2 ${fullScreen ? 'w-48 h-48' : (compact ? 'w-24 h-24' : 'w-36 h-36')}`}>
                                        <img src={member.imageUrl} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className={`rounded-[2rem] bg-primary/20 border-4 border-white/10 flex items-center justify-center shadow-2xl rotate-2 ${fullScreen ? 'w-48 h-48' : (compact ? 'w-24 h-24' : 'w-36 h-36')}`}>
                                        <span className={`${fullScreen ? 'text-6xl' : (compact ? 'text-4xl' : 'text-5xl')} font-black text-primary`}>
                                            {member?.firstName?.[0]}{member?.lastName?.[0]}
                                        </span>
                                    </div>
                                )}
                                <div className={`absolute -bottom-2 -right-2 rounded-2xl flex items-center justify-center border-2 border-background shadow-2xl ${isAllowed ? 'bg-emerald-500' : 'bg-red-500'
                                    } ${fullScreen ? 'w-16 h-16' : (compact ? 'w-10 h-10' : 'w-12 h-12')}`}>
                                    <span className={`material-icons-round text-white ${fullScreen ? 'text-3xl' : (compact ? 'text-xl' : 'text-2xl')}`}>
                                        {isAllowed ? 'verified' : 'gpp_bad'}
                                    </span>
                                </div>
                            </div>

                            {/* Member Details */}
                            <div className="flex-1 space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap">
                                        <h1 className={`font-black uppercase tracking-tighter leading-none ${fullScreen ? 'text-6xl' : (compact ? 'text-3xl' : 'text-5xl')
                                            } ${isAllowed ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isAllowed ? 'Granted' : 'Denied'}
                                        </h1>
                                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${member?.membershipStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'
                                            }`}>
                                            {member?.membershipStatus || 'UNKNOWN'}
                                        </div>
                                    </div>
                                    <h2 className={`text-white font-black tracking-tight ${fullScreen ? 'text-4xl' : (compact ? 'text-xl' : 'text-3xl')}`}>
                                        {member?.firstName} {member?.lastName}
                                    </h2>
                                    <p className={`text-text-muted font-bold uppercase tracking-widest ${compact ? 'text-[10px]' : 'text-sm'}`}>
                                        Member ID: #{member?.id || '---'}
                                    </p>
                                </div>

                                {/* Vital Grid */}
                                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10`}>
                                    <div className="space-y-0.5">
                                        <p className="text-text-muted text-[9px] font-black uppercase tracking-widest">Plan</p>
                                        <p className={`text-white font-black ${compact ? 'text-xs' : 'text-base'}`}>{member?.plan?.name || member?.membershipType || 'Standard'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-text-muted text-[9px] font-black uppercase tracking-widest">Joined</p>
                                        <p className={`text-white font-black ${compact ? 'text-xs' : 'text-base'}`}>
                                            {member?.joinDate ? new Date(member.joinDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-text-muted text-[9px] font-black uppercase tracking-widest">Expires</p>
                                        <p className={`font-black ${compact ? 'text-xs' : 'text-base'} ${new Date(member?.expiryDate) < new Date() ? 'text-red-400' : 'text-white'}`}>
                                            {member?.expiryDate ? new Date(member.expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
}