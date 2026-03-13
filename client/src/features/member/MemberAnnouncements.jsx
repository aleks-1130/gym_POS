import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { createPortal } from 'react-dom';

const categoryClasses = {
    INFO: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    ALERT: 'bg-red-500/10 text-red-300 border-red-500/30',
    PROMO: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
};

export default function MemberAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [preferences, setPreferences] = useState({
        emailAnnouncements: true,
        emailReminders: true,
        emailReceipts: true,
        appAnnouncements: true,
        appReminders: true,
        appReceipts: true
    });
    const [prefLoading, setPrefLoading] = useState(false);

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get('/api/notifications');
            setAnnouncements(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch member announcements', error);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPreferences = async () => {
        try {
            const res = await axios.get('/api/notifications/preferences');
            setPreferences(res.data);
        } catch (error) {
            console.error('Failed to fetch preferences', error);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
        fetchPreferences();
    }, []);

    const handleMarkAsRead = async (id, isRead) => {
        if (isRead) return;
        try {
            console.log(`[DEBUG] Marking notification ${id} as read...`);
            await axios.patch(`/api/notifications/${id}/read`);
            setAnnouncements(prev => 
                prev.map(a => a.id === id ? { ...a, isRead: true } : a)
            );
        } catch (error) {
            console.error("Failed to mark notification as read:", error.response?.data || error.message);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await axios.patch('/api/notifications/read-all');
            setAnnouncements(prev => prev.map(a => ({ ...a, isRead: true })));
            setIsConfirmOpen(false);
        } catch (error) {
            console.error("Failed to mark all as read:", error.response?.data || error.message);
        }
    };

    const handleTogglePreference = async (key) => {
        const newValue = !preferences[key];
        setPreferences(prev => ({ ...prev, [key]: newValue }));
        try {
            await axios.patch('/api/notifications/preferences', { [key]: newValue });
        } catch (error) {
            console.error("Failed to update preference", error);
            // Revert on failure
            setPreferences(prev => ({ ...prev, [key]: !newValue }));
        }
    };

    const filteredAnnouncements = useMemo(() => (
        announcements
            .filter((announcement) => filter === 'all' || announcement.type === filter)
            .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    ), [announcements, filter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-text-muted text-sm italic font-medium uppercase tracking-widest">Loading announcements...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24 px-4 max-w-4xl mx-auto space-y-6">
            <div className="sticky top-0 z-10 -mx-4 px-4 py-6 bg-background/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
                        <span className="material-icons-round text-primary text-2xl">campaign</span>
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">Highlights</h1>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mt-2 italic">Stay tuned to gym updates</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-white transition-colors"
                        >
                            <span className="material-icons-round text-xl">settings</span>
                        </button>
                        <button
                            onClick={() => setIsConfirmOpen(true)}
                            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-white transition-colors"
                            title="Mark all as read"
                        >
                            <span className="material-icons-round text-xl">done_all</span>
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar mt-6 pt-1">
                    {['all', 'INFO', 'ALERT', 'PROMO'].map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setFilter(tab)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                                filter === tab
                                    ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20'
                                    : 'bg-surface text-text-muted border-white/10 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab === 'all' ? 'All Updates' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {filteredAnnouncements.length === 0 ? (
                <div className="bg-surface rounded-[2.5rem] border border-white/5 p-12 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                        <span className="material-icons-round text-text-muted text-3xl">inbox</span>
                    </div>
                    <p className="text-white font-black uppercase italic tracking-wider">All caught up!</p>
                    <p className="text-text-muted text-[10px] font-medium uppercase tracking-widest mt-2 font-mono">No recent updates in this category</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAnnouncements.map((announcement) => (
                        <article 
                            key={announcement.id} 
                            onClick={() => handleMarkAsRead(announcement.id, announcement.isRead)}
                            className={`bg-surface rounded-[2rem] border transition-all p-6 group cursor-pointer active:scale-[0.98] ${
                                announcement.isRead 
                                    ? 'border-white/5 opacity-80' 
                                    : 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${categoryClasses[announcement.type] || categoryClasses.INFO}`}>
                                    {announcement.type || 'INFO'}
                                </span>
                                {!announcement.isRead && (
                                    <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                                )}
                            </div>
                            <h2 className={`font-black uppercase italic tracking-tighter text-lg leading-tight group-hover:text-primary transition-colors ${announcement.isRead ? 'text-white/70' : 'text-white'}`}>
                                {announcement.title || 'Announcement'}
                            </h2>
                            <p className="text-text-secondary text-sm leading-relaxed mt-3 font-medium">
                                {announcement.message || 'No message provided.'}
                            </p>
                            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                                <span className="text-[10px] text-text-muted font-black uppercase tracking-widest flex items-center gap-1.5 font-mono">
                                    <span className="material-icons-round text-xs">event</span>
                                    {new Date(announcement.date || announcement.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {announcement.isRead ? (
                                    <span className="text-[9px] text-emerald-500/50 font-black uppercase tracking-widest italic">Archived</span>
                                ) : (
                                    <span className="text-[9px] text-primary font-black uppercase tracking-widest italic animate-bounce">New Update</span>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>

            <ConfirmDialog 
                isOpen={isConfirmOpen}
                title="Mark all as read?"
                message="This will mark all current announcements and alerts as seen."
                confirmLabel="Mark All Read"
                cancelLabel="Cancel"
                onConfirm={handleMarkAllRead}
                onCancel={() => setIsConfirmOpen(false)}
            />

            {/* Preferences Modal */}
            {isSettingsOpen && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)} />
                    <div className="relative bg-surface border border-white/10 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Notifications</h3>
                                <button onClick={() => setIsSettingsOpen(false)} className="text-text-muted hover:text-white">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>

                            <div className="space-y-6">
                                <section>
                                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-4">In-App Alerts</p>
                                    <div className="space-y-3">
                                        <Toggle label="Announcements" active={preferences.appAnnouncements} onToggle={() => handleTogglePreference('appAnnouncements')} />
                                        <Toggle label="Class Reminders" active={preferences.appReminders} onToggle={() => handleTogglePreference('appReminders')} />
                                        <Toggle label="Payment Receipts" active={preferences.appReceipts} onToggle={() => handleTogglePreference('appReceipts')} />
                                    </div>
                                </section>

                                <div className="h-px bg-white/5" />

                                <section>
                                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-4">Email Notifications</p>
                                    <div className="space-y-3">
                                        <Toggle label="Announcements" active={preferences.emailAnnouncements} onToggle={() => handleTogglePreference('emailAnnouncements')} />
                                        <Toggle label="Class Reminders" active={preferences.emailReminders} onToggle={() => handleTogglePreference('emailReminders')} />
                                        <Toggle label="Payment Receipts" active={preferences.emailReceipts} onToggle={() => handleTogglePreference('emailReceipts')} />
                                    </div>
                                </section>
                            </div>

                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="w-full mt-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function Toggle({ label, active, onToggle }) {
    return (
        <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{label}</span>
            <div 
                onClick={onToggle}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${active ? 'bg-primary' : 'bg-white/10'}`}
            >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${active ? 'left-6' : 'left-1'}`} />
            </div>
        </label>
    );
}
