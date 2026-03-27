import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { ROLES } from '../../constants/roles';
import MemberPageHeader from './components/MemberPageHeader';

const categoryStyles = {
    INFO: {
        icon: 'info',
        unreadCard: 'border-blue-500/35 bg-blue-500/10',
        readCard: 'border-blue-500/20 bg-blue-500/5'
    },
    ALERT: {
        icon: 'warning',
        unreadCard: 'border-red-500/35 bg-red-500/10',
        readCard: 'border-red-500/20 bg-red-500/5'
    },
    PROMO: {
        icon: 'local_offer',
        unreadCard: 'border-emerald-500/35 bg-emerald-500/10',
        readCard: 'border-emerald-500/20 bg-emerald-500/5'
    },
    PAYMENT_RECEIPT: {
        icon: 'receipt',
        unreadCard: 'border-amber-500/35 bg-amber-500/10',
        readCard: 'border-amber-500/20 bg-amber-500/5'
    },
    BOOKING_CONFIRMED: {
        icon: 'event_available',
        unreadCard: 'border-purple-500/35 bg-purple-500/10',
        readCard: 'border-purple-500/20 bg-purple-500/5'
    },
    CLASS_REMINDER: {
        icon: 'notifications_active',
        unreadCard: 'border-orange-500/35 bg-orange-500/10',
        readCard: 'border-orange-500/20 bg-orange-500/5'
    },
    WAITLIST_JOINED: {
        icon: 'hourglass_empty',
        unreadCard: 'border-slate-500/35 bg-slate-500/10',
        readCard: 'border-slate-500/20 bg-slate-500/5'
    },
    WAITLIST_PROMOTION: {
        icon: 'auto_awesome',
        unreadCard: 'border-sky-500/35 bg-sky-500/10',
        readCard: 'border-sky-500/20 bg-sky-500/5'
    },
    TRAINING_REMINDER: {
        icon: 'fitness_center',
        unreadCard: 'border-indigo-500/35 bg-indigo-500/10',
        readCard: 'border-indigo-500/20 bg-indigo-500/5'
    }
};

const filters = [
    { key: 'ALL', label: 'All' },
    { key: 'INFO', label: 'Info' },
    { key: 'ALERT', label: 'Alerts' },
    { key: 'PROMO', label: 'Promos' }
];

const defaultPreferences = {
    emailAnnouncements: true,
    emailReminders: true,
    emailReceipts: true,
    appAnnouncements: true,
    appReminders: true,
    appReceipts: true
};

const ANNOUNCEMENT_TYPES = new Set(['INFO', 'ALERT', 'PROMO', 'ANNOUNCEMENT']);
const PRIVATE_UPDATE_TYPES = new Set(['PAYMENT_RECEIPT', 'BOOKING_CONFIRMED', 'TRAINING_BOOKED', 'CLASS_REMINDER', 'WAITLIST_JOINED', 'WAITLIST_PROMOTION', 'TRAINING_REMINDER']);

const formatDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

const isDisplayableNotification = (item) => {
    if (!item) return false;
    const type = String(item?.type || '').toUpperCase();
    const targetGroup = String(item?.targetGroup || '').toUpperCase();

    // 1. Broadcasts (Announcements)
    const isBroadcast = Boolean(item?.isAnnouncement) && ANNOUNCEMENT_TYPES.has(type) && targetGroup !== 'PRIVATE';
    
    // 2. Private but relevant updates (Receipts, Bookings, etc.)
    const isPrivateUpdate = PRIVATE_UPDATE_TYPES.has(type);

    return isBroadcast || isPrivateUpdate;
};

export default function MemberAnnouncements() {
    const { user } = useAuth();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [preferences, setPreferences] = useState(defaultPreferences);
    const [prefSavingKey, setPrefSavingKey] = useState('');

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get('/api/notifications');
            setAnnouncements(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch announcements', error);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPreferences = async () => {
        try {
            const res = await axios.get('/api/notifications/preferences');
            if (res?.data && typeof res.data === 'object') {
                setPreferences((prev) => ({ ...prev, ...res.data }));
            }
        } catch (error) {
            console.error('Failed to fetch notification preferences', error);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
        fetchPreferences();
    }, []);

    const unreadCount = useMemo(
        () => announcements.filter((announcement) => !announcement?.isRead).length,
        [announcements]
    );

    const filteredAnnouncements = useMemo(() => (
        announcements
            .filter((announcement) => isDisplayableNotification(announcement))
            .filter((announcement) => {
                if (filter === 'ALL') return true;
                const type = String(announcement?.type || '').toUpperCase();
                if (filter === 'INFO') {
                    // Group general info, announcements, and private updates together under "Info"
                    return type === 'INFO' || type === 'ANNOUNCEMENT' || PRIVATE_UPDATE_TYPES.has(type);
                }
                return type === filter;
            })
            .sort((a, b) => new Date(b?.date || b?.createdAt || 0) - new Date(a?.date || a?.createdAt || 0))
    ), [announcements, filter]);

    const handleMarkAsRead = async (id, isRead) => {
        if (!id || isRead) return;
        try {
            await axios.patch(`/api/notifications/${id}/read`);
            setAnnouncements((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
        } catch (error) {
            console.error('Failed to mark announcement as read', error?.response?.data || error?.message);
        }
    };

    const handleMarkAllRead = async () => {
        if (unreadCount === 0) {
            await showAlert({
                title: 'No Unread Announcements',
                message: 'Everything is already marked as read.',
                type: 'info'
            });
            return;
        }

        const confirmed = await showConfirm({
            title: 'Mark All As Read',
            message: 'This will mark all announcements as read.',
            confirmLabel: 'Mark All Read',
            cancelLabel: 'Cancel',
            type: 'warning'
        });
        if (!confirmed) return;

        try {
            await axios.patch('/api/notifications/read-all');
            setAnnouncements((prev) => prev.map((item) => ({ ...item, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all announcements as read', error?.response?.data || error?.message);
            await showAlert({
                title: 'Update Failed',
                message: 'Unable to mark all announcements as read right now.',
                type: 'danger'
            });
        }
    };

    const handleTogglePreference = async (key) => {
        if (!key || prefSavingKey) return;

        const nextValue = !preferences[key];
        setPreferences((prev) => ({ ...prev, [key]: nextValue }));
        setPrefSavingKey(key);

        try {
            await axios.patch('/api/notifications/preferences', { [key]: nextValue });
        } catch (error) {
            setPreferences((prev) => ({ ...prev, [key]: !nextValue }));
            console.error('Failed to update preference', error);
        } finally {
            setPrefSavingKey('');
        }
    };

    const isTrainerView = user?.role === ROLES.TRAINER;
    const pageSubtitle = isTrainerView
        ? 'Gym notices, schedule alerts, and member-facing updates for trainers.'
        : 'Gym notices, reminders, and member updates in one place.';

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
        <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
            <MemberPageHeader
                title="Announcements"
                subtitle={pageSubtitle}
                icon="campaign"
                rightSlot={(
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="h-9 w-9 rounded-lg border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center"
                            title={unreadCount > 0 ? 'Mark all as read' : 'No unread announcements'}
                        >
                            <span className="material-icons-round text-[18px]">done_all</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen((prev) => !prev)}
                            className="h-9 w-9 rounded-lg border border-white/10 bg-background/40 text-text-muted hover:text-white hover:bg-white/5 flex items-center justify-center"
                            title="Notification settings"
                        >
                            <span className="material-icons-round text-[18px]">settings</span>
                        </button>
                    </div>
                )}
            >
                <div className="flex flex-wrap items-center gap-2">
                    {filters.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setFilter(tab.key)}
                            className={`h-9 rounded-lg px-3 text-[11px] sm:text-xs font-semibold transition-all border ${filter === tab.key
                                ? 'bg-primary text-background border-primary'
                                : 'bg-background/40 text-text-muted hover:text-white border-white/10'
                                }`}
                        >
                            {tab.label}
                        </button>
                        ))}
                </div>
            </MemberPageHeader>

            {filteredAnnouncements.length === 0 ? (
                <div className="bg-surface rounded-xl p-8 text-center border border-white/5">
                    <span className="material-icons-round text-text-muted text-4xl mb-2">inbox</span>
                    <p className="text-text-muted text-sm">No announcements found for this filter.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAnnouncements.map((announcement) => {
                        const normalizedType = String(announcement?.type || 'INFO').toUpperCase();
                        const style = categoryStyles[normalizedType] || categoryStyles.INFO;
                        const timestamp = announcement?.date || announcement?.createdAt;
                        const cardTone = announcement?.isRead ? style.readCard : style.unreadCard;

                        return (
                            <article
                                key={announcement.id}
                                className={`rounded-xl border p-4 sm:p-5 transition-colors ${cardTone}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <span className="material-icons-round text-base text-white/80">{style.icon}</span>
                                            {!announcement?.isRead && <span className="h-2 w-2 rounded-full bg-primary/90 animate-pulse" />}
                                        </div>

                                        <h3 className={`text-sm sm:text-base font-bold leading-tight ${announcement?.isRead ? 'text-white/80' : 'text-white'}`}>
                                            {announcement?.title || 'Announcement'}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-text-muted mt-1.5 whitespace-pre-wrap">
                                            {announcement?.message || 'No message provided.'}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleMarkAsRead(announcement.id, announcement?.isRead)}
                                        disabled={Boolean(announcement?.isRead)}
                                        className="shrink-0 rounded-lg border border-white/10 bg-background/40 px-2.5 py-1.5 text-[11px] font-semibold text-text-muted hover:text-white hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {announcement?.isRead ? 'Read' : 'Mark Read'}
                                    </button>
                                </div>

                                <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-text-muted">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="material-icons-round text-[13px]">schedule</span>
                                        {formatDateTime(timestamp)}
                                    </span>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {isSettingsOpen && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(false)}
                        aria-label="Close notification settings"
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                    />

                    <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-surface shadow-2xl p-4 sm:p-5 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
                        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20 sm:hidden" />
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <h2 className="text-sm sm:text-base font-bold text-white">Notification Preferences</h2>
                                <p className="text-xs text-text-muted mt-0.5">Control app and email alerts for your account.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(false)}
                                className="h-8 w-8 rounded-lg border border-white/10 bg-background/40 text-text-muted hover:text-white hover:bg-white/5 flex items-center justify-center"
                                aria-label="Close settings"
                            >
                                <span className="material-icons-round text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="rounded-lg border border-white/10 bg-background/30 p-3 space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">In-App Alerts</p>
                                <PreferenceToggle
                                    label="Announcements"
                                    active={Boolean(preferences.appAnnouncements)}
                                    disabled={prefSavingKey === 'appAnnouncements'}
                                    onToggle={() => handleTogglePreference('appAnnouncements')}
                                />
                                <PreferenceToggle
                                    label="Class Reminders"
                                    active={Boolean(preferences.appReminders)}
                                    disabled={prefSavingKey === 'appReminders'}
                                    onToggle={() => handleTogglePreference('appReminders')}
                                />
                                <PreferenceToggle
                                    label="Payment Receipts"
                                    active={Boolean(preferences.appReceipts)}
                                    disabled={prefSavingKey === 'appReceipts'}
                                    onToggle={() => handleTogglePreference('appReceipts')}
                                />
                            </div>

                            <div className="rounded-lg border border-white/10 bg-background/30 p-3 space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Email Notifications</p>
                                <PreferenceToggle
                                    label="Announcements"
                                    active={Boolean(preferences.emailAnnouncements)}
                                    disabled={prefSavingKey === 'emailAnnouncements'}
                                    onToggle={() => handleTogglePreference('emailAnnouncements')}
                                />
                                <PreferenceToggle
                                    label="Class Reminders"
                                    active={Boolean(preferences.emailReminders)}
                                    disabled={prefSavingKey === 'emailReminders'}
                                    onToggle={() => handleTogglePreference('emailReminders')}
                                />
                                <PreferenceToggle
                                    label="Payment Receipts"
                                    active={Boolean(preferences.emailReceipts)}
                                    disabled={prefSavingKey === 'emailReceipts'}
                                    onToggle={() => handleTogglePreference('emailReceipts')}
                                />
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function PreferenceToggle({ label, active, disabled, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className="w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
            <span className="text-xs text-white font-medium">{label}</span>
            <span
                className={`inline-flex h-6 w-11 items-center rounded-full border px-1 transition-colors ${active ? 'border-primary/60 bg-primary/20 justify-end' : 'border-white/20 bg-white/5 justify-start'}`}
                aria-hidden="true"
            >
                <span className={`h-4 w-4 rounded-full ${active ? 'bg-primary' : 'bg-white/60'}`} />
            </span>
        </button>
    );
}
