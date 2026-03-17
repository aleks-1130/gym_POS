import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useConfirm } from '../../context/ConfirmContext';

import TabNavigation from '../../components/common/TabNavigation';

// Custom Hooks
import { useMemberStats } from '../../hooks/useMemberStats';

// Services
import { memberService } from '../../services/memberService';

// Utils
import { getFilteredLogs } from '../../utils/memberUtils';

// Constants
import { TABS, ACTIVITY_FILTERS } from '../../constants/memberConstants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getInclusiveDayCount = (startDate, endDate) => {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) return null;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return Math.max(1, Math.floor((end - start) / MS_PER_DAY) + 1);
};

export default function MemberDetail() {
    const { alert: showAlert } = useConfirm();
    const { id } = useParams();
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);

    // Form Data
    const [freezeData, setFreezeData] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
    });
    const [passwordData, setPasswordData] = useState('');
    const [noteData, setNoteData] = useState('');
    const [notes, setNotes] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [editFormData, setEditFormData] = useState();

    // Photo Capture
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [submittingPhoto, setSubmittingPhoto] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Activity Filter
    const [activityFilter, setActivityFilter] = useState(ACTIVITY_FILTERS.ALL);
    const [activeTab, setActiveTab] = useState('overview');

    // Use custom hook for member stats
    const stats = useMemberStats(member);

    useEffect(() => {
        fetchMember();
        fetchNotes();
        fetchPayments();
    }, [id]);

    const fetchMember = useCallback(async () => {
        try {
            const data = await memberService.getMemberById(id);
            setMember(data);
        } catch {
            showAlert({ title: "Member Not Found", message: "Member not found", type: "danger" });
            navigate('/members');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    const fetchNotes = useCallback(async () => {
        try {
            const data = await memberService.getMemberNotes(id);
            setNotes(data);
        } catch (e) {
            console.error("Failed to fetch notes", e);
        }
    }, [id]);

    const fetchPayments = useCallback(async () => {
        setLoadingPayments(true);
        try {
            const data = await memberService.getMemberPayments(id);
            setPayments(data);
        } catch (e) {
            console.error("Failed to fetch payments", e);
        } finally {
            setLoadingPayments(false);
        }
    }, [id]);

    const redirectToPosForMember = useCallback((category) => {
        const memberId = Number(member?.id || id);
        if (!Number.isFinite(memberId) || memberId <= 0) return;

        const normalizedCategory = String(category || '').trim().toUpperCase();
        navigate(`/payments?memberId=${memberId}&category=${encodeURIComponent(normalizedCategory)}`, {
            state: {
                memberId,
                category: normalizedCategory
            }
        });
    }, [member?.id, id, navigate]);

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400, facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error(err);
            showAlert({ title: "Camera Error", message: "Camera failed to start", type: "danger" });
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const captureAndUpdate = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg');

            setSubmittingPhoto(true);
            try {
                await axios.put(`/api/members/${id}`, {
                    ...member,
                    imageUrl: imageData
                });
                stopCamera();
                setShowPhotoModal(false);
                fetchMember();
            } catch {
                showAlert({ title: "Photo Error", message: "Failed to update photo", type: "danger" });
            } finally {
                setSubmittingPhoto(false);
            }
        }
    };

    const handleStatusChange = async (newStatus, extraData = {}) => {
        try {
            await axios.post(`/api/members/${id}/status`, {
                status: newStatus,
                ...extraData
            });
            setShowFreezeModal(false);
            fetchMember();
        } catch {
            showAlert({ title: "Status Error", message: "Failed to update status", type: "danger" });
        }
    };
    const handleSetPassword = useCallback(async (e) => {
        e.preventDefault();
        try {
            await memberService.setMemberPassword(member.email, passwordData);
            setShowPasswordModal(false);
            setPasswordData('');
            showAlert({ title: "Password Set", message: "Password set successfully!", type: "success" });
        } catch {
            showAlert({ title: "Password Error", message: "Failed to set password", type: "danger" });
        }
    }, [member, passwordData]);

    const handleEditClick = () => {
        setEditFormData({
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            phone: member.phone || '',
            expiryDate: member.expiryDate ? new Date(member.expiryDate).toISOString().split('T')[0] : '',
            sex: member.sex || ''
        });
        setShowEditModal(true);
    };

    const handleEditSave = useCallback(async (e) => {
        e.preventDefault();
        try {
            await memberService.updateMember(id, editFormData);
            setShowEditModal(false);
            fetchMember();
            showAlert({ title: "Updated!", message: "Member details updated!", type: "success" });
        } catch {
            showAlert({ title: "Update Failed", message: "Failed to update member", type: "danger" });
        }
    }, [id, editFormData, fetchMember]);

    // Memoized filtered and grouped logs
    const filteredLogs = useMemo(() =>
        getFilteredLogs(member?.accessLogs, activityFilter),
        [member?.accessLogs, activityFilter]
    );

    const currentPlan = useMemo(
        () => member?.plan || null,
        [member]
    );
    const isMembershipExpiredForClassPackages = useMemo(() => {
        const statusExpired = String(member?.status || '').toUpperCase() === 'EXPIRED';
        if (statusExpired) return true;
        if (!member?.expiryDate) return false;

        const expiryDate = new Date(member.expiryDate);
        if (Number.isNaN(expiryDate.getTime())) return true;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return expiryDate < todayStart;
    }, [member?.status, member?.expiryDate]);


    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    );
    if (!member) return null;

    const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`;
    const totalSpent = payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
    const normalizedStatus = String(member.status || '').toUpperCase();
    const statusTone = normalizedStatus === 'ACTIVE'
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : normalizedStatus === 'FREEZED'
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20';
    const attendanceTone = stats.attendanceScore.color === 'emerald'
        ? 'text-emerald-400'
        : stats.attendanceScore.color === 'amber'
            ? 'text-amber-400'
            : 'text-red-400';
    const riskLevel = stats.isExpired ? 'High' : stats.isExpiringSoon ? 'Medium' : 'Low';
    const paymentRows = payments.length ? payments : (member.payments || []);
    const progressPct = Math.min(100, Math.max(0, Number(stats.progress || 0)));
    const freezeStartDate = member.freezeStartDate ? new Date(member.freezeStartDate) : null;
    const freezeEndDate = member.freezeEndDate ? new Date(member.freezeEndDate) : null;
    const hasFreezeWindow = !!(
        freezeStartDate &&
        freezeEndDate &&
        !Number.isNaN(freezeStartDate.getTime()) &&
        !Number.isNaN(freezeEndDate.getTime())
    );
    const freezeDurationDays = hasFreezeWindow ? getInclusiveDayCount(freezeStartDate, freezeEndDate) : null;
    const freezeDurationLabel = freezeDurationDays
        ? `${freezeDurationDays} day${freezeDurationDays > 1 ? 's' : ''}`
        : 'Not tracked';
    const freezeWindowLabel = hasFreezeWindow
        ? `${freezeStartDate.toLocaleDateString()} - ${freezeEndDate.toLocaleDateString()}`
        : 'Not tracked';


    return (
        <div className="space-y-4 animate-fade-in pb-10">
            <div className="flex items-center gap-3 min-w-0 px-1">
                <button
                    type="button"
                    onClick={() => navigate('/members')}
                    className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
                    aria-label="Back to members"
                >
                    <span className="material-icons-round text-base">arrow_back</span>
                </button>
                <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-white truncate">Member Details</h2>
                    <p className="text-[11px] text-text-muted truncate">{member.firstName} {member.lastName} • Member ID #{member.id}</p>
                </div>
            </div>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="px-5 py-4 sm:px-6 border-b border-white/10">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="relative shrink-0">
                                <div className="h-16 w-16 rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white text-xl font-bold">
                                    {member.imageUrl ? <img src={member.imageUrl} className="w-full h-full object-cover" alt="" /> : initials}
                                </div>
                                <button onClick={() => setShowPhotoModal(true)} className="absolute -bottom-2 -right-2 h-7 w-7 rounded-md bg-primary text-white hover:bg-orange-600 transition-colors">
                                    <span className="material-icons-round text-xs">photo_camera</span>
                                </button>
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{member.firstName} {member.lastName}</h1>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusTone}`}>{member.status}</span>
                                </div>
                                <p className="text-xs text-text-muted mt-1">Member ID #{member.id} • Last active {stats.lastActive}</p>
                                {hasFreezeWindow && (
                                    <p className="text-[11px] text-text-muted mt-1">
                                        {normalizedStatus === 'FREEZED' ? 'Current freeze' : 'Last freeze'}: {freezeWindowLabel} ({freezeDurationLabel})
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => redirectToPosForMember('MEMBERSHIP')} className="px-3.5 py-2 rounded-lg bg-primary hover:bg-orange-600 text-white text-sm font-semibold transition-colors">Renew</button>
                            <button
                                onClick={() => {
                                    if (isMembershipExpiredForClassPackages) {
                                        showAlert({
                                            title: 'Membership Expired',
                                            message: 'Cannot add class sessions for expired membership. Renew membership first.',
                                            type: 'warning'
                                        });
                                        return;
                                    }
                                    redirectToPosForMember('PACKAGES');
                                }}
                                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                            >
                                Add Sessions
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setShowMoreActions((prev) => !prev)}
                                    className="px-3.5 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
                                >
                                    More
                                </button>
                                {showMoreActions && (
                                    <div className="absolute right-0 mt-2 w-44 rounded-lg border border-white/10 bg-surface shadow-2xl z-20">
                                        {normalizedStatus === 'FREEZED' ? (
                                            <button
                                                onClick={() => { handleStatusChange('ACTIVE'); setShowMoreActions(false); }}
                                                className="w-full text-left px-3 py-2.5 text-sm text-emerald-300 hover:bg-white/5"
                                            >
                                                Unfreeze Member
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setShowFreezeModal(true); setShowMoreActions(false); }}
                                                className="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5"
                                            >
                                                Freeze Member
                                            </button>
                                        )}
                                        <button onClick={() => { setShowPasswordModal(true); setShowMoreActions(false); }} className="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5">Reset Password</button>
                                        <button onClick={() => { handleEditClick(); setShowMoreActions(false); }} className="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5">Edit Profile</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 sm:px-6 bg-background/20">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Plan</p>
                            <p className="text-sm font-semibold text-white mt-1 truncate">{stats.combinedPlanLabel}</p>
                            <p className="text-xs text-text-muted">{formatPrice(currentPlan?.price || 0)} / {currentPlan?.duration || 0} days</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Progress</p>
                                <p className="text-xs font-semibold text-white">{Math.round(progressPct)}%</p>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
                                <div className={`h-full ${progressPct > 90 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${progressPct}%` }} />
                            </div>
                            <p className="text-xs text-text-muted mt-1">{Math.max(0, stats.daysRemaining)} days left</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Expiry</p>
                            <p className="text-sm font-semibold text-white mt-1">{member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'Not set'}</p>
                            <p className={`text-xs mt-1 ${riskLevel === 'High' ? 'text-red-400' : riskLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>Risk: {riskLevel}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Ledger Snapshot</p>
                            <p className="text-xs text-text-muted mt-1">Spent: <span className="text-white font-semibold">{formatPrice(totalSpent)}</span></p>
                            <p className="text-xs text-text-muted">Visits: <span className="text-white font-semibold">{member.accessLogs?.length || 0}</span></p>
                            <p className="text-xs text-text-muted">Sessions: <span className={`${(member.classSessionsRemaining || 0) > 0 ? 'text-emerald-400' : 'text-red-400'} font-semibold`}>{member.classSessionsRemaining || 0}</span></p>
                        </div>
                    </div>
                </div>
            </section>

            <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab Content */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
                <div className="space-y-4">
            {activeTab === 'overview' && (
                <>
                    <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10">
                            <h3 className="text-white font-semibold">Member Profile</h3>
                        </div>
                        <div className="px-5 py-1">
                                {[
                                    { label: 'Email', value: member.email || 'Not provided' },
                                    { label: 'Phone', value: member.phone || 'Not provided' },
                                    { label: 'Birth Date', value: member.birthDate ? new Date(member.birthDate).toLocaleDateString() : 'Not provided' },
                                    { label: 'Gender', value: member.sex || 'Not specified' },
                                    { label: 'Member Since', value: member.startDate ? new Date(member.startDate).toLocaleDateString() : 'Not provided' },
                                    { label: 'Expiry Date', value: member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'Not provided' },
                                    { label: 'Freeze Period', value: freezeWindowLabel },
                                    { label: 'Freeze Duration', value: freezeDurationLabel }
                                ].map((row) => (
                                <div key={row.label} className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 py-3 border-b border-white/5 last:border-b-0">
                                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">{row.label}</p>
                                    <p className="text-sm text-white break-words">{row.value}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-white font-semibold">Recent Access Logs</h3>
                            <button onClick={() => setActiveTab('activity')} className="text-primary text-xs font-semibold hover:underline">View All</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px]">
                                <thead className="bg-white/5">
                                    <tr className="text-left">
                                        <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Date</th>
                                        <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Time</th>
                                        <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Event</th>
                                        <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.slice(0, 8).map((log) => (
                                        <tr key={log.id} className="border-t border-white/5">
                                            <td className="px-5 py-3 text-sm text-white">{new Date(log.checkIn).toLocaleDateString()}</td>
                                            <td className="px-5 py-3 text-sm text-text-secondary">{new Date(log.checkIn).toLocaleTimeString()}</td>
                                            <td className="px-5 py-3 text-sm text-text-secondary">{log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}</td>
                                            <td className="px-5 py-3 text-right">
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{log.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLogs.length === 0 && <tr><td colSpan="4" className="px-5 py-7 text-sm text-text-muted text-center">No recent logs.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            {activeTab === 'activity' && (
                <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h3 className="text-white font-semibold">Activity Ledger</h3>
                        <div className="flex gap-2">
                            {['7days', '30days', 'all'].map(period => (
                                <button key={period} onClick={() => setActivityFilter(period)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activityFilter === period ? 'bg-primary text-white' : 'bg-white/5 text-text-muted hover:text-white'}`}>
                                    {period === 'all' ? 'All Time' : period === '30days' ? '30 Days' : '7 Days'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[680px]">
                        <table className="w-full min-w-[720px]">
                            <thead className="bg-white/5 sticky top-0">
                                <tr className="text-left">
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Date</th>
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Time</th>
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Action</th>
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="border-t border-white/5">
                                        <td className="px-5 py-3 text-sm text-white">{new Date(log.checkIn).toLocaleDateString()}</td>
                                        <td className="px-5 py-3 text-sm text-text-secondary">{new Date(log.checkIn).toLocaleTimeString()}</td>
                                        <td className="px-5 py-3 text-sm text-text-secondary">{log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}</td>
                                        <td className="px-5 py-3 text-right">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{log.status}</span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && <tr><td colSpan="4" className="px-5 py-7 text-sm text-text-muted text-center">No activity found for this filter.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'payments' && (
                <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-white font-bold flex items-center gap-2"><span className="material-icons-round text-primary text-base">receipt_long</span> Payment History</h3>
                        <span className="text-xs text-text-muted">{loadingPayments ? 'Loading...' : `${paymentRows.length} records`}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px]">
                            <thead className="bg-white/5">
                                <tr className="text-left">
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Date</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Type</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Method</th>
                                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentRows.map((pay) => (
                                    <tr key={pay.id} className="border-t border-white/5">
                                        <td className="px-5 py-3 text-sm text-white">{new Date(pay.date).toLocaleDateString()}</td>
                                        <td className="px-5 py-3 text-sm text-text-secondary">{String(pay.type || '').replace('_', ' ')}</td>
                                        <td className="px-5 py-3 text-sm text-text-secondary">{pay.method || '-'}</td>
                                        <td className="px-5 py-3 text-sm font-semibold text-white text-right">{formatPrice(pay.amount || 0)}</td>
                                    </tr>
                                ))}
                                {paymentRows.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-5 py-8 text-sm text-text-muted text-center">No payment history yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'notes' && (
                <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-white font-bold flex items-center gap-2"><span className="material-icons-round text-primary text-base">description</span> Staff Notes</h3>
                        <button onClick={() => setShowNotesModal(true)} className="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5">
                            <span className="material-icons-round text-sm">add</span> Add Note
                        </button>
                    </div>
                    <div className="p-5 space-y-3 max-h-[620px] overflow-y-auto">
                        {notes.map(note => (
                            <article key={note.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">{note.author?.name || 'Staff'} • {new Date(note.createdAt).toLocaleString()}</p>
                                <p className="mt-2 text-sm text-white whitespace-pre-wrap">{note.content}</p>
                            </article>
                        ))}
                        {notes.length === 0 && <p className="text-sm text-text-muted">No staff notes available.</p>}
                    </div>
                </section>
            )}

                </div>

                <aside className="space-y-4 xl:sticky xl:top-4">
                    <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/10">
                            <h3 className="text-white text-sm font-semibold">Quick Metrics</h3>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between"><span className="text-text-muted">Attendance</span><span className={`font-semibold ${attendanceTone}`}>{stats.attendanceScore.label}</span></div>
                            <div className="flex items-center justify-between"><span className="text-text-muted">Visits</span><span className="font-semibold text-white">{member.accessLogs?.length || 0}</span></div>
                            <div className="flex items-center justify-between"><span className="text-text-muted">Points</span><span className="font-semibold text-white">{member.points || 0}</span></div>
                            <div className="flex items-center justify-between"><span className="text-text-muted">Total Spent</span><span className="font-semibold text-white">{formatPrice(totalSpent)}</span></div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/10">
                            <h3 className="text-white text-sm font-semibold">Class Sessions</h3>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between"><span className="text-text-muted">Remaining</span><span className={`${(member.classSessionsRemaining || 0) > 0 ? 'text-emerald-400' : 'text-red-400'} font-semibold`}>{member.classSessionsRemaining || 0}</span></div>
                            <div className="flex items-center justify-between"><span className="text-text-muted">Used</span><span className="text-white font-semibold">{member.classSessionsUsed || 0}</span></div>
                            <div className="flex items-center justify-between"><span className="text-text-muted">Purchased</span><span className="text-white font-semibold">{member.classSessionsPurchased || 0}</span></div>
                            <div className="flex items-center justify-between"><span className="text-text-muted">Plan Included</span><span className="text-white font-semibold">{currentPlan?.includesClasses ? (currentPlan?.includedClassSessions || 0) : 0}</span></div>
                        </div>
                    </section>

                </aside>
            </div>

            {/* Modals */}

            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Reset Password</h3>
                        <form onSubmit={handleSetPassword} className="space-y-4">
                            <input required type="password" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" placeholder="New Password" value={passwordData} onChange={e => setPasswordData(e.target.value)} />
                            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowPasswordModal(false)} className="text-text-muted">Cancel</button><button type="submit" className="bg-primary text-white font-bold px-8 py-2.5 rounded-2xl">Save</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showPhotoModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface rounded-3xl border border-white/10 w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Update Photo</h3>
                        <div className="aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-6 flex items-center justify-center">
                            {isCameraOpen ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" /> : <button onClick={startCamera} className="bg-primary text-white px-4 py-2 rounded-xl">Open Camera</button>}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex gap-3">
                            <button onClick={() => { stopCamera(); setShowPhotoModal(false); }} className="flex-1 text-text-muted">Cancel</button>
                            {isCameraOpen && <button onClick={captureAndUpdate} disabled={submittingPhoto} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Capture</button>}
                        </div>
                    </div>
                </div>
            )}

            {showNotesModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-md border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Add Staff Note</h3>
                        <form onSubmit={async e => { e.preventDefault(); if (!noteData.trim()) return; try { await axios.post(`/api/members/${id}/notes`, { content: noteData.trim() }); setNoteData(''); setShowNotesModal(false); fetchNotes(); } catch { showAlert({ title: "Save Failed", message: "Failed to save note", type: "danger" }); } }} className="space-y-4">
                            <textarea required rows="5" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none resize-none" placeholder="Enter note..." value={noteData} onChange={e => setNoteData(e.target.value)} />
                            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowNotesModal(false)} className="text-text-muted">Cancel</button><button type="submit" className="bg-primary text-white font-bold px-8 py-2.5 rounded-2xl">Save</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-6">
                        <h2 className="text-2xl font-bold text-white mb-6">Edit Member</h2>
                        <form onSubmit={handleEditSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" required className="bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="First Name" value={editFormData.firstName || ''} onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })} />
                                <input type="text" required className="bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="Last Name" value={editFormData.lastName || ''} onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })} />
                            </div>
                            <input type="email" required className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="Email" value={editFormData.email || ''} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} />
                            <input type="tel" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="Phone" value={editFormData.phone || ''} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} />
                            <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-white bg-white/10 rounded-xl">Cancel</button><button type="submit" className="flex-1 py-3 bg-primary text-white font-bold rounded-xl">Save</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showFreezeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Freeze Membership</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            handleStatusChange('FREEZED', {
                                freezeStartDate: freezeData.startDate,
                                freezeEndDate: freezeData.endDate
                            });
                        }} className="space-y-4">
                            <div>
                                <label className="text-text-muted text-sm mb-2 block">Start Date</label>
                                <input required type="date" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={freezeData.startDate} onChange={e => setFreezeData({ ...freezeData, startDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-text-muted text-sm mb-2 block">End Date</label>
                                <input required type="date" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={freezeData.endDate} onChange={e => setFreezeData({ ...freezeData, endDate: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowFreezeModal(false)} className="text-text-muted">Cancel</button><button type="submit" className="bg-blue-500 text-white font-bold px-8 py-2.5 rounded-2xl">Freeze</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}






