import React, { useState } from 'react';

export default function Classes() {
    const [classes] = useState([
        { id: 1, name: 'Morning Yoga', trainer: 'Alex Johnson', time: '07:00 AM', duration: '60 min', capacity: 20, booked: 12, category: 'Wellness' },
        { id: 2, name: 'HIIT Blast', trainer: 'Sarah Connor', time: '09:00 AM', duration: '45 min', capacity: 15, booked: 15, category: 'Cardio' },
        { id: 3, name: 'Power Lifting', trainer: 'Mike Tyson', time: '05:00 PM', duration: '90 min', capacity: 10, booked: 8, category: 'Strength' },
        { id: 4, name: 'Zumba Dance', trainer: 'Jessica Alba', time: '06:30 PM', duration: '60 min', capacity: 25, booked: 20, category: 'Cardio' },
    ]);

    const getCategoryColor = (cat) => {
        switch (cat) {
            case 'Wellness': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'Cardio': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
            case 'Strength': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            default: return 'bg-white/5 text-text-muted border border-white/10';
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Class Schedule</h1>
                    <p className="text-text-muted mt-1">Book and manage your fitness sessions</p>
                </div>
                <div className="flex gap-2">
                    <button className="bg-surfaceHighlight border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors">
                        My Bookings
                    </button>
                    <button className="bg-primary hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-primary/20 text-sm">
                        View Calendar
                    </button>
                </div>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map(cls => {
                    const isFull = cls.booked >= cls.capacity;
                    return (
                        <div key={cls.id} className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCategoryColor(cls.category)}`}>
                                    {cls.category}
                                </span>
                                <span className="flex items-center gap-1 text-text-muted text-sm">
                                    <span className="material-icons-round text-sm">schedule</span>
                                    {cls.duration}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary transition-colors">{cls.name}</h3>
                            <p className="text-text-muted text-sm mb-4">with <span className="font-medium text-white">{cls.trainer}</span></p>

                            <div className="flex items-center gap-2 mb-6 bg-surfaceHighlight p-3 rounded-xl">
                                <span className="material-icons-round text-primary">access_time_filled</span>
                                <span className="font-bold text-white">{cls.time}</span>
                            </div>

                            <div className="flex justify-between items-center mb-6 text-sm">
                                <span className="text-text-muted">Availability</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-primary'}`}
                                            style={{ width: `${(cls.booked / cls.capacity) * 100}%` }}
                                        ></div>
                                    </div>
                                    <span className={`font-bold ${isFull ? 'text-red-400' : 'text-white'}`}>{cls.booked}/{cls.capacity}</span>
                                </div>
                            </div>

                            <button
                                disabled={isFull}
                                className={`w-full py-3 rounded-xl font-bold transition-all ${isFull
                                    ? 'bg-white/5 text-text-muted cursor-not-allowed'
                                    : 'bg-primary/10 text-primary hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20'
                                    }`}
                            >
                                {isFull ? 'Waitlist Full' : 'Book Session'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
