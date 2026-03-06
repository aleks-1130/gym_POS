import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import TrainerAvailability from './TrainerAvailability';

const REQUEST_FIELD_LABELS = {
    specialization: 'Specialization',
    specialties: 'Specialties',
    cardImageUrl: 'Card Image',
    statusDescription: 'Status Description',
    bio: 'Bio',
    sessionPrice: 'Session Price'
};

const getRequestStatusClass = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PENDING_ADMIN' || normalized === 'PENDING_OWNER') return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
    if (normalized === 'APPLIED') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    return 'bg-red-500/10 border-red-500/30 text-red-300';
};

const getRequestStatusLabel = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PENDING_ADMIN' || normalized === 'PENDING_OWNER') return 'Pending Admin Review';
    if (normalized === 'APPLIED') return 'Approved & Applied';
    if (normalized === 'REJECTED') return 'Rejected';
    return normalized || 'Unknown';
};

const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const getTrainerSpecialties = (trainer) => {
    if (!trainer?.specialties) return [];
    if (Array.isArray(trainer.specialties)) return trainer.specialties;
    if (typeof trainer.specialties === 'string') {
        return trainer.specialties.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
};

const formatCurrency = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'PHP 0.00';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(numeric);
};

const toRequestedFieldsLabel = (payload) => {
    const keys = Object.keys(payload || {});
    if (keys.length === 0) return 'N/A';
    return keys.map((key) => REQUEST_FIELD_LABELS[key] || key).join(', ');
};

export default function TrainerProfile() {
    const { user } = useAuth();
    const { alert: showAlert } = useConfirm();
    const [trainer, setTrainer] = useState(null);
    const [changeRequests, setChangeRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [submittingRequest, setSubmittingRequest] = useState(false);
    const [showMemberCardPreview, setShowMemberCardPreview] = useState(false);
    const [editForm, setEditForm] = useState({
        specialization: '',
        specialties: '',
        cardImageUrl: '',
        statusDescription: '',
        bio: '',
        sessionPrice: ''
    });

    const hasPendingRequest = useMemo(() => {
        return changeRequests.some((request) => ['PENDING_ADMIN', 'PENDING_OWNER'].includes(String(request.status || '').toUpperCase()));
    }, [changeRequests]);

    const previewTrainer = useMemo(() => {
        const base = trainer || {};
        const parsedPrice = Number(editForm.sessionPrice);
        return {
            ...base,
            specialization: editForm.specialization,
            specialties: editForm.specialties,
            cardImageUrl: editForm.cardImageUrl,
            statusDescription: editForm.statusDescription,
            bio: editForm.bio,
            sessionPrice: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : Number(base.sessionPrice || 0)
        };
    }, [trainer, editForm]);

    const previewSpecialties = useMemo(() => getTrainerSpecialties(previewTrainer), [previewTrainer]);

    const loadProfile = async () => {
        let res = null;
        try {
            res = await axios.get('/api/trainer/me', { headers: getAuthHeaders() });
        } catch (primaryError) {
            const status = Number(primaryError?.response?.status || 0);
            if (status === 404 || status === 405) {
                res = await axios.get('/api/trainers/me', { headers: getAuthHeaders() });
            } else {
                throw primaryError;
            }
        }
        setTrainer(res.data);
        setEditForm({
            specialization: res.data?.specialization || '',
            specialties: res.data?.specialties || '',
            cardImageUrl: res.data?.cardImageUrl || '',
            statusDescription: res.data?.statusDescription || '',
            bio: res.data?.bio || '',
            sessionPrice: String(res.data?.sessionPrice ?? '')
        });
    };

    const loadRequests = async () => {
        setRequestsLoading(true);
        try {
            let res = null;
            try {
                res = await axios.get('/api/trainer/me/profile-change-requests', { headers: getAuthHeaders() });
            } catch (primaryError) {
                const status = Number(primaryError?.response?.status || 0);
                if (status === 404 || status === 405) {
                    res = await axios.get('/api/trainers/me/profile-change-requests', { headers: getAuthHeaders() });
                } else {
                    throw primaryError;
                }
            }
            setChangeRequests(Array.isArray(res.data) ? res.data : []);
        } catch {
            setChangeRequests([]);
        } finally {
            setRequestsLoading(false);
        }
    };

    useEffect(() => {
        const bootstrap = async () => {
            try {
                await Promise.all([loadProfile(), loadRequests()]);
            } catch (e) {
                console.error('Failed to fetch trainer profile', e);
            } finally {
                setLoading(false);
            }
        };

        bootstrap();
    }, []);

    const handleSubmitChangeRequest = async () => {
        const parsedSessionPrice = Number(editForm.sessionPrice);
        const payload = {
            specialization: editForm.specialization,
            specialties: editForm.specialties,
            cardImageUrl: editForm.cardImageUrl,
            statusDescription: editForm.statusDescription,
            bio: editForm.bio
        };
        if (Number.isFinite(parsedSessionPrice) && parsedSessionPrice > 0) {
            payload.sessionPrice = parsedSessionPrice;
        }

        setSubmittingRequest(true);
        try {
            try {
                await axios.post('/api/trainer/me/profile-change-requests', payload, {
                    headers: getAuthHeaders()
                });
            } catch (primaryError) {
                const status = Number(primaryError?.response?.status || 0);
                if (status === 404 || status === 405) {
                    await axios.post('/api/trainers/me/profile-change-requests', payload, {
                        headers: getAuthHeaders()
                    });
                } else {
                    throw primaryError;
                }
            }
            await showAlert({
                title: 'Request Submitted',
                message: 'Your member-card update was sent for admin approval.',
                type: 'success'
            });
            setShowEditModal(false);
            await loadRequests();
        } catch (e) {
            await showAlert({
                title: 'Submit Failed',
                message: e?.response?.data?.error || 'Failed to submit change request',
                type: 'danger'
            });
        } finally {
            setSubmittingRequest(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const bookingStatusLabel = String(previewTrainer?.bookingStatus || 'OPEN').toUpperCase();
    const bookingStatusOpen = bookingStatusLabel === 'OPEN';

    return (
        <div className="space-y-4 pb-28 px-4 max-w-5xl mx-auto">
            <header className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                        <span className="material-icons-round text-base text-white/80">badge</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-base font-bold text-white truncate">My Profile</h1>
                        <p className="text-[11px] text-text-muted">Trainer Workspace</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                        aria-label="Request card update"
                    >
                        <span className="material-icons-round text-lg text-white/80">edit</span>
                    </button>
                </div>
            </header>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-primary/20 via-surface to-surface p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-primary/40 bg-white/5 flex items-center justify-center flex-shrink-0">
                        {trainer?.imageUrl ? (
                            <img src={trainer.imageUrl} alt="Trainer profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-icons-round text-3xl text-text-muted">person</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">{trainer?.name || user?.name || 'Trainer'}</h2>
                        <p className="text-xs text-text-muted">{previewTrainer?.specialization || 'Certified Personal Trainer'}</p>
                        <span className="inline-flex mt-1.5 items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 text-[10px] font-semibold text-emerald-300">
                            <span className="material-icons-round text-xs">verified</span>
                            Verified
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-3 text-center">
                        <p className="text-sm font-bold text-white truncate">ID {trainer?.id || 'N/A'}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Trainer ID</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-3 text-center">
                        <p className={`text-sm font-bold ${bookingStatusOpen ? 'text-emerald-300' : 'text-red-300'}`}>{bookingStatusLabel}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Status</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-3 text-center">
                        <p className="text-sm font-bold text-primary truncate">{formatCurrency(previewTrainer?.sessionPrice ?? 0)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Per Session</p>
                    </div>
                </div>
            </section>

            {hasPendingRequest && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 flex items-start gap-2">
                    <span className="material-icons-round text-amber-300 text-base mt-[1px]">info</span>
                    <p className="text-xs text-amber-300 font-medium leading-5">You have a pending member-card update request under review.</p>
                </div>
            )}

            <section className="bg-surface rounded-2xl p-4 sm:p-5 border border-white/5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-white">Credentials</h2>
                        <p className="text-xs text-text-muted mt-0.5">Internal account information</p>
                    </div>
                    <span className="px-2 py-1 rounded-md border border-white/10 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                        Trainer
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2 lg:col-span-1">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Profile Picture</p>
                        <div className="aspect-square max-w-[170px] rounded-lg overflow-hidden border border-white/10 bg-white/5 mx-auto sm:mx-0">
                            {trainer?.imageUrl ? (
                                <img src={trainer.imageUrl} alt="Trainer profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="material-icons-round text-3xl text-text-muted">person</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2 lg:col-span-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
                                <p className="text-[11px] text-text-muted">Full Name</p>
                                <p className="text-white font-bold text-base mt-0.5">{trainer?.name || user?.name || 'Trainer'}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
                                <p className="text-[11px] text-text-muted">Trainer ID</p>
                                <p className="text-white font-semibold text-sm mt-0.5">{trainer?.id || 'N/A'}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
                                <p className="text-[11px] text-text-muted">Email</p>
                                <p className="text-white font-semibold text-sm mt-0.5 truncate">{trainer?.email || 'N/A'}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
                                <p className="text-[11px] text-text-muted">Phone</p>
                                <p className="text-white font-semibold text-sm mt-0.5">{trainer?.phone || 'N/A'}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
                                <p className="text-[11px] text-text-muted">Rating</p>
                                <p className="text-white font-semibold text-sm mt-0.5">{trainer?.rating || 'N/A'}</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
                                <p className="text-[11px] text-text-muted">Experience</p>
                                <p className="text-white font-semibold text-sm mt-0.5">{trainer?.experience ? `${trainer.experience} years` : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-surface rounded-2xl p-4 sm:p-5 border border-white/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-white">Member Card</h2>
                        <p className="text-xs text-text-muted mt-0.5">Visible to gym members</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4">
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-text-muted text-xs font-medium mb-1">Specialization</p>
                                <p className="text-white font-semibold text-sm">{previewTrainer?.specialization || 'Personal Trainer'}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-text-muted text-xs font-medium mb-1">Session Price</p>
                                <p className="text-white font-semibold text-sm">{formatCurrency(previewTrainer?.sessionPrice ?? 0)}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-text-muted text-xs font-medium mb-1">Status</p>
                                <p className={`font-bold text-sm ${bookingStatusOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {bookingStatusLabel}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-text-muted text-xs font-medium mb-1">Specialties</p>
                                <p className="text-white text-sm">{previewSpecialties.length > 0 ? previewSpecialties.join(', ') : 'N/A'}</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                            <p className="text-text-muted text-xs font-medium">Status Description</p>
                            <p className="text-white text-sm break-words [overflow-wrap:anywhere]">
                                {previewTrainer?.statusDescription || 'No status description set.'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                            <p className="text-text-muted text-xs font-medium">Bio</p>
                            <p className="text-white/90 text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
                                {previewTrainer?.bio || 'No bio yet.'}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Card Picture</p>
                        <div className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5">
                            {previewTrainer?.cardImageUrl ? (
                                <img src={previewTrainer.cardImageUrl} alt="Member card" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="material-icons-round text-2xl text-text-muted">image</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-text-muted">Member Card Preview</p>
                            <p className="text-xs text-text-muted mt-0.5">Show member view</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={showMemberCardPreview}
                            onClick={() => setShowMemberCardPreview((prev) => !prev)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${showMemberCardPreview ? 'bg-primary' : 'bg-white/15'}`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${showMemberCardPreview ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>
                </div>

                {showMemberCardPreview && (
                    <div className="max-w-md mx-auto lg:mx-0">
                        <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                            <div className="aspect-[4/3] sm:aspect-square bg-white/5 overflow-hidden relative">
                                {previewTrainer?.cardImageUrl ? (
                                    <img
                                        src={previewTrainer.cardImageUrl}
                                        alt={previewTrainer.name || user?.name || 'Trainer'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                        <span className="material-icons-round text-6xl text-primary/30">person</span>
                                    </div>
                                )}

                                {previewTrainer?.rating && (
                                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1">
                                        <span className="material-icons-round text-base text-yellow-400">star</span>
                                        <span className="text-white font-bold text-sm">{previewTrainer.rating}</span>
                                    </div>
                                )}

                                {previewTrainer?.experience && (
                                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md rounded-lg px-3 py-1.5">
                                        <span className="text-white font-medium text-xs">{previewTrainer.experience}y exp</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 sm:p-5 flex flex-col flex-1">
                                <div className="mb-3">
                                    <h3 className="font-bold text-white text-lg sm:text-xl">{previewTrainer?.name || user?.name || 'Trainer'}</h3>
                                    <p className="text-text-muted text-sm mt-0.5 break-words [overflow-wrap:anywhere]">{previewTrainer?.specialization || 'Personal Trainer'}</p>
                                    {previewTrainer?.statusDescription && (
                                        <p className="text-xs text-white/70 mt-2 line-clamp-2 break-words [overflow-wrap:anywhere]">{previewTrainer.statusDescription}</p>
                                    )}
                                </div>

                                {previewTrainer?.bio && (
                                    <p className="text-text-muted text-sm mb-3 line-clamp-2 leading-relaxed break-words [overflow-wrap:anywhere]">{previewTrainer.bio}</p>
                                )}

                                {previewSpecialties.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {previewSpecialties.slice(0, 3).map((specialty, idx) => (
                                            <span key={idx} className="bg-white/10 text-text-secondary px-2.5 py-1 rounded-md text-xs font-medium">
                                                {specialty}
                                            </span>
                                        ))}
                                        {previewSpecialties.length > 3 && (
                                            <span className="text-text-muted text-xs py-1 px-1">+{previewSpecialties.length - 3} more</span>
                                        )}
                                    </div>
                                )}

                                <div className="mt-auto space-y-3">
                                    <div className="flex justify-between items-center py-2 border-t border-white/5">
                                        <span className="text-text-muted text-sm">Per Session (60 min)</span>
                                        <span className="text-primary font-bold text-xl">{formatCurrency(previewTrainer?.sessionPrice ?? 0)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-text-muted">Booking Status</span>
                                        <span className={`font-bold ${bookingStatusOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {bookingStatusLabel}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="px-1">
                    <h3 className="text-sm font-bold text-white">Availability</h3>
                    <p className="text-xs text-text-muted mt-0.5">Manage your weekly schedule and date exceptions here.</p>
                </div>
                <TrainerAvailability embedded allowBookingStatusChange />
            </section>

            <section className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">Update Requests</h3>
                    <p className="text-xs text-text-muted mt-0.5">Change request history</p>
                </div>
                <div className="p-3 space-y-2">
                    {requestsLoading && (
                        <div className="px-2 py-2 text-sm text-text-muted">Loading requests...</div>
                    )}
                    {!requestsLoading && changeRequests.length === 0 && (
                        <div className="px-2 py-2 text-sm text-text-muted">No requests submitted yet.</div>
                    )}
                    {!requestsLoading && changeRequests.map((request) => (
                        <div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs text-text-muted">{new Date(request.createdAt).toLocaleString()}</p>
                                <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${getRequestStatusClass(request.status)}`}>
                                    {getRequestStatusLabel(request.status)}
                                </span>
                            </div>
                            <p className="text-xs text-white/80 mt-2">Fields: {toRequestedFieldsLabel(request.payload)}</p>
                        </div>
                    ))}
                </div>
            </section>

            <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="fixed right-4 bottom-24 z-30 w-14 h-14 rounded-2xl bg-primary text-background shadow-lg shadow-primary/30 hover:brightness-110 flex items-center justify-center"
                aria-label="Request card update"
            >
                <span className="material-icons-round text-2xl">edit</span>
            </button>

            {showEditModal && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowEditModal(false)}
                        aria-label="Close request modal"
                    />
                    <div className="fixed inset-x-0 bottom-0 z-[60] bg-surface border-t border-white/10 rounded-t-3xl p-4 sm:max-w-xl sm:mx-auto sm:bottom-4 sm:rounded-2xl">
                        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-white">Request Card Update</h3>
                            <p className="text-xs text-text-muted">Submit changes for admin approval</p>
                        </div>
                        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Specialization"
                                value={editForm.specialization}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, specialization: e.target.value }))}
                            />
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Specialties (comma-separated)"
                                value={editForm.specialties}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, specialties: e.target.value }))}
                            />
                            <input
                                type="number"
                                min="1"
                                step="0.01"
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Session Price"
                                value={editForm.sessionPrice}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, sessionPrice: e.target.value }))}
                            />
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Card Image URL"
                                value={editForm.cardImageUrl}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, cardImageUrl: e.target.value }))}
                            />
                            <textarea
                                rows={2}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Status description (shown to members)"
                                value={editForm.statusDescription}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, statusDescription: e.target.value }))}
                            />
                            <textarea
                                rows={4}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Bio"
                                value={editForm.bio}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                            />
                            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs text-text-muted">
                                This request only updates member-facing trainer card details. Admin approval is required before changes are applied.
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="py-2.5 rounded-xl bg-white/5 text-text-muted hover:text-white"
                                disabled={submittingRequest}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitChangeRequest}
                                className="py-2.5 rounded-xl bg-primary text-background font-bold disabled:opacity-60"
                                disabled={submittingRequest}
                            >
                                {submittingRequest ? 'Submitting...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
