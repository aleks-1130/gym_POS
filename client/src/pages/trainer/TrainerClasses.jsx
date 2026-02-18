import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function TrainerClasses() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/trainer/me/classes');
                setClasses(res.data || []);
            } catch (e) {
                console.error("Failed to fetch trainer classes", e);
            } finally {
                setLoading(false);
            }
        };

        fetchClasses();
    }, []);

    const refreshClasses = async () => {
        const res = await axios.get('http://localhost:5000/api/trainer/me/classes');
        setClasses(res.data || []);
    };

    const updateAttendance = async (clsId, bookingId, status) => {
        setUpdatingId(bookingId);
        try {
            await axios.patch(`http://localhost:5000/api/trainer/me/classes/${clsId}/attendees/${bookingId}`, { status });
            await refreshClasses();
        } catch (e) {
            alert(e.response?.data?.error || "Failed to update attendance");
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">My Classes</h1>
                <p className="text-text-muted mt-1">Class schedule and attendee list</p>
            </header>

            {classes.length === 0 ? (
                <div className="text-center py-16 bg-surface rounded-2xl border border-white/5">
                    <p className="text-text-muted">No classes assigned yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5">
                    {classes.map((cls) => (
                        <div key={cls.id} className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-white">{cls.name}</h2>
                                    <p className="text-text-muted text-xs mt-1">
                                        {cls.dayOfWeek} • {cls.time} • {cls.duration} min
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                                        {cls.enrolled}/{cls.capacity} enrolled
                                    </div>
                                    <button
                                        onClick={() => handleCompleteClass(cls.id)}
                                        className="px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-lg border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                                    >
                                        Complete & Pay
                                    </button>
                                </div>
                            </div>

                            <div className="p-5">
                                <p className="text-text-muted text-xs uppercase tracking-widest font-bold mb-3">Attendees</p>
                                {cls.bookings?.length ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {cls.bookings.map((booking) => (
                                            <div key={booking.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                                <p className="text-white font-semibold text-sm">
                                                    {booking.member?.firstName} {booking.member?.lastName}
                                                </p>
                                                <p className="text-text-muted text-xs mt-1">
                                                    Member #{booking.memberId} • {booking.status}
                                                </p>
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => updateAttendance(cls.id, booking.id, 'ATTENDED')}
                                                        disabled={updatingId === booking.id}
                                                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50"
                                                    >
                                                        Attended
                                                    </button>
                                                    <button
                                                        onClick={() => updateAttendance(cls.id, booking.id, 'CONFIRMED')}
                                                        disabled={updatingId === booking.id}
                                                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50"
                                                    >
                                                        Confirmed
                                                    </button>
                                                    <button
                                                        onClick={() => updateAttendance(cls.id, booking.id, 'CANCELLED')}
                                                        disabled={updatingId === booking.id}
                                                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-red-500/30 text-red-300 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
                                                    >
                                                        Cancelled
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-text-muted text-sm">No attendees yet.</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    async function handleCompleteClass(classId) {
        if (!window.confirm("Complete this class? This will record attendance for payroll based on current 'Attended' or 'Confirmed' bookings.")) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`http://localhost:5000/api/classes/${classId}/complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Class completed and commission recorded!");
            refreshClasses();
        } catch (error) {
            console.error("Complete Class Error:", error);
            alert("Failed to complete class");
        }
    }
}
