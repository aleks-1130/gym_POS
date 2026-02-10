import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function TrainerDashboard() {
    const { user } = useAuth();
    const [trainer, setTrainer] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [trainerRes, sessionsRes, classesRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/trainer/me'),
                    axios.get('http://localhost:5000/api/trainer/me/sessions'),
                    axios.get('http://localhost:5000/api/trainer/me/classes')
                ]);
                setTrainer(trainerRes.data);
                setSessions(sessionsRes.data || []);
                setClasses(classesRes.data || []);
            } catch (e) {
                console.error("Failed to load trainer dashboard", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const now = new Date();
    const upcomingSessions = sessions
        .filter((s) => new Date(s.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    const upcomingCount = sessions.filter((s) => new Date(s.date) >= now).length;
    const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length;

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trainer Dashboard</h1>
                    <p className="text-text-muted mt-1">Welcome back, {user?.name || 'Trainer'}</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-sm text-text-secondary">
                    <span className="text-white font-semibold">{trainer?.name || 'Your Profile'}</span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface rounded-2xl border border-white/5 p-5">
                    <p className="text-text-muted text-xs uppercase tracking-widest font-bold">Upcoming Sessions</p>
                    <p className="text-3xl text-primary font-bold mt-2">{upcomingCount}</p>
                </div>
                <div className="bg-surface rounded-2xl border border-white/5 p-5">
                    <p className="text-text-muted text-xs uppercase tracking-widest font-bold">Completed Sessions</p>
                    <p className="text-3xl text-emerald-400 font-bold mt-2">{completedCount}</p>
                </div>
                <div className="bg-surface rounded-2xl border border-white/5 p-5">
                    <p className="text-text-muted text-xs uppercase tracking-widest font-bold">Classes This Week</p>
                    <p className="text-3xl text-white font-bold mt-2">{classes.length}</p>
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Upcoming Sessions</h2>
                    <a href="/trainer/sessions" className="text-primary text-xs font-semibold underline">View All</a>
                </div>
                {upcomingSessions.length === 0 ? (
                    <div className="p-6 text-text-muted text-sm">No upcoming sessions yet.</div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {upcomingSessions.map((session) => (
                            <div key={session.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-white font-semibold">
                                        {session.member?.firstName} {session.member?.lastName}
                                    </p>
                                    <p className="text-text-muted text-xs">
                                        {new Date(session.date).toLocaleDateString()} • {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                                    {session.duration} min
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
