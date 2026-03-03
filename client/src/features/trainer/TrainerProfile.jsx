import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function TrainerProfile() {
    const { user, logout } = useAuth();
    const [trainer, setTrainer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        phone: '',
        email: '',
        bio: ''
    });

    useEffect(() => {
        const fetchTrainer = async () => {
            try {
                const res = await axios.get('/api/trainer/me');
                setTrainer(res.data);
                setEditForm({
                    phone: res.data?.phone || '',
                    email: res.data?.email || '',
                    bio: res.data?.bio || ''
                });
            } catch (e) {
                console.error('Failed to fetch trainer profile', e);
            } finally {
                setLoading(false);
            }
        };

        fetchTrainer();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20 px-4 max-w-2xl mx-auto">
            <div className="flex justify-between items-start gap-3 pt-4">
                <div>
                    <h1 className="text-xl font-bold text-white">Trainer Profile</h1>
                    <p className="text-text-muted text-xs mt-0.5">Manage your trainer account</p>
                </div>
                <button
                    onClick={logout}
                    className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all text-xs font-bold flex-shrink-0 border border-red-500/20"
                >
                    Sign Out
                </button>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                        {trainer?.imageUrl ? (
                            <img src={trainer.imageUrl} alt={trainer.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-icons-round text-3xl text-text-muted">person</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">{trainer?.name || user?.name || 'Trainer'}</h2>
                        <p className="text-text-muted text-sm">{trainer?.specialty || 'Trainer'}</p>
                        <p className="text-primary text-xs mt-1">Trainer ID #{trainer?.id || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Details</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="material-icons-round text-primary text-lg">email</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-text-muted text-xs font-medium mb-0.5">Email</p>
                                <p className="text-white font-medium truncate text-sm">{trainer?.email || user?.email || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-primary text-xl mb-2">badge</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Account Type</p>
                            <p className="text-white font-bold text-sm uppercase">Trainer</p>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-emerald-400 text-xl mb-2">check_circle</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Status</p>
                            <p className="text-emerald-400 font-bold text-sm">Active</p>
                        </div>
                    </div>

                    <div className="col-span-2 bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="material-icons-round text-primary text-lg">call</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-text-muted text-xs font-medium mb-0.5">Phone</p>
                                <p className="text-white font-medium truncate text-sm">{trainer?.phone || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Bio</h3>
                <div className="bg-surface rounded-xl border border-white/5 p-4 text-text-muted text-sm leading-relaxed">
                    {trainer?.bio || 'No bio yet.'}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center"
                    >
                        <span className="material-icons-round text-primary text-xl block mb-1">edit</span>
                        <span className="text-xs font-medium text-white block">Edit Details</span>
                    </button>
                    <a href="/trainer/sessions" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">event</span>
                        <span className="text-xs font-medium text-white block">My Sessions</span>
                    </a>
                    <a href="/trainer/availability" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">schedule</span>
                        <span className="text-xs font-medium text-white block">Availability</span>
                    </a>
                </div>
            </div>

            <div className="text-center py-4">
                <p className="text-text-muted text-xs">FitOS v1.0.0</p>
            </div>

            {showEditModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Edit Trainer Details</h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                            >
                                <span className="material-icons-round text-white/70">close</span>
                            </button>
                        </div>
                        <form className="space-y-3">
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                                disabled
                            />
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Phone"
                                value={editForm.phone}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                            />
                            <textarea
                                rows={4}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Bio"
                                value={editForm.bio}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                            />
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-text-muted hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-primary text-background font-bold"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                        <p className="text-xs text-text-muted mt-3">
                            Editing is UI-only for now. Tell me if you want trainer profile updates saved to the server.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
