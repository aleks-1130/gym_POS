import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { useCurrency } from '../../context/CurrencyContext';
import { useConfirm } from '../../context/ConfirmContext';

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
    const [showGuestPassCountModal, setShowGuestPassCountModal] = useState(false);
    const [showGuestPassTermsModal, setShowGuestPassTermsModal] = useState(false);

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
    const [guestPassCountInput, setGuestPassCountInput] = useState('1');
    const [guestPassCount, setGuestPassCount] = useState(1);
    const [guestPassAgreementPrinted, setGuestPassAgreementPrinted] = useState(false);
    const [submittingGuestPass, setSubmittingGuestPass] = useState(false);

    // Photo Capture
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [submittingPhoto, setSubmittingPhoto] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const guestPassPrintRef = useRef(null);
    const handlePrintGuestPassTerms = useReactToPrint({
        contentRef: guestPassPrintRef,
        documentTitle: `Guest_Pass_Terms_Member_${id || 'member'}`
    });
    const triggerGuestPassPrint = useCallback(() => {
        handlePrintGuestPassTerms?.();
        setGuestPassAgreementPrinted(true);
    }, [handlePrintGuestPassTerms]);

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
        } catch (error) {
            showAlert({
                title: "Status Error",
                message: error?.response?.data?.error || "Failed to update status",
                type: "danger"
            });
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
    const freezeLimitCount = Math.max(0, Number(currentPlan?.freezeLimitCount || 0));
    const freezeUsedCount = Math.max(0, Number(member?.freezeUsedCount || 0));
    const freezeRemainingCount = Math.max(0, freezeLimitCount - freezeUsedCount);
    const canUseFreezeNow = freezeLimitCount > 0 && freezeRemainingCount > 0;
    const guestPassEnabled = Boolean(currentPlan?.guestPassEnabled) || Number(currentPlan?.guestPassLimitCount || 0) > 0;
    const guestPassLimitCount = guestPassEnabled
        ? Math.max(0, Number(currentPlan?.guestPassLimitCount || 0))
        : 0;
    const guestPassUsedCount = Math.max(0, Number(member?.guestPassUsedCount || 0));
    const guestPassRemainingCount = Math.max(0, guestPassLimitCount - guestPassUsedCount);
    const canUseGuestPassNow = guestPassLimitCount > 0 && guestPassRemainingCount > 0;
    const guestPassProgressPct = guestPassLimitCount > 0
        ? Math.min(100, Math.max(0, (guestPassUsedCount / guestPassLimitCount) * 100))
        : 0;
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
    const resetGuestPassWorkflow = useCallback(() => {
        setShowGuestPassCountModal(false);
        setShowGuestPassTermsModal(false);
        setGuestPassCountInput('1');
        setGuestPassCount(1);
        setGuestPassAgreementPrinted(false);
    }, []);
    const openGuestPassCountModal = useCallback(() => {
        if (!canUseGuestPassNow) {
            showAlert({
                title: 'Guest Pass Unavailable',
                message: guestPassLimitCount <= 0
                    ? 'This plan does not include guest passes.'
                    : 'Guest pass usage limit reached for this membership.',
                type: 'warning'
            });
            return;
        }
        setGuestPassCountInput('1');
        setShowGuestPassCountModal(true);
    }, [canUseGuestPassNow, guestPassLimitCount, showAlert]);
    const handleGuestPassCountSubmit = useCallback((e) => {
        e.preventDefault();
        const requestedCount = Number(guestPassCountInput);
        if (!Number.isInteger(requestedCount) || requestedCount <= 0) {
            showAlert({
                title: 'Invalid Count',
                message: 'Guest count must be a whole number greater than 0.',
                type: 'warning'
            });
            return;
        }
        if (requestedCount > guestPassRemainingCount) {
            showAlert({
                title: 'Not Enough Guest Pass',
                message: `Only ${guestPassRemainingCount} guest pass${guestPassRemainingCount > 1 ? 'es are' : ' is'} remaining.`,
                type: 'warning'
            });
            return;
        }
        setGuestPassCount(requestedCount);
        setGuestPassAgreementPrinted(false);
        setShowGuestPassCountModal(false);
        setShowGuestPassTermsModal(true);
    }, [guestPassCountInput, guestPassRemainingCount, showAlert]);
    const handleConfirmGuestPassUsage = useCallback(async () => {
        if (guestPassCount <= 0) {
            showAlert({
                title: 'Invalid Count',
                message: 'Guest count is required before recording usage.',
                type: 'warning'
            });
            return;
        }
        if (!guestPassAgreementPrinted) {
            showAlert({
                title: 'Print Required',
                message: 'Please print the guest pass agreement before confirming usage.',
                type: 'warning'
            });
            return;
        }

        setSubmittingGuestPass(true);
        try {
            const result = await memberService.useGuestPass(id, guestPassCount);
            await fetchMember();
            const remaining = Number(result?.usage?.remainingCount);
            const hasRemaining = Number.isFinite(remaining);
            resetGuestPassWorkflow();
            showAlert({
                title: 'Guest Pass Used',
                message: hasRemaining
                    ? `Recorded ${guestPassCount} guest pass usage. Remaining: ${remaining} of ${guestPassLimitCount}.`
                    : `Recorded ${guestPassCount} guest pass usage.`,
                type: 'success'
            });
        } catch (error) {
            showAlert({
                title: 'Guest Pass Error',
                message: error?.response?.data?.error || 'Failed to record guest pass usage.',
                type: 'danger'
            });
        } finally {
            setSubmittingGuestPass(false);
        }
    }, [fetchMember, guestPassAgreementPrinted, guestPassCount, guestPassLimitCount, id, resetGuestPassWorkflow, showAlert]);


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
    const totalPointsFromPayments = paymentRows.reduce(
        (sum, pay) => sum + Math.max(0, Number(pay?.pointsAwarded || 0)),
        0
    );
    const latestPaymentDate = paymentRows.length > 0
        ? new Date(paymentRows[0].date).toLocaleDateString()
        : 'No payments yet';
    const loyaltyTransactions = Array.isArray(member?.loyaltyTransactions) ? member.loyaltyTransactions : [];
    const latestLoyaltyDate = loyaltyTransactions.length > 0
        ? new Date(loyaltyTransactions[0].createdAt).toLocaleDateString()
        : 'No rewards activity';
    const latestNoteDate = notes.length > 0
        ? new Date(notes[0].createdAt).toLocaleDateString()
        : 'No notes yet';
    const accessLogs = Array.isArray(member?.accessLogs) ? member.accessLogs : [];
    const visitsLast7Days = accessLogs.filter((log) => {
        const checkIn = new Date(log?.checkIn);
        if (Number.isNaN(checkIn.getTime())) return false;
        return (Date.now() - checkIn.getTime()) <= (7 * MS_PER_DAY);
    }).length;
    const visitsLast30Days = accessLogs.filter((log) => {
        const checkIn = new Date(log?.checkIn);
        if (Number.isNaN(checkIn.getTime())) return false;
        return (Date.now() - checkIn.getTime()) <= (30 * MS_PER_DAY);
    }).length;
    const latestAccessDate = accessLogs.length > 0
        ? new Date(
            Math.max(
                ...accessLogs.map((log) => {
                    const checkIn = new Date(log?.checkIn);
                    return Number.isNaN(checkIn.getTime()) ? 0 : checkIn.getTime();
                })
            )
        ).toLocaleDateString()
        : 'No visits yet';
    const checkInLogs = accessLogs.filter((log) => String(log?.status || '').toUpperCase() === 'ALLOWED');
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const freezeIsUpcoming = hasFreezeWindow && freezeStartDate > todayStart;
    const freezeIsCompleted = hasFreezeWindow && freezeEndDate < todayStart;
    const freezeIsActive = hasFreezeWindow && !freezeIsUpcoming && !freezeIsCompleted;
    const freezeTotalDays = freezeDurationDays || 0;
    const freezeElapsedDays = hasFreezeWindow
        ? freezeIsUpcoming
            ? 0
            : freezeIsCompleted
                ? freezeTotalDays
                : (getInclusiveDayCount(freezeStartDate, todayStart) || 0)
        : 0;
    const freezeRemainingDays = hasFreezeWindow
        ? freezeIsUpcoming
            ? freezeTotalDays
            : freezeIsCompleted
                ? 0
                : (getInclusiveDayCount(todayStart, freezeEndDate) || 0)
        : 0;
    const freezeProgressPct = hasFreezeWindow && freezeTotalDays > 0
        ? Math.min(100, Math.max(0, (freezeElapsedDays / freezeTotalDays) * 100))
        : 0;
    const freezeStatusLabel = hasFreezeWindow
        ? freezeIsUpcoming
            ? `Starts ${freezeStartDate.toLocaleDateString()}`
            : freezeIsActive
                ? `${freezeRemainingDays} day${freezeRemainingDays > 1 ? 's' : ''} remaining`
                : `Completed ${freezeEndDate.toLocaleDateString()}`
        : 'No freeze period recorded';
    const freezeTrackerStatusLabel = freezeLimitCount <= 0
        ? 'Not included'
        : freezeRemainingCount <= 0
            ? 'Limit reached'
            : 'Available';
    const guestTrackerStatusLabel = guestPassLimitCount <= 0
        ? 'Not included'
        : guestPassRemainingCount <= 0
            ? 'Limit reached'
            : 'Available';
    const progressStatusLabel = stats.isExpired
        ? 'Expired'
        : stats.isExpiringSoon
            ? 'Expiring soon'
            : 'On track';
    const progressStatusTone = stats.isExpired
        ? 'text-red-400'
        : stats.isExpiringSoon
            ? 'text-amber-400'
            : 'text-emerald-400';
    const freezeSlotDisplayLimit = 12;
    const freezeUseSlotDisplay = freezeLimitCount > 0 && freezeLimitCount <= freezeSlotDisplayLimit;
    const freezeSlots = freezeUseSlotDisplay
        ? Array.from({ length: freezeLimitCount }, (_, index) => index < freezeUsedCount)
        : [];
    const freezeAllowanceProgressPct = freezeLimitCount > 0
        ? Math.min(100, Math.max(0, (freezeUsedCount / freezeLimitCount) * 100))
        : 0;
    const freezeUtilizationPct = Math.round(freezeAllowanceProgressPct);
    const guestPassSlotDisplayLimit = 12;
    const guestPassUseSlotDisplay = guestPassLimitCount > 0 && guestPassLimitCount <= guestPassSlotDisplayLimit;
    const guestPassSlots = guestPassUseSlotDisplay
        ? Array.from({ length: guestPassLimitCount }, (_, index) => index < guestPassUsedCount)
        : [];
    const guestPassUtilizationPct = guestPassLimitCount > 0
        ? Math.round((guestPassUsedCount / guestPassLimitCount) * 100)
        : 0;
    const classSessionsRemaining = Math.max(0, Number(member?.classSessionsRemaining || 0));
    const classSessionsUsed = Math.max(0, Number(member?.classSessionsUsed || 0));
    const classSessionsPurchased = Math.max(0, Number(member?.classSessionsPurchased || 0));
    const classSessionsIncluded = currentPlan?.includesClasses
        ? Math.max(0, Number(currentPlan?.includedClassSessions || 0))
        : 0;
    const classSessionsTotal = Math.max(0, classSessionsRemaining + classSessionsUsed);
    const classSessionsProgressPct = classSessionsTotal > 0
        ? Math.min(100, Math.max(0, (classSessionsUsed / classSessionsTotal) * 100))
        : 0;
    const classSessionsUtilizationPct = Math.round(classSessionsProgressPct);
    const classSessionsStatusLabel = classSessionsTotal <= 0
        ? 'Not included'
        : classSessionsRemaining <= 0
            ? 'Depleted'
            : 'Available';
    const planAppliedLabel = `${stats.combinedPlanLabel || 'No plan'}${currentPlan?.duration ? ` (${currentPlan.duration} days)` : ''}`;
    const memberSinceLabel = member.startDate ? new Date(member.startDate).toLocaleDateString() : 'Not provided';
    const expiryDateLabel = member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'Not provided';
    const birthDateLabel = member.birthDate ? new Date(member.birthDate).toLocaleDateString() : 'Not provided';


    return (
        <div className="animate-fade-in pb-10">
            <div className="space-y-4">
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
                        <p className="text-[11px] text-text-muted truncate">Profile, activity, membership and operations</p>
                    </div>
                </div>

                <section className="rounded-2xl border border-white/10 bg-surface p-4 sm:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                            <div className="relative shrink-0">
                                <div className="h-[72px] w-[72px] rounded-full overflow-hidden border-2 border-primary/70 bg-primary/25 flex items-center justify-center text-lg font-bold text-white">
                                    {member.imageUrl ? <img src={member.imageUrl} className="w-full h-full object-cover" alt="" /> : initials}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPhotoModal(true)}
                                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-white hover:bg-orange-600 transition-colors flex items-center justify-center"
                                >
                                    <span className="material-icons-round text-xs">photo_camera</span>
                                </button>
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-white uppercase leading-none">
                                    {member.firstName} {member.lastName}
                                </h1>
                                <p className="text-[11px] text-text-muted uppercase tracking-wider mt-1">
                                    Member ID #{member.id} | Since {memberSinceLabel}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusTone}`}>{member.status}</span>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30">{stats.combinedPlanLabel || 'No plan'}</span>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">{member?.points || 0} pts</span>
                                    {normalizedStatus === 'FREEZED' && (
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Frozen</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 shrink-0">
                            <button onClick={handleEditClick} className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium">Edit</button>
                            <button onClick={() => redirectToPosForMember('MEMBERSHIP')} className="px-4 py-2 rounded-lg bg-primary hover:bg-orange-600 text-white text-sm font-semibold">Renew</button>
                            <div className="relative">
                                <button
                                    onClick={() => setShowMoreActions((prev) => !prev)}
                                    className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold"
                                >
                                    Actions
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
                                        <button
                                            onClick={() => {
                                                if (!canUseGuestPassNow) return;
                                                openGuestPassCountModal();
                                                setShowMoreActions(false);
                                            }}
                                            disabled={!canUseGuestPassNow}
                                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 ${canUseGuestPassNow ? 'text-emerald-300' : 'text-text-muted cursor-not-allowed opacity-60'}`}
                                        >
                                            Use Guest Pass
                                        </button>
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
                                                setShowMoreActions(false);
                                            }}
                                            className="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5"
                                        >
                                            Add Sessions
                                        </button>
                                        <button onClick={() => { setShowPasswordModal(true); setShowMoreActions(false); }} className="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-white/5">Reset Password</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
                    <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Check-ins</p>
                        <p className="text-xl font-semibold text-white leading-none mt-1">{accessLogs.length}</p>
                        <p className="text-[11px] text-text-muted mt-1">{visitsLast30Days} in last 30 days</p>
                    </article>
                    <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Class Sessions</p>
                        <p className="text-xl font-semibold text-white leading-none mt-1">{classSessionsUsed}</p>
                        <p className="text-[11px] text-text-muted mt-1">{classSessionsRemaining} remaining</p>
                    </article>
                    <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Guest Passes</p>
                        <p className="text-xl font-semibold text-white leading-none mt-1">{guestPassUsedCount} / {guestPassLimitCount}</p>
                        <p className="text-[11px] text-text-muted mt-1">Used this cycle</p>
                    </article>
                    <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Days Until Renewal</p>
                        <p className="text-xl font-semibold text-white leading-none mt-1">{Math.max(0, stats.daysRemaining)}</p>
                        <p className="text-[11px] text-text-muted mt-1">{expiryDateLabel}</p>
                    </article>
                    <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">Loyalty Points</p>
                        <p className="text-xl font-semibold text-yellow-300 leading-none mt-1">{member?.points || 0}</p>
                        <p className="text-[11px] text-text-muted mt-1">{latestLoyaltyDate}</p>
                    </article>
                </section>

                <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id
                                ? 'text-primary border-primary'
                                : 'text-text-muted border-transparent hover:text-white'
                                }`}
                        >
                            {tab.id === 'payments' ? 'Payments-History' : tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-4">
            {activeTab === 'overview' && (
                <section className="grid gap-3 xl:grid-cols-2">
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Member Credentials</h3>
                        <article className="rounded-2xl border border-white/10 bg-surface p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-white">Personal Info</p>
                                <span className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center">
                                    <span className="material-icons-round text-base">person</span>
                                </span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Full Name</span><span className="text-white font-semibold">{member.firstName} {member.lastName}</span></div>
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Date of Birth</span><span className="text-white font-semibold">{birthDateLabel}</span></div>
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Gender</span><span className="text-white font-semibold">{member.sex || 'Not specified'}</span></div>
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Phone</span><span className="text-primary font-semibold">{member.phone || 'Not provided'}</span></div>
                                <div className="flex items-center justify-between"><span className="text-text-muted">Email</span><span className="text-white font-semibold text-right">{member.email || 'Not provided'}</span></div>
                            </div>
                        </article>

                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Membership Plan</h3>
                        <article className="rounded-2xl border border-white/10 bg-surface p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-white">{stats.combinedPlanLabel || 'No active plan'}</p>
                                <span className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                                    <span className="material-icons-round text-base">credit_card</span>
                                </span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Plan Type</span><span className="text-white font-semibold">{planAppliedLabel}</span></div>
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Start Date</span><span className="text-white font-semibold">{memberSinceLabel}</span></div>
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Renewal Date</span><span className="text-white font-semibold">{expiryDateLabel}</span></div>
                                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-text-muted">Status</span><span className={`font-semibold ${progressStatusTone}`}>{progressStatusLabel}</span></div>
                                <div className="flex items-center justify-between"><span className="text-text-muted">Freeze Window</span><span className="text-white font-semibold text-right">{freezeWindowLabel} ({freezeDurationLabel})</span></div>
                            </div>
                            <div className="mt-3">
                                <div className="flex items-center justify-between text-[11px] text-text-muted">
                                    <span>Plan Progress</span>
                                    <span>{Math.round(progressPct)}%</span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div className={`h-full ${progressPct > 90 ? 'bg-red-500' : progressPct > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${progressPct}%` }} />
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                                    <span>{memberSinceLabel}</span>
                                    <span>{Math.max(0, stats.daysRemaining)} days left</span>
                                </div>
                            </div>
                        </article>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Guest Passes</h3>
                        <article className="rounded-2xl border border-white/10 bg-surface p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-white">Pass Usage ({guestPassLimitCount} total)</p>
                                <span className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                                    <span className="material-icons-round text-base">confirmation_number</span>
                                </span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] text-text-muted">
                                    <span>Used</span>
                                    <span>{guestPassUsedCount} / {guestPassLimitCount}</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${guestPassProgressPct}%` }} />
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-text-muted">Remaining: {guestPassRemainingCount}</p>
                            <button
                                type="button"
                                onClick={openGuestPassCountModal}
                                disabled={!canUseGuestPassNow}
                                className="mt-3 w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium"
                            >
                                Issue Guest Pass
                            </button>
                        </article>

                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Class Sessions</h3>
                        <article className="rounded-2xl border border-white/10 bg-surface p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-white">Session Utilization</p>
                                <span className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center">
                                    <span className="material-icons-round text-base">fitness_center</span>
                                </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-amber-400" style={{ width: `${classSessionsProgressPct}%` }} />
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div className="rounded-lg bg-black/20 px-3 py-2"><p className="text-[11px] text-text-muted">Used</p><p className="text-white font-semibold">{classSessionsUsed}</p></div>
                                <div className="rounded-lg bg-black/20 px-3 py-2"><p className="text-[11px] text-text-muted">Remaining</p><p className="text-white font-semibold">{classSessionsRemaining}</p></div>
                            </div>
                            <button
                                type="button"
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
                                className="mt-3 w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium"
                            >
                                Book / Add Class Session
                            </button>
                        </article>
                    </div>
                </section>
            )}

            {activeTab === '__legacy_overview' && (
                <>
                    <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-5 py-3 sm:px-6 bg-background/20">
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-white">Operational Overview</h3>
                                    <p className="text-xs text-text-muted">Core membership performance, allowances, and action readiness.</p>
                                </div>
                                <p className="text-[11px] text-text-muted">Updated from live member usage</p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 mb-3">
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Progress</p>
                                    <p className="text-sm font-semibold text-white mt-1">{Math.round(progressPct)}%</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Days Remaining</p>
                                    <p className="text-sm font-semibold text-white mt-1">{Math.max(0, stats.daysRemaining)}</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Freeze Left</p>
                                    <p className="text-sm font-semibold text-white mt-1">{freezeRemainingCount}</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Guest Pass Left</p>
                                    <p className="text-sm font-semibold text-white mt-1">{guestPassRemainingCount}</p>
                                </div>
                            </div>
                            <div className="grid gap-3 xl:grid-cols-12">
                                <article className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-12">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Membership Progress</p>
                                            <p className={`text-sm font-semibold mt-1 ${progressStatusTone}`}>{progressStatusLabel}</p>
                                            <p className="text-xs text-text-muted mt-1">
                                                Plan Applied: <span className="text-white font-semibold">{planAppliedLabel}</span>
                                            </p>
                                        </div>
                                        <p className="text-xl font-black text-white">{Math.round(progressPct)}%</p>
                                    </div>
                                    <div className="mt-3 space-y-1.5">
                                        <div className="relative h-2.5 rounded-full bg-white/10 overflow-hidden">
                                            <div className={`h-full transition-all ${progressPct > 90 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${progressPct}%` }} />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-text-muted">
                                            <span>0%</span>
                                            <span>50%</span>
                                            <span>100%</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                                        <span>Start: {member.startDate ? new Date(member.startDate).toLocaleDateString() : 'N/A'}</span>
                                        <span>{Math.max(0, stats.daysRemaining)} day{Math.max(0, stats.daysRemaining) === 1 ? '' : 's'} left</span>
                                        <span>Expiry: {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                                            <p className="text-text-muted">Attendance</p>
                                            <p className={`font-semibold mt-1 ${attendanceTone}`}>{stats.attendanceScore.label}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                                            <p className="text-text-muted">Visits</p>
                                            <p className="font-semibold mt-1 text-white">{member.accessLogs?.length || 0}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                                            <p className="text-text-muted">Risk</p>
                                            <p className={`font-semibold mt-1 ${riskLevel === 'High' ? 'text-red-400' : riskLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>{riskLevel}</p>
                                        </div>
                                    </div>
                                </article>

                                <article className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Freeze Tracker</p>
                                            <p className="text-[10px] text-text-muted/80 mt-1">Allowance utilization</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[11px] font-semibold ${freezeLimitCount <= 0 ? 'text-text-muted' : freezeRemainingCount <= 0 ? 'text-red-400' : 'text-blue-300'}`}>
                                                {freezeTrackerStatusLabel}
                                            </span>
                                            <p className="text-[11px] text-white mt-1">{freezeUtilizationPct}% used</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
                                        {freezeUseSlotDisplay ? (
                                            <div
                                                className="grid gap-1.5"
                                                style={{ gridTemplateColumns: `repeat(${Math.min(6, Math.max(1, freezeLimitCount))}, minmax(0, 1fr))` }}
                                            >
                                                {freezeSlots.map((isUsed, idx) => (
                                                    <span
                                                        key={`freeze-slot-${idx}`}
                                                        className={`h-2.5 rounded-sm border ${isUsed ? 'bg-blue-400 border-blue-300/70' : 'bg-white/10 border-white/15'}`}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                <div className="h-full bg-blue-400" style={{ width: `${freezeAllowanceProgressPct}%` }} />
                                            </div>
                                        )}
                                        <div className="mt-2 flex items-center gap-3 text-[10px] text-text-muted">
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Used</span>
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/30" />Available</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-text-muted mt-2">
                                        Used {freezeUsedCount} of {freezeLimitCount} | Remaining {freezeRemainingCount}
                                    </p>
                                    <p className="text-[11px] text-text-muted mt-1">{freezeStatusLabel}</p>
                                    {hasFreezeWindow && (
                                        <p className="text-[11px] text-blue-200/90 mt-1">
                                            Freeze window progress: {Math.round(freezeProgressPct)}%
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (normalizedStatus === 'FREEZED') {
                                                handleStatusChange('ACTIVE');
                                                return;
                                            }
                                            if (canUseFreezeNow) setShowFreezeModal(true);
                                        }}
                                        disabled={normalizedStatus !== 'FREEZED' && !canUseFreezeNow}
                                        className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
                                    >
                                        {normalizedStatus === 'FREEZED' ? 'Unfreeze Now' : 'Use Freeze'}
                                    </button>
                                </article>

                                <article className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Guest Pass Tracker</p>
                                            <p className="text-[10px] text-text-muted/80 mt-1">Discrete pass consumption</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[11px] font-semibold ${guestPassLimitCount <= 0 ? 'text-text-muted' : guestPassRemainingCount <= 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                                                {guestTrackerStatusLabel}
                                            </span>
                                            <p className="text-[11px] text-white mt-1">{guestPassUtilizationPct}% used</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
                                        {guestPassUseSlotDisplay ? (
                                            <div
                                                className="grid gap-1.5"
                                                style={{ gridTemplateColumns: `repeat(${Math.min(6, Math.max(1, guestPassLimitCount))}, minmax(0, 1fr))` }}
                                            >
                                                {guestPassSlots.map((isUsed, idx) => (
                                                    <span
                                                        key={`guest-pass-slot-${idx}`}
                                                        className={`h-2.5 rounded-sm border ${isUsed ? 'bg-emerald-400 border-emerald-300/70' : 'bg-white/10 border-white/15'}`}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                <div className="h-full bg-emerald-400" style={{ width: `${guestPassProgressPct}%` }} />
                                            </div>
                                        )}
                                        <div className="mt-2 flex items-center gap-3 text-[10px] text-text-muted">
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Used</span>
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/30" />Available</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-text-muted mt-2">
                                        Used {guestPassUsedCount} of {guestPassLimitCount} | Remaining {guestPassRemainingCount}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={openGuestPassCountModal}
                                        disabled={!canUseGuestPassNow}
                                        className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
                                    >
                                        Use Guest Pass
                                    </button>
                                </article>

                                <article className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Class Session Tracker</p>
                                            <p className="text-[10px] text-text-muted/80 mt-1">Stacked usage distribution</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[11px] font-semibold ${classSessionsStatusLabel === 'Available' ? 'text-orange-300' : classSessionsStatusLabel === 'Depleted' ? 'text-red-400' : 'text-text-muted'}`}>
                                                {classSessionsStatusLabel}
                                            </span>
                                            <p className="text-[11px] text-white mt-1">{classSessionsUtilizationPct}% used</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
                                        <div className="h-3 rounded-full bg-white/10 overflow-hidden flex">
                                            <div
                                                className="h-full bg-orange-400"
                                                style={{ width: `${classSessionsTotal > 0 ? classSessionsProgressPct : 0}%` }}
                                            />
                                            <div
                                                className={`h-full ${classSessionsTotal > 0 ? 'bg-emerald-400/80' : 'bg-white/10'}`}
                                                style={{ width: `${classSessionsTotal > 0 ? 100 - classSessionsProgressPct : 100}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 flex items-center gap-3 text-[10px] text-text-muted">
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" />Used</span>
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400/80" />Remaining</span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                            <p className="text-text-muted">Used: <span className="text-white font-semibold">{classSessionsUsed}</span></p>
                                            <p className="text-text-muted">Remaining: <span className="text-white font-semibold">{classSessionsRemaining}</span></p>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-text-muted mt-2">
                                        Included {classSessionsIncluded} | Purchased {classSessionsPurchased} | Total {classSessionsTotal}
                                    </p>
                                    <button
                                        type="button"
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
                                        className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
                                    >
                                        Add Sessions
                                    </button>
                                </article>

                                <article className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-12">
                                    <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Account Snapshot</p>
                                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                        <p className="text-text-muted">Total Spent: <span className="text-white font-semibold">{formatPrice(totalSpent)}</span></p>
                                        <p className="text-text-muted">Points: <span className="text-white font-semibold">{member.points || 0}</span></p>
                                        <p className="text-text-muted">Current Status: <span className="text-white font-semibold">{member.status}</span></p>
                                        <p className="text-text-muted">Last Payment: <span className="text-white font-semibold">{latestPaymentDate}</span></p>
                                    </div>
                                </article>

                                <article className="rounded-xl border border-white/10 bg-white/5 p-4 xl:col-span-12">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Department Snapshot</p>
                                            <p className="text-xs text-text-muted mt-1">Cross-tab summary for payments, activity, notes, and rewards.</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                        <article className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Payments</p>
                                            <p className="text-sm font-semibold text-white mt-1">{formatPrice(totalSpent)}</p>
                                            <p className="text-[11px] text-text-muted mt-1">{paymentRows.length} transaction{paymentRows.length === 1 ? '' : 's'}</p>
                                            <p className="text-[11px] text-text-muted">Last: {latestPaymentDate}</p>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('payments')}
                                                className="mt-2 text-[11px] text-primary hover:underline font-semibold"
                                            >
                                                View All
                                            </button>
                                        </article>
                                        <article className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Activity</p>
                                            <p className="text-sm font-semibold text-white mt-1">{accessLogs.length} visits</p>
                                            <p className="text-[11px] text-text-muted mt-1">7 days: {visitsLast7Days}</p>
                                            <p className="text-[11px] text-text-muted">30 days: {visitsLast30Days}</p>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('activity')}
                                                className="mt-2 text-[11px] text-primary hover:underline font-semibold"
                                            >
                                                View All
                                            </button>
                                        </article>
                                        <article className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Notes</p>
                                            <p className="text-sm font-semibold text-white mt-1">{notes.length} note{notes.length === 1 ? '' : 's'}</p>
                                            <p className="text-[11px] text-text-muted mt-1">Latest: {latestNoteDate}</p>
                                            <p className="text-[11px] text-text-muted">Owner: Staff Team</p>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('notes')}
                                                className="mt-2 text-[11px] text-primary hover:underline font-semibold"
                                            >
                                                View All
                                            </button>
                                        </article>
                                        <article className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">Rewards</p>
                                            <p className="text-sm font-semibold text-white mt-1">{member?.points || 0} pts</p>
                                            <p className="text-[11px] text-text-muted mt-1">{loyaltyTransactions.length} transaction{loyaltyTransactions.length === 1 ? '' : 's'}</p>
                                            <p className="text-[11px] text-text-muted">Latest: {latestLoyaltyDate}</p>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('history')}
                                                className="mt-2 text-[11px] text-primary hover:underline font-semibold"
                                            >
                                                View All
                                            </button>
                                        </article>
                                    </div>
                                </article>
                            </div>
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
                <section className="rounded-2xl border border-white/10 bg-surface p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Recent Activity</h3>
                            <p className="text-xs text-text-muted mt-1">Member check-ins and access events.</p>
                        </div>
                        <div className="flex gap-1.5">
                            {['7days', '30days', 'all'].map(period => (
                                <button
                                    key={period}
                                    type="button"
                                    onClick={() => setActivityFilter(period)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activityFilter === period ? 'bg-primary text-white' : 'bg-white/5 text-text-muted hover:text-white'}`}
                                >
                                    {period === 'all' ? 'All Time' : period === '30days' ? '30 Days' : '7 Days'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-0">
                        {filteredLogs.map((log) => (
                            <article key={`feed-${log.id}`} className="flex items-start gap-3 py-3 border-b border-white/10 last:border-b-0">
                                <span className={`mt-1.5 h-2 w-2 rounded-full ${log.status === 'ALLOWED' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white">{log.status === 'ALLOWED' ? 'Checked in at gym' : 'Access denied'}</p>
                                    <p className="text-xs text-text-muted mt-1">{new Date(log.checkIn).toLocaleString()}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${log.status === 'ALLOWED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                    {log.status === 'ALLOWED' ? 'Done' : 'Denied'}
                                </span>
                            </article>
                        ))}
                        {filteredLogs.length === 0 && (
                            <p className="text-sm text-text-muted py-4 text-center">No activity found for this filter.</p>
                        )}
                    </div>
                </section>
            )}

            {activeTab === '__legacy_activity' && (
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
                    <div className="px-5 py-3 border-b border-white/5 grid gap-2 sm:grid-cols-3 bg-black/10">
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Total Visits</p>
                            <p className="text-sm font-semibold text-white mt-1">{accessLogs.length}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Last Visit</p>
                            <p className="text-sm font-semibold text-white mt-1">{latestAccessDate}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Filter</p>
                            <p className="text-sm font-semibold text-white mt-1">{activityFilter === 'all' ? 'All Time' : activityFilter === '30days' ? '30 Days' : '7 Days'}</p>
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
                <section className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-text-muted">Total Paid</p>
                            <p className="text-xl font-semibold text-white leading-none mt-1">{formatPrice(totalSpent)}</p>
                            <p className="text-[11px] text-text-muted mt-1">{paymentRows.length} transactions</p>
                        </article>
                        <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-text-muted">Latest Payment</p>
                            <p className="text-xl font-semibold text-white leading-none mt-1">{latestPaymentDate}</p>
                            <p className="text-[11px] text-text-muted mt-1">{loadingPayments ? 'Refreshing records...' : 'From member ledger'}</p>
                        </article>
                        <article className="rounded-xl border border-white/10 bg-surface px-3.5 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-text-muted">Loyalty Points</p>
                            <p className="text-xl font-semibold text-yellow-300 leading-none mt-1">{member?.points || 0}</p>
                            <p className="text-[11px] text-text-muted mt-1">From payments: +{totalPointsFromPayments} pts</p>
                        </article>
                    </div>
                    <section className="rounded-2xl border border-white/10 bg-surface p-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/90 mb-2">Payments-History</h3>
                        <div className="space-y-0">
                            {paymentRows.map((pay) => (
                                <div key={`pay-row-${pay.id}`} className="py-3 border-b border-white/10 last:border-b-0 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-white">{String(pay.type || 'Payment').replace(/_/g, ' ')}</p>
                                        <p className="text-[11px] text-text-muted">{new Date(pay.date).toLocaleString()} | {pay.method || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-semibold ${Number(pay.amount || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                            {formatPrice(pay.amount || 0)}
                                        </p>
                                        <p className="text-[11px] text-yellow-300 font-semibold">
                                            +{Math.max(0, Number(pay?.pointsAwarded || 0))} pts
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {paymentRows.length === 0 && <p className="text-sm text-text-muted py-4 text-center">No payment history yet.</p>}
                        </div>
                    </section>
                </section>
            )}

            {activeTab === '__legacy_payments' && (
                <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-white font-bold flex items-center gap-2"><span className="material-icons-round text-primary text-base">receipt_long</span> Payment History</h3>
                        <span className="text-xs text-text-muted">{loadingPayments ? 'Loading...' : `${paymentRows.length} records`}</span>
                    </div>
                    <div className="px-5 py-3 border-b border-white/5 grid gap-2 sm:grid-cols-3 bg-black/10">
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Total Value</p>
                            <p className="text-sm font-semibold text-white mt-1">{formatPrice(totalSpent)}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Transactions</p>
                            <p className="text-sm font-semibold text-white mt-1">{paymentRows.length}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Latest Payment</p>
                            <p className="text-sm font-semibold text-white mt-1">{latestPaymentDate}</p>
                        </div>
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
                <section className="rounded-2xl border border-white/10 bg-surface p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Staff Notes</h3>
                        <button
                            type="button"
                            onClick={() => setShowNotesModal(true)}
                            className="bg-primary hover:bg-orange-600 text-white px-3.5 py-2 rounded-lg text-sm font-semibold"
                        >
                            Add Note
                        </button>
                    </div>
                    <div className="space-y-2">
                        {notes.map((note, idx) => (
                            <article
                                key={`note-card-${note.id}`}
                                className={`rounded-xl bg-black/20 p-3.5 border-l-4 ${idx === 0 ? 'border-primary' : idx === 1 ? 'border-amber-400' : 'border-blue-400'}`}
                            >
                                <p className="text-sm text-white whitespace-pre-wrap">{note.content}</p>
                                <p className="text-[11px] text-text-muted mt-2">{note.author?.name || 'Staff'} | {new Date(note.createdAt).toLocaleString()}</p>
                            </article>
                        ))}
                        {notes.length === 0 && <p className="text-sm text-text-muted py-4 text-center">No staff notes available.</p>}
                    </div>
                </section>
            )}

            {activeTab === '__legacy_notes' && (
                <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-white font-bold flex items-center gap-2"><span className="material-icons-round text-primary text-base">description</span> Staff Notes</h3>
                        <button onClick={() => setShowNotesModal(true)} className="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5">
                            <span className="material-icons-round text-sm">add</span> Add Note
                        </button>
                    </div>
                    <div className="px-5 py-3 border-b border-white/5 grid gap-2 sm:grid-cols-3 bg-black/10">
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Total Notes</p>
                            <p className="text-sm font-semibold text-white mt-1">{notes.length}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Latest Note</p>
                            <p className="text-sm font-semibold text-white mt-1">{latestNoteDate}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Managed By</p>
                            <p className="text-sm font-semibold text-white mt-1">Staff Team</p>
                        </div>
                    </div>
                    <div className="p-5 space-y-3 max-h-[620px] overflow-y-auto">
                        {notes.map(note => (
                            <article key={note.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">{note.author?.name || 'Staff'} | {new Date(note.createdAt).toLocaleString()}</p>
                                <p className="mt-2 text-sm text-white whitespace-pre-wrap">{note.content}</p>
                            </article>
                        ))}
                        {notes.length === 0 && <p className="text-sm text-text-muted">No staff notes available.</p>}
                    </div>
                </section>
            )}

            {activeTab === 'history' && (
                <section className="space-y-3">
                    <section className="rounded-2xl border border-white/10 bg-surface p-4 overflow-x-auto">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Check-in History</h3>
                            <span className="text-xs text-text-muted">{checkInLogs.length} records</span>
                        </div>
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="text-left border-b border-white/10">
                                    <th className="py-2 text-[11px] uppercase tracking-wider text-text-muted font-medium">Date</th>
                                    <th className="py-2 text-[11px] uppercase tracking-wider text-text-muted font-medium">Time</th>
                                    <th className="py-2 text-[11px] uppercase tracking-wider text-text-muted font-medium">Activity</th>
                                    <th className="py-2 text-[11px] uppercase tracking-wider text-text-muted font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {checkInLogs.map((log) => (
                                    <tr key={`history-access-${log.id}`} className="border-b border-white/10 last:border-b-0">
                                        <td className="py-2.5 text-white">{new Date(log.checkIn).toLocaleDateString()}</td>
                                        <td className="py-2.5 text-text-secondary">{new Date(log.checkIn).toLocaleTimeString()}</td>
                                        <td className="py-2.5 text-text-secondary">Gym Check-in</td>
                                        <td className="py-2.5">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                                                ALLOWED
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {checkInLogs.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="py-6 text-center text-text-muted">No check-in history yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                </section>
            )}

            {activeTab === '__legacy_history' && (
                <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                        <div>
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <span className="material-icons-round text-yellow-400 text-base">star</span>
                                Rewards History
                            </h3>
                            <p className="text-xs text-text-muted mt-0.5">Member's loyalty points and activity ledger</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-bold text-yellow-400">{member?.points || 0}</span>
                            <p className="text-[10px] uppercase tracking-wider text-text-muted mt-0.5">Total Points</p>
                        </div>
                    </div>
                    <div className="px-5 py-3 border-b border-white/5 grid gap-2 sm:grid-cols-3 bg-black/10">
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Current Points</p>
                            <p className="text-sm font-semibold text-white mt-1">{member?.points || 0}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Transactions</p>
                            <p className="text-sm font-semibold text-white mt-1">{loyaltyTransactions.length}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Latest Reward Entry</p>
                            <p className="text-sm font-semibold text-white mt-1">{latestLoyaltyDate}</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[620px]">
                        <table className="w-full min-w-[620px]">
                            <thead className="bg-white/5 sticky top-0">
                                <tr className="text-left">
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Date</th>
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Type</th>
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted">Description</th>
                                    <th className="px-5 py-2.5 text-[11px] uppercase tracking-wide text-text-muted text-right">Points</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {member?.loyaltyTransactions?.length > 0 ? (
                                    member.loyaltyTransactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-3 text-sm text-white">
                                                {new Date(tx.createdAt).toLocaleDateString()}
                                                <div className="text-[11px] text-text-muted mt-0.5">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-[10px] px-2 py-1 rounded-md bg-white/10 text-white/80 uppercase tracking-widest">{tx.type}</span>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-text-secondary">{tx.description || tx.type}</td>
                                            <td className={`px-5 py-3 text-right font-bold ${tx.type === 'REDEEMED' || tx.type === 'REVERSED' ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {tx.type === 'REDEEMED' || tx.type === 'REVERSED' ? '-' : '+'}{tx.points}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-5 py-12 text-center text-sm text-text-muted">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="material-icons-round text-3xl opacity-20">history</span>
                                                No reward history available yet.
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

                </div>

            </div>

            {/* Modals */}

            {showGuestPassCountModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-2">Guest Pass Usage</h3>
                        <p className="text-sm text-text-muted mb-6">
                            Remaining guest pass: {guestPassRemainingCount} of {guestPassLimitCount}
                        </p>
                        <form onSubmit={handleGuestPassCountSubmit} className="space-y-4">
                            <div>
                                <label className="text-text-muted text-sm mb-2 block">How many guests will use the pass?</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    max={Math.max(1, guestPassRemainingCount)}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none"
                                    value={guestPassCountInput}
                                    onChange={(e) => setGuestPassCountInput(e.target.value)}
                                />
                            </div>
                            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                                A printable guest pass agreement will be shown next.
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowGuestPassCountModal(false)}
                                    className="text-text-muted"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="bg-primary text-white font-bold px-8 py-2.5 rounded-2xl">
                                    Continue
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showGuestPassTermsModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                    <div className="bg-surface border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <div>
                                <h3 className="text-xl font-bold text-white">Guest Pass Agreement</h3>
                                <p className="text-xs text-text-muted mt-1">Print agreement, then confirm guest pass usage.</p>
                            </div>
                            <button
                                type="button"
                                onClick={resetGuestPassWorkflow}
                                className="text-text-muted hover:text-white transition-colors"
                            >
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[72vh] bg-white text-black" ref={guestPassPrintRef}>
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-black uppercase tracking-widest border-b-2 border-black pb-2 mb-1">Guest Pass Agreement</h1>
                                <p className="text-sm italic">Temporary Access, Waiver, and Conduct Terms</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                <div className="border border-black p-3 rounded">
                                    <p className="font-bold border-b border-black mb-1">MEMBER SPONSOR</p>
                                    <p><strong>Name:</strong> {member.firstName} {member.lastName}</p>
                                    <p><strong>Member ID:</strong> #{member.id}</p>
                                    <p><strong>Plan:</strong> {stats.combinedPlanLabel || 'N/A'}</p>
                                </div>
                                <div className="border border-black p-3 rounded">
                                    <p className="font-bold border-b border-black mb-1">GUEST PASS DETAILS</p>
                                    <p><strong>Guests Covered:</strong> {guestPassCount}</p>
                                    <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8 text-xs leading-relaxed">
                                <section>
                                    <p className="font-bold uppercase mb-1">1. Assumption of Risk</p>
                                    <p>Guest understands gym activities involve physical risk and voluntarily assumes all related risks while using facilities.</p>
                                </section>
                                <section>
                                    <p className="font-bold uppercase mb-1">2. Facility Rules</p>
                                    <p>Guest agrees to follow all gym rules, proper equipment use, and staff instructions at all times.</p>
                                </section>
                                <section>
                                    <p className="font-bold uppercase mb-1">3. Liability Waiver</p>
                                    <p>Guest and sponsoring member release the gym and staff from liability for injuries, losses, or damages arising from facility use.</p>
                                </section>
                                <section>
                                    <p className="font-bold uppercase mb-1">4. Conduct and Accountability</p>
                                    <p>Guest acknowledges that violations may result in denied access. Sponsoring member accepts accountability for guest conduct.</p>
                                </section>
                            </div>

                            <div className="border border-black rounded p-4">
                                <p className="font-bold text-sm border-b border-black pb-1 mb-3">GUEST SIGNATURE SHEET</p>
                                <div className="space-y-3 text-xs">
                                    {Array.from({ length: guestPassCount }).map((_, index) => (
                                        <div key={`guest-pass-line-${index}`} className="grid grid-cols-12 gap-2">
                                            <p className="col-span-1">{index + 1}.</p>
                                            <p className="col-span-5 border-b border-black min-h-[18px]">Name</p>
                                            <p className="col-span-4 border-b border-black min-h-[18px]">Signature</p>
                                            <p className="col-span-2 border-b border-black min-h-[18px]">Time In</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-white/10 bg-white/5 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowGuestPassTermsModal(false);
                                    setShowGuestPassCountModal(true);
                                }}
                                className="px-4 py-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={triggerGuestPassPrint}
                                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors flex items-center gap-2"
                            >
                                <span className="material-icons-round text-base">print</span>
                                Print Agreement
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmGuestPassUsage}
                                disabled={submittingGuestPass}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors"
                            >
                                {submittingGuestPass ? 'Recording...' : `Confirm ${guestPassCount} Guest Pass`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            if (!canUseFreezeNow) return;
                            handleStatusChange('FREEZED', {
                                freezeStartDate: freezeData.startDate,
                                freezeEndDate: freezeData.endDate
                            });
                        }} className="space-y-4">
                            <div className={`rounded-xl border px-3 py-2 text-xs ${canUseFreezeNow ? 'border-blue-500/25 bg-blue-500/10 text-blue-200' : 'border-red-500/25 bg-red-500/10 text-red-200'}`}>
                                {canUseFreezeNow
                                    ? `Freeze usage left: ${freezeRemainingCount} of ${freezeLimitCount}`
                                    : (freezeLimitCount <= 0
                                        ? 'This plan does not allow freezing.'
                                        : 'Freeze usage limit reached for this membership.')}
                            </div>
                            <div>
                                <label className="text-text-muted text-sm mb-2 block">Start Date</label>
                                <input required type="date" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={freezeData.startDate} onChange={e => setFreezeData({ ...freezeData, startDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-text-muted text-sm mb-2 block">End Date</label>
                                <input required type="date" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={freezeData.endDate} onChange={e => setFreezeData({ ...freezeData, endDate: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowFreezeModal(false)} className="text-text-muted">Cancel</button>
                                <button type="submit" disabled={!canUseFreezeNow} className="bg-blue-500 text-white font-bold px-8 py-2.5 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed">Freeze</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}








