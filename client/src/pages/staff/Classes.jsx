import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Users, Clock, MapPin, ChevronRight, X, User, CheckCircle2, AlertCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Classes() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeDay, setActiveDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [participantsLoading, setParticipantsLoading] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/classes');
            setClasses(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch classes");
            setLoading(false);
        }
    };

    const fetchParticipants = async (classId) => {
        setParticipantsLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/classes/${classId}/participants`);
            setParticipants(res.data);
            setParticipantsLoading(false);
        } catch (error) {
            console.error("Failed to fetch participants");
            setParticipantsLoading(false);
        }
    };

    const handleViewParticipants = (cls) => {
        setSelectedClass(cls);
        fetchParticipants(cls.id);
    };

    const filteredClasses = classes.filter(cls => cls.dayOfWeek === activeDay);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Weekly Class Schedule</h1>
                    <p className="text-text-muted mt-1 font-medium">Coordinate group training sessions and track participants</p>
                </div>

                {/* Day Navigation */}
                <div className="flex bg-surface p-1.5 rounded-[1.5rem] border border-white/5 shadow-inner overflow-x-auto no-scrollbar max-w-full">
                    {DAYS.map(day => (
                        <button
                            key={day}
                            onClick={() => setActiveDay(day)}
                            className={`px-6 py-2.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeDay === day
                                    ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105'
                                    : 'text-text-muted hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {day.substring(0, 3)}
                        </button>
                    ))}
                </div>
            </header>

            {/* Classes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredClasses.length > 0 ? (
                    filteredClasses.map(cls => {
                        const isFull = cls.bookings?.length >= cls.capacity;
                        return (
                            <div key={cls.id} className="bg-surface rounded-[2.5rem] border border-white/5 p-8 group relative overflow-hidden transition-all hover:shadow-2xl hover:border-white/10">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>

                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-xl border border-primary/20 text-[10px] font-black uppercase tracking-widest">
                                        Active Room
                                    </div>
                                    <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase">
                                        <Clock size={14} className="text-primary" />
                                        {cls.duration} Min
                                    </div>
                                </div>

                                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2 group-hover:text-primary transition-colors">
                                    {cls.name}
                                </h3>
                                <p className="text-text-muted text-sm font-medium mb-6">
                                    Led by <span className="text-white font-bold">{cls.trainer?.name}</span>
                                </p>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                                        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                                            <Calendar className="text-primary" size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-text-muted font-black uppercase tracking-widest leading-none mb-1">Session Starts</p>
                                            <p className="text-white font-black text-lg">{cls.time}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-text-muted">Attendance Heatmap</span>
                                            <span className={isFull ? 'text-red-400' : 'text-primary'}>
                                                {cls.bookings?.length || 0} / {cls.capacity} Booked
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${isFull ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-primary shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                                                    }`}
                                                style={{ width: `${Math.min(100, ((cls.bookings?.length || 0) / cls.capacity) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleViewParticipants(cls)}
                                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-3 font-black uppercase text-xs tracking-[0.2em]"
                                >
                                    <Users size={18} className="text-primary" />
                                    View Participants
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-32 text-center bg-white/[0.01] rounded-[3rem] border border-white/5 border-dashed">
                        <Calendar size={64} className="text-text-muted/10 mx-auto mb-6" />
                        <h4 className="text-3xl font-black text-white/10 uppercase tracking-tighter italic">No Classes Scheduled</h4>
                        <p className="text-text-muted/20 text-sm font-bold uppercase tracking-widest mt-2">{activeDay} is currently open for free training</p>
                    </div>
                )}
            </div>

            {/* Participants Modal */}
            {selectedClass && (
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setSelectedClass(null)}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <div className="bg-surface w-full max-w-2xl max-h-[88vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="sticky top-0 z-10 p-6 border-b border-white/10 bg-surface/95 backdrop-blur flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                        <Users className="text-primary" size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white leading-none">{selectedClass.name}</h3>
                                        <p className="text-text-muted text-sm mt-1">Participants - {activeDay}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedClass(null)}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                                {participantsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-text-muted text-xs font-semibold">Syncing attendance...</p>
                                    </div>
                                ) : participants.length > 0 ? (
                                    <div className="space-y-4">
                                        {participants.map((booking) => (
                                            <div key={booking.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl group hover:border-primary/30 transition-all hover:bg-primary/5">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-10 h-10 rounded-xl bg-surfaceHighlight flex items-center justify-center border border-white/10 group-hover:border-primary/20">
                                                        {booking.member?.imageUrl ? (
                                                            <img src={booking.member.imageUrl} className="w-full h-full object-cover rounded-xl" alt="" />
                                                        ) : (
                                                            <User size={20} className="text-text-muted" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-semibold text-sm">{booking.member?.firstName} {booking.member?.lastName}</p>
                                                        <p className="text-xs text-text-muted">Member ID: #{booking.memberId}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {booking.status === 'ATTENDED' ? (
                                                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                            <CheckCircle2 size={12} />
                                                            Attended
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-primary text-xs font-semibold px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg">
                                                            <Clock size={12} />
                                                            Booked
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 bg-white/[0.01] rounded-2xl border border-white/5 border-dashed">
                                        <AlertCircle size={40} className="text-text-muted/20 mx-auto mb-4" />
                                        <h4 className="text-lg font-bold text-white/30">No Participants Yet</h4>
                                        <p className="text-text-muted/20 text-xs font-semibold mt-2">Registration for this session is currently open</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Statistics */}
                            <div className="sticky bottom-0 p-6 border-t border-white/10 bg-surface/95 backdrop-blur flex items-center justify-between">
                                <div className="flex gap-6">
                                    <div>
                                        <p className="text-xs text-text-muted mb-1">Booked</p>
                                        <p className="text-white font-semibold text-lg">{participants.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-muted mb-1">Capacity Left</p>
                                        <p className="text-white font-semibold text-lg">{selectedClass.capacity - participants.length}</p>
                                    </div>
                                </div>
                                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-medium transition-all">
                                    Export List
                                </button>
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
