import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, Calendar, Clock, Pin, AlertCircle, Send, Trash2, Plus, X, Tag, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function Announcements() {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [classes, setClasses] = useState([]);

    // New Announcement Form
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'INFO', // INFO, ALERT, PROMO
        targetGroup: 'ALL', // ALL, STAFF, TRAINER, CLASS
        targetId: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, id: null, isDeleting: false });
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const isStaff = [ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF].includes(user?.role);

    useEffect(() => {
        fetchAnnouncements();
        if (isStaff) fetchClasses();
    }, [isStaff]);

    const fetchAnnouncements = async () => {
        try {
            const res = await axios.get('/api/notifications');
            setAnnouncements(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch announcements");
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const res = await axios.get('/api/classes');
            setClasses(res.data);
        } catch (error) {
            console.error("Failed to fetch classes");
        }
    };

    const handleCreateAnnouncement = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await axios.post('/api/notifications/broadcast', formData);
            setFormData({ title: '', message: '', type: 'INFO', targetGroup: 'ALL', targetId: null });
            setShowCreateModal(false);
            fetchAnnouncements();
        } catch (error) {
            console.error("Failed to create announcement");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const { id } = deleteConfig;
        setDeleteConfig(prev => ({ ...prev, isDeleting: true }));
        try {
            await axios.delete(`/api/notifications/${id}`);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            setDeleteConfig({ isOpen: false, id: null, isDeleting: false });
        } catch (error) {
            console.error("Failed to delete notification");
            setDeleteConfig(prev => ({ ...prev, isDeleting: false }));
        }
    };

    const handleMarkAllRead = async () => {
        setIsMarkingAll(true);
        try {
            await axios.patch('/api/notifications/read-all');
            setAnnouncements(prev => prev.map(a => ({ ...a, isRead: true })));
            setIsConfirmOpen(false);
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        } finally {
            setIsMarkingAll(false);
        }
    };

    const handleMarkAsRead = async (id, isRead) => {
        if (isRead) return;
        try {
            await axios.patch(`/api/notifications/${id}/read`);
            setAnnouncements(prev => 
                prev.map(a => a.id === id ? { ...a, isRead: true } : a)
            );
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'INVALID DATE';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'INVALID DATE';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getCategoryColor = (category) => {
        const colors = {
            INFO: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            PROMO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            ALERT: 'bg-red-500/10 text-red-400 border-red-500/30',
        };
        return colors[category] || colors.INFO;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            </div>
        );
    }

    return (
        <>
            <div className="pb-20 px-4 max-w-5xl mx-auto animate-fade-in text-white/90">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 mt-4">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center border border-primary/20 shadow-xl shadow-primary/5">
                        <Megaphone className="text-primary" size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">News & Broadcasts</h1>
                        <p className="text-text-muted text-xs font-black uppercase tracking-[0.2em] mt-2 italic">Stay synced with the gym community</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsConfirmOpen(true)}
                        className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-white transition-all active:scale-95"
                        title="Mark all as read"
                    >
                        <CheckCheck size={20} className={announcements.some(a => !a.isRead) ? "text-primary animate-pulse" : ""} />
                    </button>
                    {isStaff && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-primary hover:bg-orange-600 text-white font-black py-4 px-8 rounded-2xl shadow-2xl shadow-primary/20 flex items-center gap-3 transition-all active:scale-95 uppercase text-xs tracking-widest"
                        >
                            <Plus size={18} />
                            New Broadcast
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-2">
                {['all', 'INFO', 'ALERT', 'PROMO'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filter === f
                            ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20'
                            : 'bg-surface text-text-muted border-white/5 hover:bg-white/5'
                            }`}
                    >
                        {f === 'all' ? 'All Broadcasts' : `${f} ONLY`}
                    </button>
                ))}
            </div>

            {/* Announcements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {announcements
                    .filter(a => a.isAnnouncement && (filter === 'all' || a.type === filter))
                    .map(announcement => (
                        <div
                            key={announcement.id}
                            onClick={() => handleMarkAsRead(announcement.id, announcement.isRead)}
                            className={`bg-surface border rounded-[2.5rem] p-8 hover:border-white/10 transition-all group relative overflow-hidden flex flex-col cursor-pointer ${
                                announcement.isRead ? 'border-white/5 opacity-80' : 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-2 items-center">
                                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getCategoryColor(announcement.type)}`}>
                                        {announcement.type}
                                    </span>
                                    {!announcement.isRead && (
                                        <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                                    )}
                                </div>
                                <div className="text-text-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={12} className="text-primary" />
                                    {formatDate(announcement.createdAt || announcement.date)}
                                </div>
                            </div>

                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4 group-hover:text-primary transition-colors leading-none">
                                {announcement.title}
                            </h3>

                            <p className="text-text-secondary text-sm leading-relaxed mb-6 font-medium flex-1">
                                {announcement.message}
                            </p>

                            <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                <span className="text-text-muted text-[9px] font-black uppercase tracking-[0.2em] italic">Channel: FitOS Core</span>
                                {isStaff && (
                                    <button 
                                        onClick={() => setDeleteConfig({ isOpen: true, id: announcement.id, isDeleting: false })}
                                        className="text-red-500/50 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                {announcements.length === 0 && (
                    <div className="col-span-full text-center py-32 bg-white/[0.01] rounded-[3rem] border border-white/5 border-dashed">
                        <AlertCircle className="text-text-muted/10 mx-auto mb-6" size={64} />
                        <h4 className="text-3xl font-black text-white/10 uppercase tracking-tighter italic leading-none">Quiet for now...</h4>
                        <p className="text-text-muted/20 text-xs font-black uppercase tracking-widest mt-4">Check back later for important updates</p>
                    </div>
                )}
            </div>
            </div>

            {/* Create Announcement Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Overlay Backdrop */}
                    <div 
                        className="fixed inset-0 bg-background/90 backdrop-blur-2xl" 
                        onClick={() => setShowCreateModal(false)}
                    />
                    
                    {/* Modal Surface */}
                    <div className="bg-surface w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[3rem] border border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 scrollbar-thin scrollbar-thumb-white/10">
                        <div className="p-8 sm:p-10">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">New Broadcast</h2>
                                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mt-2 italic">Send announcement to all members</p>
                                </div>
                                <button 
                                    onClick={() => setShowCreateModal(false)} 
                                    className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all text-white"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Broadcast Form */}
                            <form onSubmit={handleCreateAnnouncement} className="space-y-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4 italic">Broadcast Title</label>
                                    <input
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/30 font-bold"
                                        placeholder="e.g. System Maintenance Update"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4 italic">Broadcast Category</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['INFO', 'PROMO', 'ALERT'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, type })}
                                                className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.type === type
                                                    ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10'
                                                    : 'bg-white/[0.03] border-white/10 text-text-muted hover:border-white/20'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4 italic">Target Audience</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'ALL', label: 'All Members' },
                                            { id: 'STAFF', label: 'Staff Only' },
                                            { id: 'TRAINER', label: 'Trainers Only' },
                                            { id: 'CLASS', label: 'Specific Class' }
                                        ].map(group => (
                                            <button
                                                key={group.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, targetGroup: group.id, targetId: null })}
                                                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.targetGroup === group.id
                                                    ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10'
                                                    : 'bg-white/[0.03] border-white/10 text-text-muted hover:border-white/20'
                                                }`}
                                            >
                                                {group.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {formData.targetGroup === 'CLASS' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4 italic">Select Target Class</label>
                                        <select
                                            required
                                            value={formData.targetId || ''}
                                            onChange={e => setFormData({ ...formData, targetId: e.target.value })}
                                            className="w-full bg-white/[0.03] border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-primary/50 transition-all font-bold appearance-none cursor-pointer"
                                        >
                                            <option value="" className="bg-surface text-text-muted">Choose a class...</option>
                                            {classes.map(c => (
                                                <option key={c.id} value={c.id} className="bg-surface text-white">
                                                    {c.name} ({c.time} - {c.dayOfWeek})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-4 italic">Detailed Message</label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={formData.message}
                                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-primary/50 transition-all placeholder:text-text-muted/30 font-medium scrollbar-thin scrollbar-thumb-white/10 resize-none"
                                        placeholder="Type your message here..."
                                    />
                                </div>

                                <button
                                    disabled={isSubmitting}
                                    type="submit"
                                    className="w-full bg-primary hover:bg-orange-600 disabled:opacity-50 text-white font-black py-5 rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95 uppercase text-xs tracking-[0.3em] mt-4"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Send size={18} />
                                            {formData.targetGroup === 'ALL' ? 'Send to All Members' : `Broadcast to ${formData.targetGroup}`}
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog 
                isOpen={deleteConfig.isOpen}
                title="Delete Broadcast?"
                message="This will permanently remove this announcement for all targeted members. This action cannot be undone."
                confirmLabel={deleteConfig.isDeleting ? "Deleting..." : "Delete Permanently"}
                cancelLabel="Keep It"
                type="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfig({ isOpen: false, id: null, isDeleting: false })}
            />

            <ConfirmDialog 
                isOpen={isConfirmOpen}
                title="Mark all as read?"
                message="This will mark all notifications as seen."
                confirmLabel={isMarkingAll ? "Marking..." : "Mark All Read"}
                cancelLabel="Cancel"
                onConfirm={handleMarkAllRead}
                onCancel={() => setIsConfirmOpen(false)}
            />

            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </>
    );
}
