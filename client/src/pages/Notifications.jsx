import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifs();
    }, []);

    const fetchNotifs = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/notifications');
            if (Array.isArray(res.data)) {
                setNotifications(res.data);
            } else {
                setNotifications([]);
            }
        } catch (e) {
            console.error(e);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'ALERT': return 'warning';
            case 'INFO': return 'info';
            case 'SUCCESS': return 'check_circle';
            default: return 'notifications';
        }
    };

    const getColor = (type) => {
        switch (type) {
            case 'ALERT': return 'bg-red-500/10 text-red-500 border border-red-500/20';
            case 'INFO': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
            case 'SUCCESS': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
            default: return 'bg-white/5 text-text-muted border border-white/10';
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Notifications</h1>
                    <p className="text-text-muted mt-1">Updates and alerts</p>
                </div>
                <button onClick={fetchNotifs} className="text-text-muted hover:text-primary transition-colors">
                    <span className="material-icons-round">refresh</span>
                </button>
            </header>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-text-muted">Loading...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-12 bg-surface rounded-3xl border border-white/5 shadow-sm">
                        <span className="material-icons-round text-6xl text-white/10 mb-4">notifications_off</span>
                        <p className="text-text-muted font-medium">No new notifications</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div key={notif.id} className="bg-surface p-6 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-shadow flex gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${getColor(notif.type)}`}>
                                <span className="material-icons-round">{getIcon(notif.type)}</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-white text-lg">{notif.title}</h3>
                                    <span className="text-xs text-text-muted font-medium whitespace-nowrap ml-4">{new Date(notif.date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-text-secondary leading-relaxed">{notif.message}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
