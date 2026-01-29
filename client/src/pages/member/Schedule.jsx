import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function Schedule() {
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/members/classes');
            setClasses(res.data);
        } catch (error) {
            console.error("Failed to fetch classes");
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async (classId) => {
        try {
            await axios.post('http://localhost:5000/api/members/book', { classId });
            alert("Class booked successfully!");
            fetchClasses(); // Refresh
        } catch (error) {
            alert(error.response?.data?.error || "Booking failed");
        }
    };

    const handleCancel = async (classId) => {
        if (!window.confirm("Cancel this booking?")) return;
        try {
            await axios.post('http://localhost:5000/api/members/cancel-booking', { classId });
            alert("Booking cancelled");
            fetchClasses();
        } catch (error) {
            alert("Failed to cancel");
        }
    };

    if (loading) return <div className="text-white p-8">Loading Schedule...</div>;

    return (
        <div className="space-y-6 pb-20"> {/* pb-20 for bottom nav */}
            <header>
                <h1 className="text-3xl font-bold text-white">Class Schedule</h1>
                <p className="text-text-muted mt-1">Book your next session</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map(cls => (
                    <div key={cls.id} className="bg-surface rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                        {cls.isBooked && (
                            <div className="absolute top-0 right-0 bg-primary text-background px-3 py-1 text-xs font-bold rounded-bl-lg">
                                BOOKED
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-white mb-1">{cls.name}</h3>
                        <p className="text-text-muted text-sm mb-4">with {cls.trainer?.name}</p>

                        <div className="space-y-2 text-sm text-text-secondary mb-6">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">calendar_month</span>
                                {cls.dayOfWeek} at {cls.time}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">timer</span>
                                {cls.duration} mins
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">group</span>
                                {cls.enrolled} / {cls.capacity} filled
                            </div>
                        </div>

                        {cls.isBooked ? (
                            <button
                                onClick={() => handleCancel(cls.id)}
                                className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-colors"
                            >
                                Cancel Booking
                            </button>
                        ) : (
                            <button
                                onClick={() => handleBook(cls.id)}
                                disabled={cls.enrolled >= cls.capacity}
                                className={`w-full py-3 rounded-xl font-bold transition-transform active:scale-95 ${cls.enrolled >= cls.capacity
                                    ? 'bg-white/5 text-text-muted cursor-not-allowed'
                                    : 'bg-primary text-background hover:brightness-110'
                                    }`}
                            >
                                {cls.enrolled >= cls.capacity ? 'Full Capacity' : 'Book Class'}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
