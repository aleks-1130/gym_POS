import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function MemberDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { formatPrice, rate } = useCurrency();
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState([]);

    // Modals
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false); // NEW
    const [showMoreActions, setShowMoreActions] = useState(false);

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
    // Edit Form Data
    const [editFormData, setEditFormData] = useState({});

    // Photo Capture
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [submittingPhoto, setSubmittingPhoto] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Activity Filter
    const [activityFilter, setActivityFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('overview'); // overview, activity, payments, notes

    useEffect(() => {
        fetchMember();
        fetchPlans();
        fetchNotes();
        fetchPayments();
    }, [id]);

    const fetchMember = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${id}`);
            setMember(res.data);
            if (res.data.plan) {
                setRenewData(prev => ({
                    ...prev,
                    planId: res.data.plan.id,
                    amount: res.data.plan.price,
                    duration: res.data.plan.duration
                }));
            }
        } catch (e) {
            alert("Member not found");
            navigate('/members');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/plans');
            setPlans(res.data);
        } catch (e) {
            console.error("Failed to fetch plans", e);
        }
    };

    const fetchNotes = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${id}/notes`);
            setNotes(res.data);
        } catch (e) {
            console.error("Failed to fetch notes", e);
        }
    };

    const fetchPayments = async () => {
        setLoadingPayments(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${id}/payments`);
            setPayments(res.data);
        } catch (e) {
            console.error("Failed to fetch payments", e);
        } finally {
            setLoadingPayments(false);
        }
    };

    const handlePlanChange = (planId) => {
        const selectedPlan = plans.find(p => p.id === parseInt(planId));
        if (selectedPlan) {
            setRenewData({
                ...renewData,
                planId: selectedPlan.id,
                duration: selectedPlan.duration,
                amount: selectedPlan.price
            });
        }
    };

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400, facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error(err);
            alert("Camera failed");
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
                await axios.put(`http://localhost:5000/api/members/${id}`, {
                    ...member,
                    imageUrl: imageData
                });
                stopCamera();
                setShowPhotoModal(false);
                fetchMember();
            } catch (e) {
                alert("Failed to update photo");
            } finally {
                setSubmittingPhoto(false);
            }
        }
    };

    const handleStatusChange = async (newStatus, extraData = {}) => {
        try {
            await axios.post(`http://localhost:5000/api/members/${id}/status`, {
                status: newStatus,
                ...extraData
            });
            setShowFreezeModal(false);
            fetchMember();
        } catch (e) {
            alert("Failed to update status");
        }
    };

    const submitRenew = async (paymentInfo = {}) => {
        try {
            const res = await axios.post(`http://localhost:5000/api/members/${id}/renew`, {
                ...renewData,
                ...paymentInfo
            });
            setShowRenewModal(false);
            alert("Membership Renewed!");
            fetchMember();
        } catch (e) {
            alert("Renewal failed");
        }
    };

    const handleRenew = (e) => {
        e.preventDefault();
        if (renewData.method === 'CASH') {
            const tendered = parseFloat(renewAmountTendered) || 0;
            if (tendered < (renewData.amount * rate)) return;
            const tenderedUsd = tendered / rate;
            const changeDue = Math.max(0, (tenderedUsd - renewData.amount));
            submitRenew({ cashTendered: tenderedUsd, changeDue });
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

    const handleSetPassword = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`http://localhost:5000/api/auth/member-setup`, { email: member.email, password: passwordData });
            setShowPasswordModal(false);
            setPasswordData('');
            alert("Password set successfully!");
        } catch (e) {
            alert("Failed to set password");
        }
    };

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

    const handleEditSave = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`http://localhost:5000/api/members/${id}`, editFormData);
            setShowEditModal(false);
            fetchMember();
            alert("Member details updated!");
        } catch (e) {
            alert("Failed to update member");
        }
    };

    const getDaysRemaining = () => {
        if (!member?.expiryDate) return 0;
        const today = new Date();
        const expiry = new Date(member.expiryDate);
        const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const getMembershipProgress = () => {
        if (!member?.startDate || !member?.expiryDate) return 0;
        const total = new Date(member.expiryDate) - new Date(member.startDate);
        const elapsed = new Date() - new Date(member.startDate);
        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    };

    const getFilteredLogs = () => {
        if (!member?.accessLogs) return [];
        const now = new Date();
        const logs = member.accessLogs;

        if (activityFilter === '7days') {
            const weekAgo = new Date(now.setDate(now.getDate() - 7));
            return logs.filter(log => new Date(log.checkIn) >= weekAgo);
        } else if (activityFilter === '30days') {
            const monthAgo = new Date(now.setDate(now.getDate() - 30));
            return logs.filter(log => new Date(log.checkIn) >= monthAgo);
        }
        return logs;
    };

    // Group logs by date
    const getGroupedLogs = () => {
        const logs = getFilteredLogs();
        const grouped = {};

        logs.forEach(log => {
            const date = new Date(log.checkIn).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(log);
        });

        return grouped;
    };

    // Calculate attendance score
    const getAttendanceScore = () => {
        const logs = member?.accessLogs || [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentLogs = logs.filter(log => new Date(log.checkIn) >= thirtyDaysAgo);

        const visitsPerWeek = (recentLogs.length / 30) * 7;
        if (visitsPerWeek >= 4) return { label: 'High', color: 'emerald', icon: 'trending_up' };
        if (visitsPerWeek >= 2) return { label: 'Medium', color: 'amber', icon: 'trending_flat' };
        return { label: 'Low', color: 'red', icon: 'trending_down' };
    };

    // Get last active time
    const getLastActive = () => {
        const logs = member?.accessLogs || [];
        if (logs.length === 0) return 'Never';

        const lastLog = logs[0];
        const lastDate = new Date(lastLog.checkIn);
        const now = new Date();
        const diffMs = now - lastDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    );
    if (!member) return null;

    const initials = `${member.firstName[0]}${member.lastName[0]}`;
    const now = new Date();
    const activePeriods = (member.membershipPeriods || []).filter((p) => new Date(p.endDate) >= now);
    const combinedPlanLabel = [
        member.plan?.name,
        ...activePeriods.map((p) => p.plan?.name)
    ]
        .filter(Boolean)
        .reduce((acc, name) => (acc.includes(name) ? acc : [...acc, name]), [])
        .join(' + ') || 'No Plan';
    const daysRemaining = getDaysRemaining();
    const progress = getMembershipProgress();
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
    const isExpired = daysRemaining < 0;
    const attendanceScore = getAttendanceScore();
    const lastActive = getLastActive();
    const groupedLogs = getGroupedLogs();

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm">
                <button onClick={() => navigate('/dashboard')} className="text-text-muted hover:text-primary transition-colors">
                    Dashboard
                </button>
                <span className="text-text-muted">/</span>
                <button onClick={() => navigate('/members')} className="text-text-muted hover:text-primary transition-colors">
                    Members
                </button>
                <span className="text-text-muted">/</span>
                <span className="text-white font-medium">{member.firstName} {member.lastName}</span>
            </div>

            {/* Hero Header with Gradient Background */}
            <div className="bg-gradient-to-br from-primary/20 via-orange-500/10 to-transparent rounded-3xl border border-white/5 overflow-hidden shadow-lg">
                <div className="p-8">
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        {/* Profile Section */}
                        <div className="flex items-center gap-6">
                            <div className="relative group">
                                <div className="w-32 h-32 bg-gradient-to-br from-primary to-orange-600 rounded-3xl flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-primary/20 overflow-hidden border-4 border-white/10">
                                    {member.imageUrl ? (
                                        <img src={member.imageUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        initials
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowPhotoModal(true)}
                                    className="absolute -bottom-2 -right-2 bg-primary hover:bg-orange-600 text-white p-3 rounded-2xl shadow-lg transition-all active:scale-95"
                                >
                                    <span className="material-icons-round text-sm">photo_camera</span>
                                </button>
                            </div>

                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-4xl font-extrabold text-white tracking-tight mb-1">
                                        {member.firstName} {member.lastName}
                                    </h1>
                                    <button
                                        onClick={handleEditClick}
                                        className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                                        title="Edit Profile"
                                    >
                                        <span className="material-icons-round text-sm">edit</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap mb-3">
                                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${member.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        member.status === 'FREEZED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                        {member.status}
                                    </span>
                                    <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-text-secondary border border-white/10">
                                        ID: {member.id}
                                    </span>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                                        <span className="material-icons-round text-xs text-text-muted">schedule</span>
                                        <span className="text-xs font-medium text-text-muted">Last active: {lastActive}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-${attendanceScore.color}-500/10 border border-${attendanceScore.color}-500/20`}>
                                        <span className={`material-icons-round text-sm text-${attendanceScore.color}-400`}>{attendanceScore.icon}</span>
                                        <span className={`text-xs font-bold text-${attendanceScore.color}-400`}>
                                            {attendanceScore.label} Engagement
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="flex-1 grid grid-cols-3 gap-4 ml-auto">
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-amber-500 text-xl">stars</span>
                                    <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Points</p>
                                </div>
                                <p className="text-3xl font-extrabold text-white">{member.points}</p>
                            </div>
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-emerald-400 text-xl">how_to_reg</span>
                                    <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Visits</p>
                                </div>
                                <p className="text-3xl font-extrabold text-white">{member.accessLogs?.length || 0}</p>
                            </div>
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-blue-400 text-xl">payments</span>
                                    <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Spent</p>
                                </div>
                                <p className="text-2xl font-extrabold text-white">
                                    {formatPrice(member.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Freeze Info Banner */}
            {member.status === 'FREEZED' && member.freezeStartDate && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                        <span className="material-icons-round">ac_unit</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-blue-400 font-bold text-sm mb-1">Account Frozen</p>
                        <p className="text-white text-sm">
                            {new Date(member.freezeStartDate).toLocaleDateString()} — {new Date(member.freezeEndDate).toLocaleDateString()}
                        </p>
                    </div>
                    <button
                        onClick={() => handleStatusChange('ACTIVE')}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    >
                        Unfreeze Now
                    </button>
                </div>
            )}

            {/* Expiring/Expired Warning */}
            {(isExpiringSoon || isExpired) && (
                <div className={`flex items-center gap-4 p-5 rounded-2xl border ${isExpired ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isExpired ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        <span className="material-icons-round">warning</span>
                    </div>
                    <div className="flex-1">
                        <p className={`font-bold text-sm mb-1 ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
                            {isExpired ? 'Membership Expired!' : `Membership Expiring Soon`}
                        </p>
                        <p className="text-white text-sm">
                            {isExpired ? `Expired ${Math.abs(daysRemaining)} days ago` : `Only ${daysRemaining} days remaining`}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowRenewModal(true)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${isExpired ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                            } text-white`}
                    >
                        Renew Now
                    </button>
                </div>
            )}

            {/* Action Bar */}
            <div className="bg-surface rounded-2xl border border-white/5 p-4 flex items-center gap-3 flex-wrap">
                <button
                    onClick={() => setShowRenewModal(true)}
                    className="bg-primary hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                >
                    <span className="material-icons-round text-[20px]">autorenew</span>
                    Renew Plan
                </button>

                {member.status !== 'FREEZED' ? (
                    <button
                        onClick={() => setShowFreezeModal(true)}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all"
                    >
                        <span className="material-icons-round text-[18px]">ac_unit</span>
                        Freeze
                    </button>
                ) : (
                    <button
                        onClick={() => handleStatusChange('ACTIVE')}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all"
                    >
                        <span className="material-icons-round text-[18px]">play_arrow</span>
                        Unfreeze
                    </button>
                )}

                <button
                    onClick={() => setShowPasswordModal(true)}
                    className="bg-surfaceHighlight hover:bg-white/10 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 border border-white/5 transition-all"
                >
                    <span className="material-icons-round text-[18px]">lock_reset</span>
                    Reset Password
                </button>

                <button
                    onClick={() => setShowNotesModal(true)}
                    className="bg-surfaceHighlight hover:bg-white/10 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 border border-white/5 transition-all"
                >
                    <span className="material-icons-round text-[18px]">note_add</span>
                    Add Note
                </button>

                <div className="ml-auto flex gap-2">
                    <button className="bg-surfaceHighlight hover:bg-white/10 text-white px-4 py-3 rounded-xl border border-white/5 transition-all">
                        <span className="material-icons-round text-[20px]">email</span>
                    </button>
                    <button className="bg-surfaceHighlight hover:bg-white/10 text-white px-4 py-3 rounded-xl border border-white/5 transition-all">
                        <span className="material-icons-round text-[20px]">print</span>
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-surface rounded-2xl border border-white/5 p-2 flex gap-2">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'overview'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-text-muted hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <span className="material-icons-round text-[18px]">dashboard</span>
                        Overview
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('activity')}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'activity'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-text-muted hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <span className="material-icons-round text-[18px]">history</span>
                        Activity
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('payments')}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'payments'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-text-muted hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <span className="material-icons-round text-[18px]">receipt_long</span>
                        Payments
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'notes'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-text-muted hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <span className="material-icons-round text-[18px]">description</span>
                        Notes
                    </span>
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Membership Status Card */}
                        <div className="bg-gradient-to-br from-primary/10 to-orange-500/10 border border-primary/20 rounded-3xl p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-text-muted text-xs uppercase font-bold tracking-wider mb-2">Current Membership</p>
                                    <p className="text-3xl font-bold text-white mb-2">{combinedPlanLabel}</p>
                                    <p className="text-primary font-semibold text-lg">
                                        {formatPrice(member.plan?.price || 0)} / {member.plan?.duration || 0} Days
                                    </p>
                                </div>

                                {/* Circular Progress */}
                                <div className="relative w-28 h-28">
                                    <svg className="transform -rotate-90 w-28 h-28">
                                        <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
                                        <circle
                                            cx="56"
                                            cy="56"
                                            r="48"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="none"
                                            strokeDasharray={`${2 * Math.PI * 48}`}
                                            strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
                                            className={`transition-all duration-1000 ${progress > 90 ? 'text-red-500' : 'text-primary'}`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold text-white">{Math.max(0, daysRemaining)}</span>
                                        <span className="text-[10px] text-text-muted font-semibold">days left</span>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar Alternative */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-muted font-semibold">Membership Progress</span>
                                    <span className="text-white font-bold">{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${progress > 90 ? 'bg-red-500' : 'bg-primary'}`}
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div className="bg-white/5 rounded-xl p-3">
                                    <p className="text-text-muted font-semibold text-xs mb-1">Start Date</p>
                                    <p className="text-white font-bold">
                                        {member.startDate ? new Date(member.startDate).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3">
                                    <p className="text-text-muted font-semibold text-xs mb-1">Expiry Date</p>
                                    <p className={`font-bold ${isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <span className="material-icons-round text-primary">person</span>
                                    Personal Information
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Email Address</p>
                                        <p className="text-white font-bold text-sm truncate">{member.email}</p>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Phone Number</p>
                                        <p className="text-white font-bold text-sm">{member.phone || 'Not provided'}</p>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Date of Birth</p>
                                        <p className="text-white font-bold text-sm">
                                            {member.birthDate ? new Date(member.birthDate).toLocaleDateString() : 'Not provided'}
                                        </p>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-text-muted text-xs uppercase font-bold tracking-widest mb-2">Gender</p>
                                        <p className="text-white font-bold text-sm">{member.sex || 'Not specified'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Member Insights */}
                        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-white/5 bg-white/5">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <span className="material-icons-round text-primary">insights</span>
                                    Member Insights
                                </h3>
                            </div>
                            <div className="p-5 space-y-4">
                                {/* Engagement Score */}
                                <div className={`bg-gradient-to-br from-${attendanceScore.color}-500/10 to-${attendanceScore.color}-600/5 rounded-2xl p-4 border border-${attendanceScore.color}-500/20`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-text-muted text-xs uppercase font-semibold tracking-wider">Engagement</p>
                                        <span className={`material-icons-round text-${attendanceScore.color}-400`}>{attendanceScore.icon}</span>
                                    </div>
                                    <p className={`text-2xl font-bold text-${attendanceScore.color}-400 mb-1`}>{attendanceScore.label}</p>
                                    <p className="text-text-muted text-xs">Based on 30-day activity</p>
                                </div>

                                {/* Retention Risk */}
                                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-2xl p-4 border border-purple-500/20">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-text-muted text-xs uppercase font-semibold tracking-wider">Retention Risk</p>
                                        <span className="material-icons-round text-purple-400">shield</span>
                                    </div>
                                    <p className="text-2xl font-bold text-purple-400 mb-1">
                                        {isExpired ? 'High' : isExpiringSoon ? 'Medium' : 'Low'}
                                    </p>
                                    <p className="text-text-muted text-xs">
                                        {isExpired ? 'Membership expired' : isExpiringSoon ? 'Expiring soon' : 'Active membership'}
                                    </p>
                                </div>

                                {/* Average Visit Time */}
                                <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-2xl p-4 border border-cyan-500/20">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-text-muted text-xs uppercase font-semibold tracking-wider">Avg Visit Time</p>
                                        <span className="material-icons-round text-cyan-400">schedule</span>
                                    </div>
                                    <p className="text-2xl font-bold text-cyan-400 mb-1">1.5 hrs</p>
                                    <p className="text-text-muted text-xs">Per session</p>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Preview */}
                        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <span className="material-icons-round text-primary">history</span>
                                    Recent Activity
                                </h3>
                                <button
                                    onClick={() => setActiveTab('activity')}
                                    className="text-primary text-sm font-bold hover:underline"
                                >
                                    View All
                                </button>
                            </div>
                            <div className="p-6 space-y-3">
                                {getFilteredLogs().slice(0, 5).map((log) => (
                                    <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/20 transition-all group">
                                        <div className="flex-shrink-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'ALLOWED'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                <span className="material-icons-round text-lg">
                                                    {log.status === 'ALLOWED' ? 'check_circle' : 'cancel'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-sm">
                                                {log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}
                                            </p>
                                            <p className="text-text-muted text-xs mt-0.5">
                                                {new Date(log.checkIn).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${log.status === 'ALLOWED'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </div>
                                ))}
                                {getFilteredLogs().length === 0 && (
                                    <div className="py-8 text-center">
                                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-3">
                                            <span className="material-icons-round text-2xl text-text-muted">event_busy</span>
                                        </div>
                                        <p className="text-text-muted font-medium text-sm">No recent activity</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm flex-1">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary">history</span>
                            Activity Timeline
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActivityFilter('7days')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activityFilter === '7days'
                                    ? 'bg-primary text-white'
                                    : 'bg-white/5 text-text-muted hover:text-white'
                                    }`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setActivityFilter('30days')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activityFilter === '30days'
                                    ? 'bg-primary text-white'
                                    : 'bg-white/5 text-text-muted hover:text-white'
                                    }`}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setActivityFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activityFilter === 'all'
                                    ? 'bg-primary text-white'
                                    : 'bg-white/5 text-text-muted hover:text-white'
                                    }`}
                            >
                                All Time
                            </button>
                        </div>
                    </div>
                    <div className="p-6 max-h-[700px] overflow-y-auto">
                        {Object.entries(groupedLogs).map(([date, logs]) => (
                            <div key={date} className="mb-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                                        <p className="text-primary font-bold text-sm">{date}</p>
                                    </div>
                                    <div className="h-px flex-1 bg-white/5"></div>
                                    <span className="text-text-muted text-xs font-bold">{logs.length} visits</span>
                                </div>
                                <div className="space-y-3">
                                    {logs.map((log) => (
                                        <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/20 transition-all group">
                                            <div className="flex-shrink-0">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'ALLOWED'
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-red-500/10 text-red-400'
                                                    }`}>
                                                    <span className="material-icons-round text-lg">
                                                        {log.status === 'ALLOWED' ? 'check_circle' : 'cancel'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-bold text-sm">
                                                    {log.status === 'ALLOWED' ? 'Successful Check-in' : 'Access Denied'}
                                                </p>
                                                <p className="text-text-muted text-xs mt-0.5">
                                                    {new Date(log.checkIn).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${log.status === 'ALLOWED'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {getFilteredLogs().length === 0 && (
                            <div className="py-16 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <span className="material-icons-round text-3xl text-text-muted">event_busy</span>
                                </div>
                                <p className="text-text-muted font-medium">No activity found for this period</p>
                                <p className="text-text-muted text-sm mt-1">Check-ins will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary">receipt_long</span>
                            Payment History
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-text-muted text-xs font-semibold mb-1">Total Revenue</p>
                                <p className="text-2xl font-bold text-primary">
                                    {formatPrice(member.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}
                                </p>
                            </div>
                            <button className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-sm font-bold border border-primary/20 transition-all flex items-center gap-2">
                                <span className="material-icons-round text-sm">download</span>
                                Export
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {member.payments?.map((pay) => (
                            <div key={pay.id} className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/20 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-2xl font-bold text-white mb-1">{formatPrice(pay.amount)}</p>
                                        <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                                            {pay.type.replace('_', ' ')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-block text-[10px] font-bold bg-background/50 text-text-muted px-3 py-1.5 rounded-lg border border-white/5 mb-2">
                                            {pay.method}
                                        </span>
                                        <p className="text-xs text-text-muted flex items-center justify-end gap-1.5">
                                            <span className="material-icons-round text-xs">event</span>
                                            {new Date(pay.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-4 border-t border-white/5">
                                    <button className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2">
                                        <span className="material-icons-round text-sm">receipt</span>
                                        View Receipt
                                    </button>
                                    <button className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2">
                                        <span className="material-icons-round text-sm">print</span>
                                        Print
                                    </button>
                                </div>
                            </div>
                        ))}
                        {(!member.payments || member.payments.length === 0) && (
                            <div className="py-16 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <span className="material-icons-round text-3xl text-text-muted">receipt</span>
                                </div>
                                <p className="text-text-muted font-medium">No payments yet</p>
                                <p className="text-text-muted text-sm mt-1">Payment history will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
                <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary">description</span>
                            Staff Notes
                        </h3>
                        <button
                            onClick={() => setShowNotesModal(true)}
                            className="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                            <span className="material-icons-round text-sm">add</span>
                            Add Note
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        {notes.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <span className="material-icons-round text-3xl text-text-muted">note</span>
                                </div>
                                <p className="text-text-muted font-medium">No notes yet</p>
                                <p className="text-text-muted text-sm mt-1">Add notes about this member</p>
                                <button
                                    onClick={() => setShowNotesModal(true)}
                                    className="mt-4 bg-primary/10 hover:bg-primary/20 text-primary px-6 py-2 rounded-xl text-sm font-bold border border-primary/20 transition-all"
                                >
                                    Create First Note
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notes.map(note => (
                                    <div key={note.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                        <div className="text-xs text-text-muted mb-2">
                                            {note.author?.name || note.author?.email || 'Staff'} • {new Date(note.createdAt).toLocaleString()}
                                        </div>
                                        <p className="text-sm text-white whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODALS */}

            {/* Set Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                <span className="material-icons-round">security</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Reset Password</h3>
                        </div>
                        <p className="text-text-muted text-sm mb-6 leading-relaxed">Set a new password for the member to access the private portal.</p>
                        <form onSubmit={handleSetPassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">New Password</label>
                                <input required type="password"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder-white/20"
                                    placeholder="••••••••"
                                    value={passwordData} onChange={e => setPasswordData(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className="text-text-muted hover:text-white px-5 py-2.5 font-medium transition-all">Cancel</button>
                                <button type="submit" className="bg-primary hover:bg-orange-600 text-white font-bold px-8 py-2.5 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Freeze Modal */}
            {showFreezeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                                <span className="material-icons-round">ac_unit</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Freeze Account</h3>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleStatusChange('FREEZED', { freezeStartDate: freezeData.startDate, freezeEndDate: freezeData.endDate }); }} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Start Date</label>
                                <input required type="date"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    value={freezeData.startDate}
                                    onChange={e => setFreezeData({ ...freezeData, startDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">End Date</label>
                                <input required type="date"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    value={freezeData.endDate}
                                    onChange={e => setFreezeData({ ...freezeData, endDate: e.target.value })} />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowFreezeModal(false)} className="text-text-muted hover:text-white px-5 py-2.5 font-medium transition-all">Cancel</button>
                                <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-2.5 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">Confirm Freeze</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Renew Modal */}
            {showRenewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                <span className="material-icons-round">autorenew</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Renew Membership</h3>
                        </div>
                        <form onSubmit={handleRenew} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Select Plan</label>
                                <select
                                    required
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                    value={renewData.planId}
                                    onChange={e => handlePlanChange(e.target.value)}
                                >
                                    <option value="" className="bg-surface">-- Choose a Plan --</option>
                                    {plans.map(plan => (
                                        <option key={plan.id} value={plan.id} className="bg-surface">
                                            {plan.name} - {formatPrice(plan.price)} / {plan.duration} days
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Duration (Days)</label>
                                <input
                                    required
                                    type="number"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    value={renewData.duration}
                                    onChange={e => setRenewData({ ...renewData, duration: e.target.value })}
                                    readOnly
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Payment Method</label>
                                <select
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                    value={renewData.method}
                                    onChange={e => setRenewData({ ...renewData, method: e.target.value })}
                                >
                                    <option value="CASH" className="bg-surface">Cash</option>
                                    <option value="CARD" className="bg-surface">Card</option>
                                    <option value="GCASH" className="bg-surface">GCash</option>
                                </select>
                            </div>
                            {renewData.method === 'CASH' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Amount Tendered</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-3 text-text-muted">₱</span>
                                            <input
                                                required
                                                type="number"
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                                value={renewAmountTendered}
                                                onChange={e => setRenewAmountTendered(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                        <span className="text-text-secondary text-xs font-bold uppercase tracking-widest">Change Due</span>
                                        <span className={`text-lg font-bold ${(parseFloat(renewAmountTendered) || 0) >= (renewData.amount * rate) ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatPrice(Math.max(0, ((parseFloat(renewAmountTendered) || 0) / rate) - renewData.amount))}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {renewData.method === 'GCASH' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">GCash Reference ID</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                            value={renewGcashReference}
                                            onChange={e => setRenewGcashReference(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Date</label>
                                            <input
                                                required
                                                type="date"
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                                value={renewGcashDate}
                                                onChange={e => setRenewGcashDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Time</label>
                                            <input
                                                required
                                                type="time"
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                                value={renewGcashTime}
                                                onChange={e => setRenewGcashTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowRenewModal(false)} className="text-text-muted hover:text-white px-5 py-2.5 font-medium transition-all">Cancel</button>
                                <button type="submit" className="bg-primary hover:bg-orange-600 text-white font-bold px-8 py-2.5 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95">Confirm Renew</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* Edit Member Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-up">
                        <h2 className="text-2xl font-bold text-white mb-6">Edit Member Details</h2>
                        <form onSubmit={handleEditSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-text-muted text-sm font-medium mb-1">First Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                        value={editFormData.firstName || ''}
                                        onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-text-muted text-sm font-medium mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                        value={editFormData.lastName || ''}
                                        onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-text-muted text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    value={editFormData.email || ''}
                                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-text-muted text-sm font-medium mb-1">Phone</label>
                                <input
                                    type="tel"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    value={editFormData.phone || ''}
                                    onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-text-muted text-sm font-medium mb-1 text-orange-400">Expiry Date (Override)</label>
                                <input
                                    type="date"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                    value={editFormData.expiryDate || ''}
                                    onChange={e => setEditFormData({ ...editFormData, expiryDate: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-primary hover:bg-orange-600 text-white font-bold rounded-xl"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Photo Update Modal */}
            {showPhotoModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface rounded-3xl border border-white/10 w-full max-w-sm shadow-2xl overflow-hidden p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Update Member Photo</h3>
                            <button onClick={() => { stopCamera(); setShowPhotoModal(false); }} className="text-text-muted hover:text-white">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 relative mb-6">
                            {isCameraOpen ? (
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-3">
                                    <span className="material-icons-round text-5xl">photo_camera</span>
                                    <button onClick={startCamera} className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold border border-primary/20">
                                        Open Camera
                                    </button>
                                </div>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { stopCamera(); setShowPhotoModal(false); }}
                                className="flex-1 py-3 text-text-muted hover:text-white font-bold"
                            >
                                Cancel
                            </button>
                            {isCameraOpen && (
                                <button
                                    onClick={captureAndUpdate}
                                    disabled={submittingPhoto}
                                    className="flex-1 bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    {submittingPhoto ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span className="material-icons-round text-lg">camera</span>
                                            Capture
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Notes Modal */}
            {showNotesModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-md border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                <span className="material-icons-round">note_add</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Add Staff Note</h3>
                        </div>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!noteData.trim()) return;
                                try {
                                    await axios.post(`http://localhost:5000/api/members/${id}/notes`, { content: noteData.trim() });
                                    setNoteData('');
                                    setShowNotesModal(false);
                                    fetchNotes();
                                } catch (e) {
                                    alert("Failed to save note");
                                }
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Note</label>
                                <textarea
                                    required
                                    rows="5"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder-white/20 resize-none"
                                    placeholder="Enter your note here..."
                                    value={noteData}
                                    onChange={e => setNoteData(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setShowNotesModal(false)} className="text-text-muted hover:text-white px-5 py-2.5 font-medium transition-all">Cancel</button>
                                <button type="submit" className="bg-primary hover:bg-orange-600 text-white font-bold px-8 py-2.5 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95">Save Note</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
