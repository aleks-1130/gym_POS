import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function Schedule() {
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, booked, available
    const [selectedDay, setSelectedDay] = useState('all'); // all, Mon, Tue, Wed, Thu, Fri, Sat, Sun

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
            alert("Joined Class successfully!");
            fetchClasses();
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

    const filteredClasses = classes.filter(cls => {
        // Filter by booking status
        if (filter === 'booked' && !cls.isBooked) return false;
        if (filter === 'available' && (cls.isBooked || cls.enrolled >= cls.capacity)) return false;
        
        // Filter by day of week
        if (selectedDay !== 'all') {
            const dayMapping = {
                'M': ['Mon', 'Monday'],
                'T': ['Tue', 'Tuesday'],
                'W': ['Wed', 'Wednesday'],
                'TH': ['Thu', 'Thursday'],
                'F': ['Fri', 'Friday'],
                'S': ['Sat', 'Saturday'],
                'SUN': ['Sun', 'Sunday']
            };
            const matchDays = dayMapping[selectedDay];
            if (!matchDays.some(day => cls.dayOfWeek?.includes(day))) return false;
        }
        
        return true;
    });

    const dayButtons = [
        { value: 'all', label: 'All' },
        { value: 'M', label: 'M' },
        { value: 'T', label: 'T' },
        { value: 'W', label: 'W' },
        { value: 'TH', label: 'TH' },
        { value: 'F', label: 'F' },
        { value: 'S', label: 'S' },
        { value: 'SUN', label: 'SUN' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading Schedule...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 px-4 max-w-5xl mx-auto">
            {/* Header */}
            <div className="pt-4 pb-3">
                <h1 className="text-xl font-bold text-white">Gym Class Schedule</h1>
                <p className="text-text-muted text-xs mt-0.5">Join Class sessions</p>
            </div>

            {/* Filter Tabs - Sticky */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-3 mb-2 border-b border-white/5">
                <div className="flex gap-2">
                    {[
                        { value: 'all', label: 'All Classes', icon: 'grid_view' },
                        { value: 'booked', label: 'My Bookings', icon: 'check_circle' },
                        { value: 'available', label: 'Available', icon: 'event_available' }
                    ].map(f => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                                filter === f.value
                                    ? 'bg-primary text-background shadow-lg'
                                    : 'bg-surface text-text-muted hover:text-white border border-white/5'
                            }`}
                        >
                            <span className="material-icons-round text-base">{f.icon}</span>
                            <span className="hidden sm:inline">{f.label}</span>
                            <span className="sm:hidden">{f.label.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Day Filter */}
            <div className="mb-4 px-1">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                    {dayButtons.map(day => (
                        <button
                            key={day.value}
                            onClick={() => setSelectedDay(day.value)}
                            className={`flex-shrink-0 min-w-[44px] h-11 rounded-lg font-bold text-xs transition-all active:scale-95 ${
                                selectedDay === day.value
                                    ? 'bg-primary text-background shadow-lg'
                                    : 'bg-surface text-text-muted hover:text-white border border-white/5'
                            }`}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Classes List - Card Layout */}
            <div className="space-y-3">
                {filteredClasses.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <span className="material-icons-round text-3xl text-text-muted">event_busy</span>
                        </div>
                        <p className="text-text-muted text-sm">No classes found</p>
                        {(filter !== 'all' || selectedDay !== 'all') && (
                            <button
                                onClick={() => {
                                    setFilter('all');
                                    setSelectedDay('all');
                                }}
                                className="mt-3 text-primary text-sm font-medium underline"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    filteredClasses.map(cls => {
                        const isFull = cls.enrolled >= cls.capacity;
                        const capacityPercent = (cls.enrolled / cls.capacity) * 100;
                        
                        return (
                            <div 
                                key={cls.id} 
                                className={`bg-surface rounded-xl p-4 border transition-all ${
                                    cls.isBooked 
                                        ? 'border-primary/30 bg-primary/5' 
                                        : 'border-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className="flex gap-4">
                                    {/* Time Badge */}
                                    <div className="flex-shrink-0 w-16 text-center">
                                        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                                            <div className="text-primary font-bold text-lg leading-none mb-1">
                                                {cls.time?.split(':')[0] || '00'}
                                            </div>
                                            <div className="text-text-muted text-xs font-medium">
                                                {cls.time?.includes('AM') || cls.time?.includes('PM') 
                                                    ? cls.time.slice(-2) 
                                                    : 'MIN'}
                                            </div>
                                        </div>
                                        {cls.isBooked && (
                                            <div className="mt-2 bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-bold rounded">
                                                BOOKED
                                            </div>
                                        )}
                                    </div>

                                    {/* Class Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="mb-3">
                                            <h3 className="text-base font-bold text-white mb-1 line-clamp-1">
                                                {cls.name}
                                            </h3>
                                            <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">person</span>
                                                    {cls.trainer?.name || 'TBA'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">calendar_today</span>
                                                    {cls.dayOfWeek}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">schedule</span>
                                                    {cls.duration}min
                                                </span>
                                            </div>
                                        </div>

                                        {/* Capacity Info */}
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs text-text-muted">
                                                    {cls.enrolled} / {cls.capacity} spots filled
                                                </span>
                                                <span className={`text-xs font-bold ${
                                                    isFull ? 'text-red-400' : 
                                                    capacityPercent > 75 ? 'text-yellow-400' : 
                                                    'text-emerald-400'
                                                }`}>
                                                    {isFull ? 'Full' : `${cls.capacity - cls.enrolled} left`}
                                                </span>
                                            </div>
                                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all ${
                                                        isFull ? 'bg-red-500' : 
                                                        capacityPercent > 75 ? 'bg-yellow-500' : 
                                                        'bg-emerald-500'
                                                    }`}
                                                    style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        {cls.isBooked ? (
                                            <button
                                                onClick={() => handleCancel(cls.id)}
                                                className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 active:scale-95 transition-all text-sm border border-red-500/20 flex items-center justify-center gap-1"
                                            >
                                                <span className="material-icons-round text-base">cancel</span>
                                                Leave Class
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleBook(cls.id)}
                                                disabled={isFull}
                                                className={`w-full py-2.5 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-1 ${
                                                    isFull
                                                        ? 'bg-white/5 text-text-muted cursor-not-allowed border border-white/5'
                                                        : 'bg-primary text-background hover:brightness-110 active:scale-95 shadow-lg'
                                                }`}
                                            >
                                                <span className="material-icons-round text-base">
                                                    {isFull ? 'block' : 'add_circle'}
                                                </span>
                                                {isFull ? 'Class Full' : 'Join Class'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Quick Stats Footer */}
            {filteredClasses.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="bg-surface rounded-lg p-3 border border-white/5 text-center">
                        <div className="text-xl font-bold text-white">{classes.length}</div>
                        <div className="text-xs text-text-muted mt-0.5">Total Classes</div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-white/5 text-center">
                        <div className="text-xl font-bold text-primary">
                            {classes.filter(c => c.isBooked).length}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">My Bookings</div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-white/5 text-center">
                        <div className="text-xl font-bold text-emerald-400">
                            {classes.filter(c => !c.isBooked && c.enrolled < c.capacity).length}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">Available</div>
                    </div>
                </div>
            )}
        </div>
    );
}