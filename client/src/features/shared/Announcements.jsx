import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'INFO', label: 'Info' },
    { key: 'ALERT', label: 'Alert' },
    { key: 'PROMO', label: 'Promo' }
];

const CATEGORY_STYLES = {
    INFO: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    ALERT: 'bg-red-500/10 text-red-300 border-red-500/30',
    PROMO: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
};

const TARGET_GROUPS = [
    { key: 'ALL', label: 'All Members' },
    { key: 'STAFF', label: 'Staff Only' },
    { key: 'TRAINER', label: 'Trainers Only' },
    { key: 'CLASS', label: 'Specific Class' }
];

const ANNOUNCEMENT_TYPES = new Set(['INFO', 'ALERT', 'PROMO', 'ANNOUNCEMENT']);

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

const isBroadcastAnnouncement = (item) => {
    const type = String(item?.type || '').toUpperCase();
    const targetGroup = String(item?.targetGroup || '').toUpperCase();
    return Boolean(item?.isAnnouncement) && ANNOUNCEMENT_TYPES.has(type) && targetGroup !== 'PRIVATE';
};

export default function Announcements() {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [classes, setClasses] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'INFO',
        targetGroup: 'ALL',
        targetId: null
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfig, setDeleteConfig] = useState({
        isOpen: false,
        id: null,
        isDeleting: false
    });

    const isStaff = [ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF].includes(user?.role);

    useEffect(() => {
        fetchAnnouncements();
        if (isStaff) fetchClasses();
    }, [isStaff]);

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

    const fetchClasses = async () => {
        try {
            const res = await axios.get('/api/classes');
            setClasses(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch classes', error);
        }
    };

    const allAnnouncements = useMemo(() => (
        announcements
            .filter((item) => isBroadcastAnnouncement(item))
            .sort((a, b) => new Date(b?.createdAt || b?.date || 0) - new Date(a?.createdAt || a?.date || 0))
    ), [announcements]);

    const filteredAnnouncements = useMemo(() => (
        allAnnouncements.filter((item) => filter === 'all' || String(item?.type || '').toUpperCase() === filter)
    ), [allAnnouncements, filter]);

    const alertCount = useMemo(
        () => allAnnouncements.filter((item) => String(item?.type || '').toUpperCase() === 'ALERT').length,
        [allAnnouncements]
    );

    const infoCount = useMemo(
        () => allAnnouncements.filter((item) => String(item?.type || '').toUpperCase() === 'INFO').length,
        [allAnnouncements]
    );

    const handleCreateAnnouncement = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await axios.post('/api/notifications/broadcast', formData);
            setFormData({
                title: '',
                message: '',
                type: 'INFO',
                targetGroup: 'ALL',
                targetId: null
            });
            setShowCreateModal(false);
            fetchAnnouncements();
        } catch (error) {
            console.error('Failed to create announcement', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const { id } = deleteConfig;
        if (!id) return;

        setDeleteConfig((prev) => ({ ...prev, isDeleting: true }));
        try {
            await axios.delete(`/api/notifications/${id}`);
            setAnnouncements((prev) => prev.filter((item) => item.id !== id));
            setDeleteConfig({ isOpen: false, id: null, isDeleting: false });
        } catch (error) {
            console.error('Failed to delete notification', error);
            setDeleteConfig((prev) => ({ ...prev, isDeleting: false }));
        }
    };

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
        <>
            <div className="space-y-6 animate-fade-in">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Announcements</h1>
                        <p className="text-sm text-text-muted mt-1">
                            Manage and publish broadcast announcements for your gym audience.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isStaff && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                            >
                                <span className="material-icons-round text-[18px]">campaign</span>
                                New Announcement
                            </button>
                        )}
                    </div>
                </header>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-surface px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-text-muted">Total Broadcasts</p>
                        <p className="mt-1 text-xl font-bold text-white">{allAnnouncements.length}</p>
                    </div>
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-blue-200">Info Posts</p>
                        <p className="mt-1 text-xl font-bold text-blue-200">{infoCount}</p>
                    </div>
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-red-200">Alert Posts</p>
                        <p className="mt-1 text-xl font-bold text-red-200">{alertCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-surface px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-text-muted">Visible List</p>
                        <p className="mt-1 text-xl font-bold text-white">{filteredAnnouncements.length}</p>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-surface p-4">
                    <div className="flex flex-wrap gap-2">
                        {FILTERS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${filter === tab.key
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-white/5 text-text-muted border-white/10 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </section>

                {filteredAnnouncements.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-surface p-10 text-center">
                        <span className="material-icons-round text-text-muted text-4xl">inbox</span>
                        <p className="text-text-muted text-sm mt-2">No announcements found for this filter.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAnnouncements.map((announcement) => {
                            const type = String(announcement?.type || 'INFO').toUpperCase();
                            const badgeClass = CATEGORY_STYLES[type] || CATEGORY_STYLES.INFO;
                            const timestamp = announcement?.createdAt || announcement?.date;
                            const targetGroup = String(announcement?.targetGroup || 'ALL').toUpperCase();
                            const audienceLabel = targetGroup === 'CLASS'
                                ? `Class ${announcement?.targetId || ''}`.trim()
                                : targetGroup;

                            return (
                                <article
                                    key={announcement.id}
                                    className="rounded-2xl border border-white/10 bg-surface p-4 transition-colors"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                                                    {type}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                                    Audience: {audienceLabel}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                                                    <span className="material-icons-round text-[14px]">schedule</span>
                                                    {formatDateTime(timestamp)}
                                                </span>
                                            </div>

                                            <h3 className="text-base font-bold text-white">
                                                {announcement?.title || 'Announcement'}
                                            </h3>
                                            <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">
                                                {announcement?.message || 'No message provided.'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 sm:pl-4">
                                            {isStaff && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfig({ isOpen: true, id: announcement.id, isDeleting: false });
                                                    }}
                                                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-red-300 hover:bg-red-500/20 transition-colors"
                                                    title="Delete announcement"
                                                >
                                                    <span className="material-icons-round text-[16px]">delete</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowCreateModal(false)}
                        aria-label="Close create announcement modal"
                    />

                    <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div>
                                <h2 className="text-xl font-bold text-white">Create Announcement</h2>
                                <p className="text-xs text-text-muted mt-1">Compose and publish a broadcast update.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10"
                            >
                                <span className="material-icons-round text-[18px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">Title</label>
                                <input
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-primary"
                                    placeholder="Example: Updated Class Schedule"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {['INFO', 'ALERT', 'PROMO'].map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, type }))}
                                            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${formData.type === type
                                                ? 'border-primary bg-primary/20 text-primary'
                                                : 'border-white/10 bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">Target Group</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TARGET_GROUPS.map((group) => (
                                        <button
                                            key={group.key}
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, targetGroup: group.key, targetId: null }))}
                                            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${formData.targetGroup === group.key
                                                ? 'border-primary bg-primary/20 text-primary'
                                                : 'border-white/10 bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            {group.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {formData.targetGroup === 'CLASS' && (
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">Class</label>
                                    <select
                                        required
                                        value={formData.targetId || ''}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, targetId: e.target.value }))}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-primary"
                                    >
                                        <option value="">Select class</option>
                                        {classes.map((classItem) => (
                                            <option key={classItem.id} value={classItem.id}>
                                                {classItem.name} ({classItem.dayOfWeek} - {classItem.time})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">Message</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={formData.message}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-primary resize-none"
                                    placeholder="Type the full announcement message..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-[18px]">send</span>
                                        Publish Announcement
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deleteConfig.isOpen}
                title="Delete Announcement?"
                message="This announcement will be removed permanently for all recipients."
                confirmLabel={deleteConfig.isDeleting ? 'Deleting...' : 'Delete'}
                cancelLabel="Cancel"
                type="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfig({ isOpen: false, id: null, isDeleting: false })}
            />
        </>
    );
}
