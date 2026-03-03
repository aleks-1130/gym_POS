import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { withApiBase } from '../../config/api';
import { useConfirm } from '../../context/ConfirmContext';

// Reusable Components
import StatCard from '../../components/common/StatCard';
import InfoCard from '../../components/common/InfoCard';
import ActivityLogItem from '../../components/common/ActivityLogItem';
import TabNavigation from '../../components/common/TabNavigation';

// Custom Hooks
import { useMemberStats } from '../../hooks/useMemberStats';

// Services
import { memberService } from '../../services/memberService';
import { planService } from '../../services/planService';

// Utils
import { getFilteredLogs, getGroupedLogs, calculateDaysRemaining } from '../../utils/memberUtils';
import { formatDate } from '../../utils/dateUtils';

// Constants
import { TABS, PAYMENT_METHODS, ACTIVITY_FILTERS } from '../../constants/memberConstants';

export default function MemberDetail() {
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const { id } = useParams();
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState([]);
    const [classSessionPackages, setClassSessionPackages] = useState([]);

    // Modals
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [showClassSessionModal, setShowClassSessionModal] = useState(false);

    // Form Data
    const [renewData, setRenewData] = useState({ planId: '', duration: 30, amount: 0, method: 'CASH' });
    const [renewAmountTendered, setRenewAmountTendered] = useState('');
    const [renewGcashReference, setRenewGcashReference] = useState('');
    const [renewGcashDate, setRenewGcashDate] = useState('');
    const [renewGcashTime, setRenewGcashTime] = useState('');
    const [freezeData, setFreezeData] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
    });
    const [passwordData, setPasswordData] = useState('');
    const [noteData, setNoteData] = useState('');
    const [notes, setNotes] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [editFormData, setEditFormData] = useState({});
    const [classSessionPurchaseData, setClassSessionPurchaseData] = useState({
        packageId: '',
        method: 'CASH',
        cashTendered: '',
        gcashReference: '',
        gcashDate: '',
        gcashTime: ''
    });

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
        fetchPlans();
        fetchSessionPackages();
        fetchNotes();
        fetchPayments();
    }, [id]);

    const fetchMember = useCallback(async () => {
        try {
            const data = await memberService.getMemberById(id);
            setMember(data);
            if (data.plan) {
                setRenewData(prev => ({
                    ...prev,
                    planId: data.plan.id,
                    amount: data.plan.price,
                    duration: data.plan.duration
                }));
            }
        } catch (e) {
            showAlert({ title: "Member Not Found", message: "Member not found", type: "danger" });
            navigate('/members');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    const fetchPlans = useCallback(async () => {
        try {
            const data = await planService.getAllPlans();
            setPlans(data);
        } catch (e) {
            console.error("Failed to fetch plans", e);
        }
    }, []);

    const fetchSessionPackages = useCallback(async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans/class-session-packages'));
            setClassSessionPackages((res.data || []).filter(item => item.isActive));
        } catch (e) {
            console.error("Failed to fetch class session packages", e);
        }
    }, []);

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

    const handlePlanChange = useCallback((planId) => {
        const selectedPlan = plans.find(p => p.id === parseInt(planId));
        if (selectedPlan) {
            setRenewData({
                ...renewData,
                planId: selectedPlan.id,
                duration: selectedPlan.duration,
                amount: selectedPlan.price
            });
        }
    }, [plans, renewData]);

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
            } catch (_) {
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
        } catch (e) {
            showAlert({ title: "Status Error", message: "Failed to update status", type: "danger" });
        }
    };

    const submitRenew = useCallback(async (paymentInfo = {}) => {
        try {
            await memberService.renewMembership(id, { ...renewData, ...paymentInfo });
            setShowRenewModal(false);
            showAlert({ title: "Renewed!", message: "Membership renewed successfully!", type: "success" });
            fetchMember();
        } catch (e) {
            showAlert({ title: "Renewal Failed", message: "Renewal failed. Please try again.", type: "danger" });
        }
    }, [id, renewData, fetchMember]);

    const handleRenew = (e) => {
        e.preventDefault();
        if (renewData.method === 'CASH') {
            const tenderedAmount = parseFloat(renewAmountTendered) || 0;
            if (tenderedAmount < renewData.amount) return;
            const changeDue = Math.max(0, (tenderedAmount - renewData.amount));
            submitRenew({ cashTendered: tenderedAmount, changeDue });
            return;
        }

        if (renewData.method === 'GCASH') {
            if (!renewGcashReference || !renewGcashDate || !renewGcashTime) return;
            submitRenew({
                gcashReference: renewGcashReference,
                gcashDate: renewGcashDate,
                gcashTime: renewGcashTime
            });
            return;
        }

        submitRenew();
    };

    const handleClassSessionPurchase = async (e) => {
        e.preventDefault();
        if (!classSessionPurchaseData.packageId) return;

        const payload = {
            packageId: Number(classSessionPurchaseData.packageId),
            method: classSessionPurchaseData.method
        };

        if (classSessionPurchaseData.method === 'CASH') {
            const tendered = Number(classSessionPurchaseData.cashTendered || 0);
            if (!Number.isFinite(tendered) || tendered <= 0) {
                showAlert({ title: "Invalid Amount", message: "Enter a valid tendered amount", type: "warning" });
                return;
            }
            payload.cashTendered = tendered;
        }

        if (classSessionPurchaseData.method === 'GCASH') {
            if (!classSessionPurchaseData.gcashReference || !classSessionPurchaseData.gcashDate || !classSessionPurchaseData.gcashTime) {
                showAlert({ title: "Missing Info", message: "GCash reference, date, and time are required", type: "warning" });
                return;
            }
            payload.gcashReference = classSessionPurchaseData.gcashReference;
            payload.gcashDate = classSessionPurchaseData.gcashDate;
            payload.gcashTime = classSessionPurchaseData.gcashTime;
        }

        try {
            await axios.post(withApiBase(`/api/members/${id}/class-session-packages`), payload);
            setShowClassSessionModal(false);
            setClassSessionPurchaseData({
                packageId: '',
                method: 'CASH',
                cashTendered: '',
                gcashReference: '',
                gcashDate: '',
                gcashTime: ''
            });
            showAlert({ title: "Sessions Added", message: "Class sessions added successfully", type: "success" });
            fetchMember();
            fetchPayments();
        } catch (e) {
            showAlert({ title: "Add Failed", message: e.response?.data?.error || "Failed to add class sessions", type: "danger" });
        }
    };

    const handleSetPassword = useCallback(async (e) => {
        e.preventDefault();
        try {
            await memberService.setMemberPassword(member.email, passwordData);
            setShowPasswordModal(false);
            setPasswordData('');
            showAlert({ title: "Password Set", message: "Password set successfully!", type: "success" });
        } catch (e) {
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
        } catch (e) {
            showAlert({ title: "Update Failed", message: "Failed to update member", type: "danger" });
        }
    }, [id, editFormData, fetchMember]);

    // Memoized filtered and grouped logs
    const filteredLogs = useMemo(() =>
        getFilteredLogs(member?.accessLogs, activityFilter),
        [member?.accessLogs, activityFilter]
    );

    const groupedLogs = useMemo(() =>
        getGroupedLogs(filteredLogs),
        [filteredLogs]
    );
    const currentPlan = useMemo(
        () => member?.plan || plans.find((p) => p.id === Number(member?.planId)) || null,
        [member, plans]
    );

    useEffect(() => {
        if (!currentPlan) return;
        setRenewData((prev) => {
            if (
                Number(prev.planId) === Number(currentPlan.id) &&
                Number(prev.amount) === Number(currentPlan.price) &&
                Number(prev.duration) === Number(currentPlan.duration)
            ) {
                return prev;
            }
            return {
                ...prev,
                planId: currentPlan.id,
                amount: currentPlan.price,
                duration: currentPlan.duration
            };
        });
    }, [currentPlan]);


    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    );
    if (!member) return null;

    const initials = `${member.firstName[0]}${member.lastName[0]}`;


    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm">
                <button onClick={() => navigate('/dashboard')} className="text-text-muted hover:text-primary transition-colors">Dashboard</button>
                <span className="text-text-muted">/</span>
                <button onClick={() => navigate('/members')} className="text-text-muted hover:text-primary transition-colors">Members</button>
                <span className="text-text-muted">/</span>
                <span className="text-white font-medium">{member.firstName} {member.lastName}</span>
            </div>

            {/* Hero Header */}
            <div className="bg-gradient-to-br from-primary/20 via-orange-500/10 to-transparent rounded-3xl border border-white/5 overflow-hidden shadow-lg">
                <div className="p-8">
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        <div className="flex items-center gap-6">
                            <div className="relative group">
                                <div className="w-32 h-32 bg-gradient-to-br from-primary to-orange-600 rounded-3xl flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-primary/20 overflow-hidden border-4 border-white/10">
                                    {member.imageUrl ? <img src={member.imageUrl} className="w-full h-full object-cover" alt="" /> : initials}
                                </div>
                                <button onClick={() => setShowPhotoModal(true)} className="absolute -bottom-2 -right-2 bg-primary hover:bg-orange-600 text-white p-3 rounded-2xl shadow-lg transition-all active:scale-95">
                                    <span className="material-icons-round text-sm">photo_camera</span>
                                </button>
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-4xl font-extrabold text-white tracking-tight mb-1">{member.firstName} {member.lastName}</h1>
                                    <button onClick={handleEditClick} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"><span className="material-icons-round text-sm">edit</span></button>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap mb-3">
                                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${member.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : member.status === 'FREEZED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {member.status}
                                    </span>
                                    <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-text-secondary border border-white/10">ID: {member.id}</span>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                                        <span className="material-icons-round text-xs text-text-muted">schedule</span>
                                        <span className="text-xs font-medium text-text-muted">Last active: {stats.lastActive}</span>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-${stats.attendanceScore.color}-500/10 border border-${stats.attendanceScore.color}-500/20 w-fit`}>
                                    <span className={`material-icons-round text-sm text-${stats.attendanceScore.color}-400`}>{stats.attendanceScore.icon}</span>
                                    <span className={`text-xs font-bold text-${stats.attendanceScore.color}-400`}>{stats.attendanceScore.label} Engagement</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 lg:ml-auto">
                            {/* Stat Cards */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[160px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-primary text-lg">stars</span>
                                    <p className="text-text-muted text-xs uppercase font-bold">Points</p>
                                </div>
                                <p className="text-3xl font-bold text-white">{member.points || 207}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[160px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-emerald-400 text-lg">check_circle</span>
                                    <p className="text-text-muted text-xs uppercase font-bold">Visits</p>
                                </div>
                                <p className="text-3xl font-bold text-white">{member.accessLogs?.length || 2}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[160px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-blue-400 text-lg">payments</span>
                                    <p className="text-text-muted text-xs uppercase font-bold">Spent</p>
                                </div>
                                <p className="text-3xl font-bold text-white">{formatPrice(member.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0)}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[160px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-amber-400 text-lg">event_available</span>
                                    <p className="text-text-muted text-xs uppercase font-bold">Class Sessions</p>
                                </div>
                                <p className={`text-3xl font-bold ${(member.classSessionsRemaining || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {member.classSessionsRemaining || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={() => setShowRenewModal(true)}
                    className="bg-primary hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                >
                    <span className="material-icons-round text-[18px]">autorenew</span> Renew Plan
                </button>
                <button
                    onClick={() => setShowFreezeModal(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                >
                    <span className="material-icons-round text-[18px]">ac_unit</span> Freeze
                </button>
                <button
                    onClick={() => setShowPasswordModal(true)}
                    className="bg-surfaceHighlight hover:bg-white/10 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 border border-white/5 transition-all"
                >
                    <span className="material-icons-round text-[18px]">lock_reset</span> Reset Password
                </button>
                <button
                    onClick={() => setShowNotesModal(true)}
                    className="bg-surfaceHighlight hover:bg-white/10 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 border border-white/5 transition-all"
                >
                    <span className="material-icons-round text-[18px]">note_add</span> Add Note
                </button>
                <button
                    onClick={() => setShowClassSessionModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                >
                    <span className="material-icons-round text-[18px]">add_circle</span> Add Class Sessions
                </button>
            </div>

            {/* Tab Navigation */}
            <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />


            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-primary/10 to-orange-500/10 border border-primary/20 rounded-3xl p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-2">Current Membership</p>
                                    <p className="text-3xl font-bold text-white mb-2">{stats.combinedPlanLabel}</p>
                                    <p className="text-primary font-semibold text-lg">{formatPrice(currentPlan?.price || 0)} / {currentPlan?.duration || 0} Days</p>
                                </div>
                                <div className="relative w-28 h-28">
                                    <svg className="transform -rotate-90 w-28 h-28">
                                        <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
                                        <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="none" strokeDasharray={`${2 * Math.PI * 48}`} strokeDashoffset={`${2 * Math.PI * 48 * (1 - stats.progress / 100)}`} className={`transition-all duration-1000 ${stats.progress > 90 ? 'text-red-500' : 'text-primary'}`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold text-white">{Math.max(0, stats.daysRemaining)}</span>
                                        <span className="text-[10px] text-text-muted font-semibold">days left</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted font-semibold">Membership Progress</span>
                                    <span className="text-white font-bold">{Math.round(stats.progress)}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${stats.progress > 90 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${stats.progress}%` }}></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div className="bg-white/5 rounded-xl p-3">
                                    <p className="text-text-muted font-semibold text-xs mb-1">Start Date</p>
                                    <p className="text-white font-bold">{member.startDate ? new Date(member.startDate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3">
                                    <p className="text-text-muted font-semibold text-xs mb-1">Expiry Date</p>
                                    <p className={`font-bold ${stats.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>{member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface rounded-3xl border border-white/5 p-6">
                            <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                                <span className="material-icons-round text-amber-400">event_note</span>
                                Class Session Tracking
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-2">Remaining</p>
                                    <p className={`text-2xl font-bold ${(member.classSessionsRemaining || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {member.classSessionsRemaining || 0}
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-2">Used</p>
                                    <p className="text-2xl font-bold text-white">{member.classSessionsUsed || 0}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-2">Purchased Sessions</p>
                                    <p className="text-2xl font-bold text-white">{member.classSessionsPurchased || 0}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-2">Plan Included</p>
                                    <p className="text-2xl font-bold text-white">
                                        {currentPlan?.includesClasses ? (currentPlan?.includedClassSessions || 0) : 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-white/5 bg-white/5"><h3 className="font-bold text-white flex items-center gap-2"><span className="material-icons-round text-primary">person</span> Personal Information</h3></div>
                            <div className="p-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    {[
                                        { label: 'Email Address', value: member.email },
                                        { label: 'Phone Number', value: member.phone || 'Not provided' },
                                        { label: 'Date of Birth', value: member.birthDate ? new Date(member.birthDate).toLocaleDateString() : 'Not provided' },
                                        { label: 'Gender', value: member.sex || 'Not specified' }
                                    ].map(info => (
                                        <div key={info.label} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                            <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">{info.label}</p>
                                            <p className="text-white font-bold text-sm truncate">{info.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-white/5 bg-white/5"><h3 className="font-bold text-white flex items-center gap-2"><span className="material-icons-round text-primary">insights</span> Member Insights</h3></div>
                            <div className="p-5 space-y-4">
                                <div className={`bg-gradient-to-br from-${stats.attendanceScore.color}-500/10 to-${stats.attendanceScore.color}-600/5 rounded-2xl p-4 border border-${stats.attendanceScore.color}-500/20`}>
                                    <p className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Engagement</p>
                                    <p className={`text-2xl font-bold text-${stats.attendanceScore.color}-400 mb-1`}>{stats.attendanceScore.label}</p>
                                    <p className="text-text-muted text-[10px]">Based on 30-day activity</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-2xl p-4 border border-purple-500/20">
                                    <p className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Retention Risk</p>
                                    <p className="text-2xl font-bold text-purple-400 mb-1">{stats.isExpired ? 'High' : stats.isExpiringSoon ? 'Medium' : 'Low'}</p>
                                    <p className="text-text-muted text-[10px]">{stats.isExpired ? 'Membership expired' : stats.isExpiringSoon ? 'Expiring soon' : 'Active membership'}</p>
                                </div>
                                <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-2xl p-4 border border-cyan-500/20">
                                    <p className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Avg Visit Time</p>
                                    <p className="text-2xl font-bold text-cyan-400 mb-1">45 min</p>
                                    <p className="text-text-muted text-[10px]">Average session duration</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2"><span className="material-icons-round text-primary">history</span> Recent Activity</h3>
                                <button onClick={() => setActiveTab('activity')} className="text-primary text-sm font-bold hover:underline">View All</button>
                            </div>
                            <div className="p-6 space-y-3">
                                {filteredLogs.slice(0, 5).map(log => (
                                    <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/20 transition-all">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                            <span className="material-icons-round text-lg">{log.status === 'ALLOWED' ? 'check_circle' : 'cancel'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-sm truncate">{log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}</p>
                                            <p className="text-text-muted text-[10px]">{new Date(log.checkIn).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'activity' && (
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2"><span className="material-icons-round text-primary">history</span> Activity Timeline</h3>
                        <div className="flex gap-2">
                            {['7days', '30days', 'all'].map(period => (
                                <button key={period} onClick={() => setActivityFilter(period)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activityFilter === period ? 'bg-primary text-white' : 'bg-white/5 text-text-muted hover:text-white'}`}>
                                    {period === 'all' ? 'All Time' : period === '30days' ? '30 Days' : '7 Days'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 max-h-[700px] overflow-y-auto space-y-6">
                        {Object.entries(groupedLogs).map(([date, logs]) => (
                            <div key={date} className="space-y-4">
                                <div className="flex items-center gap-3"><div className="bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20"><p className="text-primary font-bold text-sm">{date}</p></div><div className="h-px flex-1 bg-white/5"></div></div>
                                <div className="space-y-3">
                                    {logs.map(log => (
                                        <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/20 transition-all">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                <span className="material-icons-round text-lg">{log.status === 'ALLOWED' ? 'check_circle' : 'cancel'}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-bold text-sm truncate">{log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}</p>
                                                <p className="text-text-muted text-xs">{new Date(log.checkIn).toLocaleTimeString()}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{log.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'payments' && (
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm p-6">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-6"><span className="material-icons-round text-primary">receipt_long</span> Payment History</h3>
                    <div className="space-y-4">
                        {member.payments?.map(pay => (
                            <div key={pay.id} className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/20 transition-all">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-2xl font-bold text-white mb-1">{formatPrice(pay.amount)}</p>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider">{pay.type.replace('_', ' ')}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-block text-[10px] font-bold bg-background/50 text-text-muted px-3 py-1.5 rounded-lg border border-white/5 mb-2">{pay.method}</span>
                                        <p className="text-xs text-text-muted">{new Date(pay.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'notes' && (
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2"><span className="material-icons-round text-primary">description</span> Staff Notes</h3>
                        <button onClick={() => setShowNotesModal(true)} className="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
                            <span className="material-icons-round text-sm">add</span> Add Note
                        </button>
                    </div>
                    <div className="space-y-3">
                        {notes.map(note => (
                            <div key={note.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="text-[10px] text-text-muted mb-2 uppercase font-bold tracking-widest">{note.author?.name || 'Staff'} • {new Date(note.createdAt).toLocaleString()}</div>
                                <p className="text-sm text-white whitespace-pre-wrap">{note.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showClassSessionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-md border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Add Class Sessions</h3>
                        <form onSubmit={handleClassSessionPurchase} className="space-y-4">
                            <select
                                required
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none"
                                value={classSessionPurchaseData.packageId}
                                onChange={e => setClassSessionPurchaseData({ ...classSessionPurchaseData, packageId: e.target.value })}
                            >
                                <option value="">-- Choose Package --</option>
                                {classSessionPackages.map(pkg => (
                                    <option key={pkg.id} value={pkg.id}>
                                        {pkg.name} - {pkg.sessions} sessions ({formatPrice(pkg.price)})
                                    </option>
                                ))}
                            </select>

                            <select
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none"
                                value={classSessionPurchaseData.method}
                                onChange={e => setClassSessionPurchaseData({ ...classSessionPurchaseData, method: e.target.value })}
                            >
                                <option value="CASH">Cash</option>
                                <option value="GCASH">GCash</option>
                                <option value="CARD">Card</option>
                            </select>

                            {classSessionPurchaseData.method === 'CASH' && (
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white"
                                    placeholder="Amount Tendered"
                                    value={classSessionPurchaseData.cashTendered}
                                    onChange={e => setClassSessionPurchaseData({ ...classSessionPurchaseData, cashTendered: e.target.value })}
                                />
                            )}

                            {classSessionPurchaseData.method === 'GCASH' && (
                                <div className="space-y-3">
                                    <input
                                        required
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white"
                                        placeholder="GCash Reference"
                                        value={classSessionPurchaseData.gcashReference}
                                        onChange={e => setClassSessionPurchaseData({ ...classSessionPurchaseData, gcashReference: e.target.value })}
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            required
                                            type="date"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white"
                                            value={classSessionPurchaseData.gcashDate}
                                            onChange={e => setClassSessionPurchaseData({ ...classSessionPurchaseData, gcashDate: e.target.value })}
                                        />
                                        <input
                                            required
                                            type="time"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white"
                                            value={classSessionPurchaseData.gcashTime}
                                            onChange={e => setClassSessionPurchaseData({ ...classSessionPurchaseData, gcashTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowClassSessionModal(false)} className="text-text-muted">Cancel</button>
                                <button type="submit" className="bg-emerald-500 text-white font-bold px-8 py-2.5 rounded-2xl">Add Sessions</button>
                            </div>
                        </form>
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

            {showRenewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Renew Membership</h3>
                        <form onSubmit={handleRenew} className="space-y-4">
                            <select required className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={renewData.planId} onChange={e => handlePlanChange(e.target.value)}>
                                <option value="">-- Choose a Plan --</option>
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name} - {formatPrice(p.price)}</option>)}
                            </select>
                            <select className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={renewData.method} onChange={e => setRenewData({ ...renewData, method: e.target.value })}>
                                <option value="CASH">Cash</option><option value="GCASH">GCash</option>
                            </select>
                            {renewData.method === 'CASH' && <input required type="number" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white" placeholder="Amount Tendered" value={renewAmountTendered} onChange={e => setRenewAmountTendered(e.target.value)} />}
                            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowRenewModal(false)} className="text-text-muted">Cancel</button><button type="submit" className="bg-primary text-white font-bold px-8 py-2.5 rounded-2xl">Renew</button></div>
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
                        <form onSubmit={async e => { e.preventDefault(); if (!noteData.trim()) return; try { await axios.post(`/api/members/${id}/notes`, { content: noteData.trim() }); setNoteData(''); setShowNotesModal(false); fetchNotes(); } catch (e) { showAlert({ title: "Save Failed", message: "Failed to save note", type: "danger" }); } }} className="space-y-4">
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

            {showRenewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Renew Membership</h3>
                        <form onSubmit={handleRenew} className="space-y-4">
                            <select required className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={renewData.planId} onChange={e => handlePlanChange(e.target.value)}>
                                <option value="">-- Choose a Plan --</option>
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name} - {formatPrice(p.price)}</option>)}
                            </select>
                            <select className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white outline-none" value={renewData.method} onChange={e => setRenewData({ ...renewData, method: e.target.value })}>
                                <option value="CASH">Cash</option><option value="GCASH">GCash</option>
                            </select>
                            {renewData.method === 'CASH' && <input required type="number" className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white" placeholder="Amount Tendered" value={renewAmountTendered} onChange={e => setRenewAmountTendered(e.target.value)} />}
                            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowRenewModal(false)} className="text-text-muted">Cancel</button><button type="submit" className="bg-primary text-white font-bold px-8 py-2.5 rounded-2xl">Renew</button></div>
                        </form>
                    </div>
                </div>
            )}

            {showFreezeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Freeze Membership</h3>
                        <form onSubmit={(e) => { e.preventDefault(); handleStatusChange('FREEZED', freezeData); }} className="space-y-4">
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

