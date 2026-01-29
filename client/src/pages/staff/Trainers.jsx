import React, { useState } from 'react';

export default function Trainers() {
    const [trainers] = useState([
        { id: 1, name: 'Alex Johnson', role: 'Yoga Instructor', clients: 12, rating: 4.8, image: '' },
        { id: 2, name: 'Mike Tyson', role: 'Boxing Coach', clients: 25, rating: 5.0, image: '' },
        { id: 3, name: 'Sarah Connor', role: 'CrossFit Expert', clients: 18, rating: 4.9, image: '' },
    ]);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trainers</h1>
                    <p className="text-text-muted mt-1">Manage gym staff and schedules</p>
                </div>
                <button className="bg-primary hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 transition-colors">
                    <span className="material-icons-round">person_add</span>
                    Add Trainer
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trainers.map(trainer => (
                    <div key={trainer.id} className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-surfaceHighlight rounded-full flex items-center justify-center text-text-muted font-bold text-xl border border-white/5">
                                {trainer.image ? <img src={trainer.image} alt={trainer.name} className="w-full h-full rounded-full object-cover" /> : trainer.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{trainer.name}</h3>
                                <p className="text-primary font-medium text-sm">{trainer.role}</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mb-6">
                            <div className="flex-1 bg-surfaceHighlight rounded-xl p-3 text-center border border-white/5">
                                <p className="text-xs text-text-muted mb-1">Active Clients</p>
                                <p className="text-lg font-bold text-white">{trainer.clients}</p>
                            </div>
                            <div className="flex-1 bg-surfaceHighlight rounded-xl p-3 text-center border border-white/5">
                                <p className="text-xs text-text-muted mb-1">Rating</p>
                                <div className="flex items-center justify-center gap-1">
                                    <span className="text-lg font-bold text-white">{trainer.rating}</span>
                                    <span className="material-icons-round text-amber-500 text-base">star</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button className="flex-1 py-2 text-text-muted font-bold text-sm bg-surfaceHighlight hover:bg-white/10 rounded-xl transition-colors">
                                View Profile
                            </button>
                            <button className="flex-1 py-2 text-primary font-bold text-sm bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors">
                                Schedule
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
