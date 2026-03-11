import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const categoryClasses = {
    INFO: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    ALERT: 'bg-red-500/10 text-red-300 border-red-500/30',
    PROMO: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
};

export default function MemberAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
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
        fetchAnnouncements();
    }, []);

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
                    <p className="text-text-muted text-sm">Loading announcements...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 px-4 max-w-4xl mx-auto space-y-4">
            <div className="sticky top-0 z-10 -mx-4 px-4 py-4 bg-background/95 backdrop-blur-sm border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                        <span className="material-icons-round text-primary">campaign</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Announcements</h1>
                        <p className="text-xs text-text-muted mt-0.5">Latest gym updates for members</p>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
                    {['all', 'INFO', 'ALERT', 'PROMO'].map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setFilter(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${
                                filter === tab
                                    ? 'bg-primary/15 text-primary border-primary/30'
                                    : 'bg-surface text-text-muted border-white/10 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab === 'all' ? 'All' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {filteredAnnouncements.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center">
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                        <span className="material-icons-round text-text-muted">campaign</span>
                    </div>
                    <p className="text-white font-semibold">No announcements found</p>
                    <p className="text-text-muted text-xs mt-1">Try a different filter or check back later.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAnnouncements.map((announcement) => (
                        <article key={announcement.id} className="bg-surface rounded-2xl border border-white/5 p-4">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${categoryClasses[announcement.type] || categoryClasses.INFO}`}>
                                    {announcement.type || 'INFO'}
                                </span>
                                <span className="text-[11px] text-text-muted">
                                    {new Date(announcement.date || announcement.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <h2 className="text-white font-bold text-base">{announcement.title || 'Announcement'}</h2>
                            <p className="text-text-secondary text-sm leading-relaxed mt-2">
                                {announcement.message || 'No message provided.'}
                            </p>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
