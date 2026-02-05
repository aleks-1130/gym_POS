import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Star, Calendar, Clock, History, ChevronRight, X, Info } from 'lucide-react';

export default function Trainers() {
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [viewMode, setViewMode] = useState(null); // 'profile' or 'sessions'
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    useEffect(() => {
        fetchTrainers();
    }, []);

    const fetchTrainers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/trainers');
            setTrainers(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch trainers");
            setLoading(false);
        }
    };

    const fetchTrainerSessions = async (trainerId) => {
        setSessionsLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/trainers/${trainerId}/sessions`);
            setSessions(res.data);
            setSessionsLoading(false);
        } catch (error) {
            console.error("Failed to fetch sessions");
            setSessionsLoading(false);
        }
    };

    const handleViewProfile = async (trainer) => {
        setSelectedTrainer(trainer);
        setViewMode('profile');
    };

    const handleViewSessions = async (trainer) => {
        setSelectedTrainer(trainer);
        setViewMode('sessions');
        fetchTrainerSessions(trainer.id);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in relative pb-10">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trainer Directory</h1>
                    <p className="text-text-muted mt-1">View trainer profiles and coaching history</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trainers.map(trainer => (
                    <div key={trainer.id} className="bg-surface p-6 rounded-[2.5rem] border border-white/5 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors"></div>

                        <div className="flex items-center gap-5 mb-6 relative z-10">
                            <div className="w-20 h-20 rounded-[1.5rem] overflow-hidden border-2 border-white/10 group-hover:border-primary/50 transition-colors shadow-xl">
                                {trainer.imageUrl ? (
                                    <img src={trainer.imageUrl} alt={trainer.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-surfaceHighlight flex items-center justify-center">
                                        <User className="text-text-muted" size={32} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">{trainer.name}</h3>
                                <p className="text-primary font-bold text-xs uppercase tracking-widest">{trainer.specialty || 'Elite Coach'}</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8 relative z-10">
                            <div className="flex-1 bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                                <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-1">Sessions</p>
                                <p className="text-xl font-black text-white">{trainer.classes?.length || 0}</p>
                            </div>
                            <div className="flex-1 bg-white/[0.03] rounded-2xl p-4 border border-white/5">
                                <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-1">Rating</p>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-xl font-black text-white">{trainer.rating || '5.0'}</p>
                                    <Star className="text-amber-500 fill-amber-500" size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 relative z-10 font-black uppercase text-[10px] tracking-widest">
                            <button
                                onClick={() => handleViewProfile(trainer)}
                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/5 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Info size={14} className="text-primary" />
                                Profile
                            </button>
                            <button
                                onClick={() => handleViewSessions(trainer)}
                                className="flex-1 py-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl border border-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <History size={14} />
                                Sessions
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal for Profile / Sessions */}
            {viewMode && selectedTrainer && (
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setViewMode(null)}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <div className="bg-surface w-full max-w-4xl max-h-[92vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10">
                                    {selectedTrainer.imageUrl ? (
                                        <img src={selectedTrainer.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-surfaceHighlight flex items-center justify-center text-2xl font-black text-primary">
                                            {selectedTrainer.name[0]}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">{selectedTrainer.name}</h2>
                                    <p className="text-primary font-bold text-xs uppercase tracking-widest mt-1">
                                        {viewMode === 'profile' ? 'Trainer Profile' : 'Training History'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewMode(null)}
                                className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-white transition-all hover:rotate-90"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
                            {viewMode === 'profile' ? (
                                <div className="space-y-8">
                                    <div className="bg-white/[0.02] rounded-[2rem] p-8 border border-white/5">
                                        <h3 className="text-xl font-black text-white uppercase italic mb-4">Biography</h3>
                                        <p className="text-text-secondary leading-relaxed text-lg">
                                            {selectedTrainer.bio || "No biography available for this trainer yet. More details coming soon."}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white/[0.02] rounded-[2rem] p-8 border border-white/5">
                                            <h3 className="text-xl font-black text-white uppercase italic mb-4">Specs & Skills</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {(selectedTrainer.specialty || 'Fitness,Coaching,Nutrition').split(',').map((skill, i) => (
                                                    <span key={i} className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-black uppercase tracking-widest">
                                                        {skill.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-white/[0.02] rounded-[2rem] p-8 border border-white/5">
                                            <h3 className="text-xl font-black text-white uppercase italic mb-4">Performance</h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-text-muted text-sm font-bold uppercase tracking-widest">Global Rating</span>
                                                    <div className="flex items-center gap-1.5 text-amber-500 font-black">
                                                        <span>{selectedTrainer.rating || '5.0'}</span>
                                                        <Star size={16} fill="currentColor" />
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-text-muted text-sm font-bold uppercase tracking-widest">Classes Hosted</span>
                                                    <span className="text-white font-black">{selectedTrainer.classes?.length || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {sessionsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                            <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Fetching sessions...</p>
                                        </div>
                                    ) : sessions.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-separate border-spacing-y-4 -mt-4">
                                                <thead>
                                                    <tr className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                                                        <th className="px-6 py-2">Member</th>
                                                        <th className="px-6 py-2">Date & Time</th>
                                                        <th className="px-6 py-2">Duration</th>
                                                        <th className="px-6 py-2">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sessions.map((session) => (
                                                        <tr key={session.id} className="bg-white/[0.03] hover:bg-white/[0.06] transition-all group rounded-3xl">
                                                            <td className="px-6 py-5 first:rounded-l-3xl">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-full bg-surfaceHighlight flex items-center justify-center font-black text-xs text-text-muted">
                                                                        {session.member?.firstName?.[0]}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-white font-black text-sm">{session.member?.firstName} {session.member?.lastName}</p>
                                                                        <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase italic">Member #{session.memberId}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="flex flex-col">
                                                                    <span className="text-white font-bold text-sm">
                                                                        {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </span>
                                                                    <span className="text-text-muted text-[10px] font-black uppercase">
                                                                        {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 font-bold text-white text-sm">
                                                                {session.duration} min
                                                            </td>
                                                            <td className="px-6 py-5 last:rounded-r-3xl">
                                                                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${session.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                        session.status === 'SCHEDULED' ? 'bg-primary/10 text-primary border-primary/20' :
                                                                            'bg-red-500/10 text-red-500 border-red-500/20'
                                                                    }`}>
                                                                    {session.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 bg-white/[0.01] rounded-[2rem] border border-white/5 border-dashed">
                                            <History size={48} className="text-text-muted/20 mx-auto mb-4" />
                                            <h4 className="text-xl font-black text-white/20 uppercase tracking-tighter italic">No Session History</h4>
                                            <p className="text-text-muted/20 text-xs font-bold uppercase tracking-widest mt-2">Past training sessions will appear here</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
