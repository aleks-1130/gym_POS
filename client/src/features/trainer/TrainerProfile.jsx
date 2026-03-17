import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
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
    
    return undefined;
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

const formatRating = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(1) : '0.0';
};

const getTrainerTypeLabel = (type) => {
    const normalized = String(type || 'FULLTIME').toUpperCase();
    return normalized === 'FREELANCER' ? 'Freelancer' : 'Full-time';
};

const getTrainerTypeBadgeClass = (type) => {
    const normalized = String(type || 'FULLTIME').toUpperCase();
    return normalized === 'FREELANCER'
        ? 'border border-orange-500/40 bg-orange-500/20 text-orange-200'
        : 'border border-blue-500/40 bg-blue-500/20 text-blue-200';
};

const toRequestedFieldsLabel = (payload) => {
    const keys = Object.keys(payload || {});
    if (keys.length === 0) return 'N/A';
    return keys.map((key) => REQUEST_FIELD_LABELS[key] || key).join(', ');
};

export default function TrainerProfile() {
    const { user, logout } = useAuth();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const navigate = useNavigate();
    const location = useLocation();

    const [trainer, setTrainer] = useState(null);
    const [changeRequests, setChangeRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requestsLoading, setRequestsLoading] = useState(true);

    const [showEditModal, setShowEditModal] = useState(false);
    const [submittingRequest, setSubmittingRequest] = useState(false);

    const [savingCredentials, setSavingCredentials] = useState(false);
    const [credentialForm, setCredentialForm] = useState({
        email: '',
        phone: '',
        imageUrl: ''
    });

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
            res = await axios.get('/api/trainer/me');
        } catch (primaryError) {
            const status = Number(primaryError?.response?.status || 0);
            if (status === 404 || status === 405) {
                res = await axios.get('/api/trainers/me');
            } else {
                throw primaryError;
            }
        }

        setTrainer(res.data);
        setCredentialForm({
            email: res.data?.email || '',
            phone: res.data?.phone || '',
            imageUrl: res.data?.imageUrl || ''
        });
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
                res = await axios.get('/api/trainer/me/profile-change-requests');
            } catch (primaryError) {
                const status = Number(primaryError?.response?.status || 0);
                if (status === 404 || status === 405) {
                    res = await axios.get('/api/trainers/me/profile-change-requests');
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

    const handleSaveCredentials = async () => {
        const email = String(credentialForm.email || '').trim();
        const phone = String(credentialForm.phone || '').trim();
        const imageUrl = String(credentialForm.imageUrl || '').trim();

        if (!email) {
            await showAlert({
                title: 'Email Required',
                message: 'Please enter your email address.',
                type: 'warning'
            });
            return;
        }

        setSavingCredentials(true);
        try {
            let response = null;
            try {
                response = await axios.patch('/api/trainer/me/profile', { email, phone, imageUrl });
            } catch (primaryError) {
                const status = Number(primaryError?.response?.status || 0);
                if (status === 404 || status === 405) {
                    response = await axios.patch('/api/trainers/me/profile', { email, phone, imageUrl });
                } else {
                    throw primaryError;
                }
            }

            setTrainer(response.data || trainer);
            setCredentialForm({
                email: response.data?.email || email,
                phone: response.data?.phone || phone,
                imageUrl: response.data?.imageUrl || imageUrl
            });

            await showAlert({
                title: 'Profile Updated',
                message: 'Your credentials were updated successfully.',
                type: 'success'
            });
            navigate('/trainer/profile');
        } catch (e) {
            await showAlert({
                title: 'Update Failed',
                message: e?.response?.data?.error || 'Failed to update profile credentials.',
                type: 'danger'
            });
        } finally {
            setSavingCredentials(false);
        }
    };

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
                await axios.post('/api/trainer/me/profile-change-requests', payload);
            } catch (primaryError) {
                const status = Number(primaryError?.response?.status || 0);
                if (status === 404 || status === 405) {
                    await axios.post('/api/trainers/me/profile-change-requests', payload);
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

    const handleLogout = async () => {
        const confirmed = await showConfirm({
            title: 'Sign Out',
            message: 'Are you sure you want to log out of your trainer account?',
            confirmLabel: 'Log Out',
            cancelLabel: 'Cancel',
            type: 'danger'
        });
        if (!confirmed) return;
        await logout();
        navigate('/login');
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
    const trainerRatingLabel = formatRating(previewTrainer?.rating);
    const trainerTypeLabel = getTrainerTypeLabel(previewTrainer?.type);
    const trainerTypeBadgeClass = getTrainerTypeBadgeClass(previewTrainer?.type);
    const isCredentialsEditPage = location.pathname.endsWith('/edit');
    const isAvailabilityPage = location.pathname.endsWith('/availability');
    const isMemberCardPage = location.pathname.endsWith('/member-card');
    const isRequestsPage = location.pathname.endsWith('/requests');
    const isSettingSubPage = isAvailabilityPage || isMemberCardPage || isRequestsPage;

    if (isCredentialsEditPage) {
        return (
            <div className="space-y-4 max-w-2xl mx-auto">
                <header className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/trainer/profile')}
                            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                            aria-label="Back to profile"
                        >
                            <span className="material-icons-round text-base text-white/80">arrow_back</span>
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-base font-bold text-white truncate">Edit Profile</h1>
                            <p className="text-[11px] text-text-muted">Credentials</p>
                        </div>
                    </div>
                </header>

                <section className="rounded-2xl border border-white/10 bg-surface p-4 sm:p-5 space-y-4">
                    <div className="mx-auto w-28 h-28 rounded-full overflow-hidden border border-primary/40 bg-white/5 flex items-center justify-center">
                        {credentialForm.imageUrl ? (
                            <img src={credentialForm.imageUrl} alt="Trainer profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-icons-round text-5xl text-text-muted">person</span>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-1">Email Address</label>
                            <input
                                value={credentialForm.email}
                                onChange={(e) => setCredentialForm((prev) => ({ ...prev, email: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-1">Phone Number</label>
                            <input
                                value={credentialForm.phone}
                                onChange={(e) => setCredentialForm((prev) => ({ ...prev, phone: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                                placeholder="+63 9xx xxx xxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-1">Profile Picture URL</label>
                            <input
                                value={credentialForm.imageUrl}
                                onChange={(e) => setCredentialForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => navigate('/trainer/profile')}
                            disabled={savingCredentials}
                            className="py-2.5 rounded-xl bg-white/5 text-text-muted hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveCredentials}
                            disabled={savingCredentials}
                            className="py-2.5 rounded-xl bg-primary text-background font-bold disabled:opacity-60"
                        >
                            {savingCredentials ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <header className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-white/10">
                <div className="flex items-center gap-3">
                    {isSettingSubPage ? (
                        <button
                            type="button"
                            onClick={() => navigate('/trainer/profile')}
                            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                            aria-label="Back to profile settings"
                        >
                            <span className="material-icons-round text-base text-white/80">arrow_back</span>
                        </button>
                    ) : (
                        <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                            <span className="material-icons-round text-base text-white/80">manage_accounts</span>
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h1 className="text-base font-bold text-white truncate">
                            {isAvailabilityPage ? 'Availability' : isMemberCardPage ? 'Member Card' : isRequestsPage ? 'Update Requests' : 'Profile Settings'}
                        </h1>
                        <p className="text-[11px] text-text-muted">
                            {isAvailabilityPage ? 'Weekly schedule and date exceptions'
                                : isMemberCardPage ? 'Profile card details seen by members'
                                    : isRequestsPage ? 'Request history and approvals'
                                        : 'Trainer Account'}
                        </p>
                    </div>
                </div>
            </header>

            {!isSettingSubPage && (
                <>
                    <section className="rounded-2xl border border-white/10 bg-surface p-4">
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border border-primary/40 bg-white/5 flex items-center justify-center shrink-0">
                        {trainer?.imageUrl ? (
                            <img src={trainer.imageUrl} alt="Trainer profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-icons-round text-4xl text-text-muted">person</span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-white truncate">{trainer?.name || user?.name || 'Trainer'}</h2>
                        <p className="text-xs text-text-muted mt-0.5">Trainer ID: {trainer?.id || 'N/A'}</p>
                        <p className="text-xs text-text-muted truncate mt-0.5">{trainer?.email || 'No email set'}</p>
                        <p className="text-xs text-text-muted truncate mt-0.5">{trainer?.phone || 'No phone set'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-3 text-center">
                        <p className={`text-sm font-bold ${bookingStatusOpen ? 'text-emerald-300' : 'text-red-300'}`}>{bookingStatusLabel}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Status</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-3 text-center">
                        <p className="text-sm font-bold text-primary truncate">{formatCurrency(previewTrainer?.sessionPrice ?? 0)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Per Session</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-3 text-center">
                        <p className="text-sm font-bold text-amber-300 flex items-center justify-center gap-1">
                            <span className="material-icons-round text-sm">star</span>
                            {trainerRatingLabel}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Rating</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/trainer/profile/edit')}
                    className="w-full mt-4 py-2.5 rounded-xl bg-primary text-background font-bold"
                >
                    Edit Profile
                </button>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">Settings</h3>
                    <p className="text-xs text-text-muted mt-0.5">Choose what you want to manage</p>
                </div>
                <div className="divide-y divide-white/5">
                    {[
                        { key: 'availability', path: '/trainer/profile/availability', label: 'Availability', description: 'Weekly schedule and date exceptions' },
                        { key: 'member-card', path: '/trainer/profile/member-card', label: 'Member Card', description: 'Profile card details seen by members' },
                        { key: 'requests', path: '/trainer/profile/requests', label: 'Update Requests', description: 'Request history and approval status' },
                        { key: 'change-password', path: '/forgot-password', label: 'Change Password', description: 'Reset password via email verification' }
                    ].map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => navigate(item.path)}
                            className={`w-full px-4 py-3 text-left transition-colors ${location.pathname === item.path ? 'bg-primary/10' : 'hover:bg-white/5'}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">{item.label}</p>
                                    <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
                                </div>
                                <span className="material-icons-round text-sm text-text-muted">chevron_right</span>
                            </div>
                        </button>
                    ))}
                </div>
                    </section>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 font-bold hover:bg-red-500/20 transition-colors"
                    >
                        Log Out
                    </button>
                </>
            )}

            {isAvailabilityPage && (
                <section className="space-y-3">
                    <div className="px-1">
                        <h3 className="text-sm font-bold text-white">Availability</h3>
                        <p className="text-xs text-text-muted mt-0.5">Manage your weekly schedule and date exceptions.</p>
                    </div>
                    <TrainerAvailability embedded allowBookingStatusChange />
                </section>
            )}

            {isMemberCardPage && (
                <section className="bg-surface rounded-2xl p-4 sm:p-5 border border-white/5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-white">Member Card</h3>
                            <p className="text-xs text-text-muted mt-0.5">Visible to members during trainer booking.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowEditModal(true)}
                            className="px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold"
                        >
                            Request Update
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
                        <div className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wider text-text-muted">Specialization</p>
                                <p className="text-sm text-white font-semibold mt-1">{previewTrainer?.specialization || 'Personal Trainer'}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wider text-text-muted">Trainer Type</p>
                                <div className="mt-1">
                                    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${trainerTypeBadgeClass}`}>
                                        {trainerTypeLabel}
                                    </span>
                                </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wider text-text-muted">Specialties</p>
                                <p className="text-xs text-white/80 mt-1">{previewSpecialties.length > 0 ? previewSpecialties.join(', ') : 'No specialties listed'}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wider text-text-muted">Status Description</p>
                                <p className="text-xs text-white/80 mt-1">{previewTrainer?.statusDescription || 'No status description set.'}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wider text-text-muted">Bio</p>
                                <p className="text-xs text-white/80 mt-1">{previewTrainer?.bio || 'No bio yet.'}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-text-muted px-1">Live Preview</p>
                            <article className="bg-surface rounded-2xl border border-white/10 overflow-hidden">
                                <div className="aspect-[4/3] bg-white/5 overflow-hidden relative">
                                    {previewTrainer?.cardImageUrl ? (
                                        <img src={previewTrainer.cardImageUrl} alt="Member card preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                            <span className="material-icons-round text-5xl text-primary/30">person</span>
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur rounded-full px-2.5 py-1 flex items-center gap-1">
                                        <span className="material-icons-round text-sm text-yellow-400">star</span>
                                        <span className="text-white text-xs font-bold">{trainerRatingLabel}</span>
                                    </div>
                                    <div className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${trainerTypeBadgeClass}`}>
                                        {trainerTypeLabel}
                                    </div>
                                </div>

                                <div className="p-3.5 space-y-3">
                                    <div>
                                        <h4 className="text-white font-bold text-base truncate">{trainer?.name || user?.name || 'Trainer'}</h4>
                                        <p className="text-text-muted text-xs mt-0.5">{previewTrainer?.specialization || 'Personal Trainer'}</p>
                                        {previewTrainer?.statusDescription ? (
                                            <p className="text-xs text-white/70 mt-2 line-clamp-2">{previewTrainer.statusDescription}</p>
                                        ) : null}
                                    </div>

                                    {previewTrainer?.bio ? (
                                        <p className="text-text-muted text-xs leading-relaxed line-clamp-2">{previewTrainer.bio}</p>
                                    ) : null}

                                    {previewSpecialties.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {previewSpecialties.slice(0, 3).map((specialty, idx) => (
                                                <span key={`${specialty}-${idx}`} className="bg-white/10 text-text-secondary px-2 py-1 rounded-md text-[10px] font-medium">
                                                    {specialty}
                                                </span>
                                            ))}
                                            {previewSpecialties.length > 3 ? (
                                                <span className="text-text-muted text-[10px] py-1 px-1">+{previewSpecialties.length - 3} more</span>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                        <span className="text-[11px] text-text-muted">Per Session (60 min)</span>
                                        <span className="text-primary font-bold text-sm">{formatCurrency(previewTrainer?.sessionPrice ?? 0)}</span>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>
            )}

            {isRequestsPage && (
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
            )}

            {hasPendingRequest && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 flex items-start gap-2">
                    <span className="material-icons-round text-amber-300 text-base mt-[1px]">info</span>
                    <p className="text-xs text-amber-300 font-medium leading-5">You have a pending member-card update request under review.</p>
                </div>
            )}

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
                            <h3 className="text-lg font-bold text-white">Request Member Card Update</h3>
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
