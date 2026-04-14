import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import QRCode from 'react-qr-code';
import { useCurrency } from '../../context/CurrencyContext';
import { withApiBase } from '../../config/api';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { queryClient } from '../../config/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 bg-red-900/20 border border-red-500 rounded-xl text-white">
                    <h2 className="text-xl font-bold mb-2">Something went wrong.</h2>
                    <details className="whitespace-pre-wrap text-sm font-mono text-red-200">
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}


export default function Members() {
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();
    const { alert: showAlert } = useConfirm();
    const { user } = useAuth();
    
    // Page state
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [branchSearch, setBranchSearch] = useState('');
    const [selectedGymId, setSelectedGymId] = useState(user?.gymId ? String(user.gymId) : '');
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const branchDropdownRef = useRef(null);

    // Click outside handler for branch dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
                setIsBranchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Queries
    const { data: plans = [] } = useQuery({
        queryKey: ['plans'],
        queryFn: async () => {
            const res = await axios.get(withApiBase('/api/plans'));
            return res.data;
        }
    });

    const { data: gyms = [] } = useQuery({
        queryKey: ['admin-branches'],
        queryFn: async () => {
            const res = await axios.get(withApiBase('/api/admin/branches'));
            return res.data;
        }
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const LIMIT = 12; // Items per page

    const { data: queryData, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['members-page', currentPage, searchTerm, selectedGymId],
        queryFn: async () => {
            const url = withApiBase(`/api/members?page=${currentPage}&limit=${LIMIT}&search=${searchTerm}${selectedGymId ? `&branchId=${selectedGymId}` : ''}`);
            const res = await axios.get(url);
            return res.data;
        },
        placeholderData: (previousData) => previousData
    });

    const members = queryData?.members || [];
    const totalPages = queryData?.totalPages || 1;
    const totalMembers = queryData?.totalMembers || 0;
    const statusTotals = queryData?.statusTotals || null;

    const [error, setError] = useState(null);

    useEffect(() => {
        if (queryError) {
            setError(queryError.response?.data?.error || queryError.message || "Failed to fetch data");
        } else {
            setError(null);
        }
    }, [queryError]);

    // Reset to page 1 on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedGymId]);



    const registerMemberMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post(withApiBase('/api/members'), payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members-page'] });
            queryClient.invalidateQueries({ queryKey: ['pos', 'members'] });
        }
    });

    const deleteMemberMutation = useMutation({
        mutationFn: async (id) => {
            await axios.delete(withApiBase(`/api/members/${id}`));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members-page'] });
            queryClient.invalidateQueries({ queryKey: ['pos', 'members'] });
        }
    });


    // Standard State
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '', planId: '', birthDate: '', sex: '', imageUrl: '', agreedToTC: false, paymentMethod: 'CASH' });
    const [submitting, setSubmitting] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const tcPrintRef = useRef(null);

    const handlePrintTC = useReactToPrint({
        contentRef: tcPrintRef,
        documentTitle: 'Membership_Agreement' });

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [amountTendered, setAmountTendered] = useState('');
    const [gcashReference, setGcashReference] = useState('');
    const [gcashDate, setGcashDate] = useState('');
    const [gcashTime, setGcashTime] = useState('');

    // Modal State
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactionInfo, setTransactionInfo] = useState(null);
    const [showTCModal, setShowTCModal] = useState(false);
    const [newMember, setNewMember] = useState(null);
    const [qrMember, setQrMember] = useState(null);

    // Delete State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
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
            console.error("Error accessing camera:", err);
            await showAlert({ title: 'Camera Error', message: 'Could not access camera. Please ensure permissions are granted.', type: 'danger' });
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg');
            setFormData({ ...formData, imageUrl: imageData });
            stopCamera();
        }
    };

    const submitRegistration = async (paymentInfo = {}) => {
        if (!formData.agreedToTC) {
            await showAlert({ title: 'Agreement Required', message: 'Member must agree to the Terms and Conditions to proceed.', type: 'warning' });
            return;
        }
        setSubmitting(true);
        try {
            const payload = {

                ...formData,
                planId: formData.planId ? Number(formData.planId) : null,
                paymentMethod: formData.paymentMethod,
                birthDate: formData.birthDate || null,
                sex: formData.sex || null,
                ...paymentInfo
            };
            const resData = await registerMemberMutation.mutateAsync(payload);
            const member = resData?.member || resData;
            const payment = resData?.payment || null;
            setNewMember(member);
            setIsModalOpen(false);
            setFormData({ firstName: '', lastName: '', email: '', phone: '', planId: '', birthDate: '', sex: '', imageUrl: '', agreedToTC: false, paymentMethod: 'CASH' });

            if (payment) {
                setTransactionInfo(payment);
                setShowTransactionModal(true);
            } else {
                setShowTCModal(true);
            }
        } catch (e) {
            console.error(e);
            await showAlert({ title: 'Registration Failed', message: e.response?.data?.error || 'Failed to register member. Check connection and required fields.', type: 'danger' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = (e) => {
        e.preventDefault();
        if (!formData.agreedToTC) {
            showAlert({ title: 'Agreement Required', message: 'Member must agree to the Terms and Conditions to proceed.', type: 'warning' });
            return;
        }
        if (formData.paymentMethod === 'CASH' || formData.paymentMethod === 'GCASH') {
            setShowPaymentModal(true);
            setAmountTendered('');
            setGcashReference('');
            setGcashDate('');
            setGcashTime('');
            return;
        }
        submitRegistration();
    };

    const handleDeleteMember = async () => {
        if (!memberToDelete) return;
        setIsDeleting(true);
        try {
            await deleteMemberMutation.mutateAsync(memberToDelete.id);
            // Update local state
            setMembers(members.filter(m => m.id !== memberToDelete.id));
            setIsDeleteModalOpen(false);
            setMemberToDelete(null);
        } catch (e) {
            console.error("Failed to delete member", e);
            await showAlert({ title: 'Delete Failed', message: 'Failed to delete member. Please try again.', type: 'danger' });
        } finally {
            setIsDeleting(false);
        }
    };

    const openDeleteModal = (member, e) => {
        e.stopPropagation();
        setMemberToDelete(member);
        setIsDeleteModalOpen(true);
    };

    // Server-side filtered members are directly in 'members' state
    const filteredMembers = useMemo(() => (Array.isArray(members) ? members : []), [members]);
    const isMembershipExpired = useCallback((member) => {
        const normalizedStatus = String(member?.status || '').toUpperCase();
        if (normalizedStatus === 'EXPIRED') return true;
        if (!member?.expiryDate) return false;

        const expiryDate = new Date(member.expiryDate);
        if (Number.isNaN(expiryDate.getTime())) return false;
        expiryDate.setHours(23, 59, 59, 999);
        return expiryDate < new Date();
    }, []);
    const getResolvedStatus = useCallback((member) => {
        if (isMembershipExpired(member)) return 'EXPIRED';
        return String(member?.status || 'UNKNOWN').toUpperCase();
    }, [isMembershipExpired]);
    const getStatusLabel = (status) => String(status || 'UNKNOWN').replace(/_/g, ' ');
    const memberStats = useMemo(() => {
        const hasGlobalTotals = statusTotals && Number.isFinite(statusTotals.total);
        const active = hasGlobalTotals
            ? Number(statusTotals.active || 0)
            : filteredMembers.filter((member) => getResolvedStatus(member) === 'ACTIVE').length;
        const freezed = hasGlobalTotals
            ? Number(statusTotals.freezed || 0)
            : filteredMembers.filter((member) => getResolvedStatus(member) === 'FREEZED').length;
        const expired = hasGlobalTotals
            ? Number(statusTotals.expired || 0)
            : filteredMembers.filter((member) => getResolvedStatus(member) === 'EXPIRED').length;
        const total = hasGlobalTotals
            ? Number(statusTotals.total || 0)
            : Number(totalMembers || filteredMembers.length || 0);
        return [
            { label: 'Total Members', value: total, icon: 'groups', tone: 'text-primary' },
            { label: 'Active', value: active, icon: 'verified', tone: 'text-emerald-400' },
            { label: 'On Freeze', value: freezed, icon: 'pause_circle', tone: 'text-blue-400' },
            { label: 'Expired', value: expired, icon: 'event_busy', tone: 'text-red-400' }
        ];
    }, [filteredMembers, getResolvedStatus, statusTotals, totalMembers]);

    const selectedPlan = plans.find(plan => plan.id === Number(formData.planId));
    const getMemberPlan = (member) => member?.plan || plans.find(plan => plan.id === Number(member?.planId));
    const selectedPlanFreezeLimit = Math.max(0, Number(selectedPlan?.freezeLimitCount || 0));
    const selectedPlanGuestPassEnabled = Boolean(selectedPlan?.guestPassEnabled) || Number(selectedPlan?.guestPassLimitCount || 0) > 0;
    const selectedPlanGuestPassLimit = selectedPlanGuestPassEnabled
        ? Math.max(0, Number(selectedPlan?.guestPassLimitCount || 0))
        : 0;
    const planPrice = selectedPlan ? selectedPlan.price : 0;
    const cashTenderedValue = parseFloat(amountTendered) || 0;
    const amountDueLocal = planPrice;
    const changeDue = Math.max(0, cashTenderedValue - planPrice);

    const getStatusColor = (status) => {
        switch (status) {
            case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'FREEZED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'EXPIRED': return 'bg-red-500/10 text-red-400 border-red-500/20';
            default: return 'bg-white/5 text-text-muted border-white/10';
        }
    };
    const getQrValue = (memberId) => (memberId ? `MEMBER:${memberId}` : '');


    return (
        <ErrorBoundary>
            <div className="space-y-4">
                <header className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white">Members</h1>
                            <p className="mt-1 text-sm text-text-muted">Manage profiles, membership status, and gym access records.</p>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-orange-600"
                        >
                            <span className="material-icons-round text-base">person_add</span>
                            New Member
                        </button>
                    </div>

                    <div className="grid gap-3 rounded-2xl border border-white/10 bg-surface px-4 py-3 lg:grid-cols-[minmax(0,1fr),auto,auto,auto] lg:items-center">
                        <label className="relative block">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-[18px] text-text-muted">search</span>
                            <input
                                type="text"
                                placeholder="Search by name, email, phone"
                                className="w-full rounded-xl border border-white/10 bg-surfaceHighlight py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-primary"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </label>

                        <div className="relative" id="branch-filter-container" ref={branchDropdownRef}>
                            <div 
                                className="flex items-center gap-2 rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 cursor-pointer hover:border-primary/50 transition-colors w-full lg:w-56"
                                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                            >
                                <span className="material-icons-round text-text-muted text-[18px]">storefront</span>
                                <span className="text-sm text-white truncate flex-1">
                                    {selectedGymId 
                                        ? gyms.find(g => g.id === Number(selectedGymId))?.name || 'Selected Branch'
                                        : 'All Branches'
                                    }
                                </span>
                                <span className="material-icons-round text-text-muted text-[18px]">
                                    {isBranchDropdownOpen ? 'expand_less' : 'expand_more'}
                                </span>
                            </div>

                            {isBranchDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-full lg:w-64 bg-surfaceHighlight border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden animate-fade-in">
                                    <div className="p-2 border-b border-white/5">
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-icons-round text-text-muted text-sm">search</span>
                                            <input
                                                type="text"
                                                placeholder="Search branches..."
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white outline-none focus:border-primary"
                                                value={branchSearch}
                                                onChange={(e) => setBranchSearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        <button
                                            className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-primary/20 ${!selectedGymId ? 'text-primary font-bold bg-primary/10' : 'text-text-muted'}`}
                                            onClick={() => {
                                                setSelectedGymId('');
                                                setIsBranchDropdownOpen(false);
                                                setBranchSearch('');
                                            }}
                                        >
                                            All Branches
                                        </button>
                                        {gyms
                                            .filter(gym => gym.name.toLowerCase().includes(branchSearch.toLowerCase()))
                                            .map(gym => (
                                                <button
                                                    key={gym.id}
                                                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-primary/20 ${selectedGymId === String(gym.id) ? 'text-primary font-bold bg-primary/10' : 'text-text-muted'}`}
                                                    onClick={() => {
                                                        setSelectedGymId(String(gym.id));
                                                        setIsBranchDropdownOpen(false);
                                                        setBranchSearch('');
                                                    }}
                                                >
                                                    {gym.name}
                                                </button>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="inline-flex rounded-xl border border-white/10 bg-surfaceHighlight p-1">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-primary text-background' : 'text-text-muted hover:text-white'}`}
                                title="List View"
                            >
                                <span className="material-icons-round text-sm">format_list_bulleted</span>
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-primary text-background' : 'text-text-muted hover:text-white'}`}
                                title="Grid View"
                            >
                                <span className="material-icons-round text-sm">grid_view</span>
                                Grid
                            </button>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2 text-xs text-text-secondary">
                            Showing <span className="font-bold text-white">{filteredMembers.length}</span> of <span className="font-bold text-white">{totalMembers || filteredMembers.length}</span>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-2 animate-fade-in">
                        <span className="material-icons-round">error_outline</span>
                        {error}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        {memberStats.map((stat) => (
                            <span key={stat.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-surfaceHighlight px-2.5 py-1 text-[11px] text-text-secondary">
                                <span className={`material-icons-round text-sm ${stat.tone}`}>{stat.icon}</span>
                                <span className="text-text-muted">{stat.label}:</span>
                                <span className="font-bold text-white">{stat.value}</span>
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-text-muted">
                            Page <span className="font-bold text-white">{currentPage}</span> / <span className="font-bold text-white">{Math.max(totalPages, 1)}</span>
                        </span>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'list' ? (
                    <DataTable
                        className="rounded-2xl border border-white/10"
                        columns={[
                            {
                                header: 'Member',
                                accessor: (member) => (
                                    <div className="flex items-center gap-4">
                                        {member.imageUrl ? (
                                            <img src={member.imageUrl} className="w-10 h-10 rounded-full object-cover border border-primary/20" alt="" />
                                        ) : (
                                            <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/5 text-primary rounded-full flex items-center justify-center font-bold text-sm border border-primary/20 backdrop-blur-sm shadow-inner">
                                                {member.firstName[0]}{member.lastName[0]}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-white group-hover:text-primary transition-colors">{member.firstName} {member.lastName}</p>
                                            <p className="text-xs text-text-muted">{member.email}</p>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                header: 'Plan',
                                accessor: (member) => <span className="text-text-secondary font-medium">{getMemberPlan(member)?.name || "None"}</span>
                            },
                            {
                                header: 'Branch',
                                accessor: (member) => (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary bg-white/5 px-2 py-0.5 rounded border border-white/5 font-medium">
                                        <span className="material-icons-round text-xs opacity-50">storefront</span>
                                        {member.gym?.name || "Shared"}
                                    </span>
                                )
                            },
                            {
                                header: 'Status',
                                accessor: (member) => (
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(getResolvedStatus(member))}`}>
                                        {getStatusLabel(getResolvedStatus(member))}
                                    </span>
                                )
                            },
                            {
                                header: 'Join Date',
                                accessor: (member) => <span className="text-text-secondary text-sm">{new Date(member.startDate).toLocaleDateString()}</span>
                            }
                        ]}
                        data={filteredMembers}
                        onRowClick={(member) => navigate(`/members/${member.id}`)}
                        actions={(member) => (
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setQrMember(member);
                                    }}
                                    className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-white hover:border-primary/30 transition-all flex items-center justify-center"
                                    title="View QR Code"
                                >
                                    <span className="material-icons-round text-[18px]">qr_code_2</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => openDeleteModal(member, e)}
                                    className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center"
                                    title="Delete Member"
                                >
                                    <span className="material-icons-round text-[18px]">delete</span>
                                </button>
                                <span className="material-icons-round text-text-muted group-hover:text-primary transition-colors">chevron_right</span>
                            </div>
                        )}
                        isLoading={loading}
                        emptyMessage="No members found."
                    />
                ) : (
                    // GRID VIEW
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 animate-fade-in">
                        {filteredMembers.map(member => {
                            const resolvedStatus = getResolvedStatus(member);
                            const ribbonConfig = resolvedStatus === 'EXPIRED'
                                ? { label: 'Expired', ribbonClass: 'bg-red-600/90', borderClass: 'border-red-500/30' }
                                : resolvedStatus === 'FREEZED'
                                    ? { label: 'Frozen', ribbonClass: 'bg-blue-600/90', borderClass: 'border-blue-500/30' }
                                    : null;
                            const showStatusBadge = !ribbonConfig;
                            return (
                                <div
                                    key={member.id}
                                    onClick={() => navigate(`/members/${member.id}`)}
                                    className={`relative overflow-hidden rounded-xl border bg-surface p-4 transition-all cursor-pointer group flex flex-col gap-3 hover:border-primary/30 hover:bg-surfaceHighlight/40 ${ribbonConfig ? ribbonConfig.borderClass : 'border-white/10'}`}
                                >
                                    {ribbonConfig && (
                                        <div className={`pointer-events-none absolute right-[-50px] top-[14px] z-10 w-44 rotate-45 py-1 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg ${ribbonConfig.ribbonClass}`}>
                                            {ribbonConfig.label}
                                        </div>
                                    )}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {member.imageUrl ? (
                                            <img src={member.imageUrl} className="w-11 h-11 rounded-lg object-cover border border-primary/20" alt="" />
                                        ) : (
                                            <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-primary/5 text-primary rounded-lg flex items-center justify-center font-bold text-base border border-primary/20 shadow-inner">
                                                {member.firstName[0]}{member.lastName[0]}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors truncate">
                                                    {member.firstName} {member.lastName}
                                                </h3>
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] uppercase tracking-tighter text-text-muted font-black" title="Home Branch">
                                                    {member.gym?.name || "SHARED"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-text-muted truncate">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setQrMember(member);
                                            }}
                                            className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-white hover:border-primary/30 transition-all flex items-center justify-center"
                                            title="View QR Code"
                                        >
                                            <span className="material-icons-round text-[16px]">qr_code_2</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => openDeleteModal(member, e)}
                                            className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-text-muted hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center"
                                            title="Delete Member"
                                        >
                                            <span className="material-icons-round text-[16px]">delete</span>
                                        </button>
                                        <div className="min-w-[82px] flex justify-end">
                                            {showStatusBadge ? (
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${getStatusColor(resolvedStatus)}`}>
                                                    {getStatusLabel(resolvedStatus)}
                                                </span>
                                            ) : (
                                                <span className="inline-block h-6 w-[82px]" aria-hidden="true" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <p className="text-text-muted">Phone</p>
                                    <p className="text-white font-medium">{member.phone || 'N/A'}</p>
                                </div>

                                <div className="mt-auto pt-3 border-t border-white/5 grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-text-muted text-xs">Plan</p>
                                        <p className="text-white font-medium truncate">{getMemberPlan(member)?.name || "None"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-text-muted text-xs">Expires</p>
                                        <p className={`font-medium ${resolvedStatus === 'EXPIRED' ? 'text-red-400' : resolvedStatus === 'FREEZED' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                            {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                        {filteredMembers.length === 0 && !loading && (
                            <div className="col-span-full p-12 text-center text-text-muted bg-surface rounded-3xl border border-white/5">
                                No members found.
                            </div>
                        )}
                    </div>
                )}

                {/* Register Member Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                        <div className="bg-surface rounded-3xl border border-white/10 w-full max-w-2xl shadow-2xl overflow-hidden scale-100 transition-transform max-h-[90vh] flex flex-col">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <h2 className="text-xl font-bold text-white">Register New Member</h2>
                                <button onClick={() => { stopCamera(); setIsModalOpen(false); }} className="text-text-muted hover:text-white transition-colors">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleRegister} className="p-6 space-y-6 overflow-y-auto">
                                {/* Profile Photo Capture */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative w-32 h-32 rounded-3xl overflow-hidden border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                                        {isCameraOpen ? (
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                                        ) : formData.imageUrl ? (
                                            <img src={formData.imageUrl} className="w-full h-full object-cover" alt="Captured" />
                                        ) : (
                                            <span className="material-icons-round text-4xl text-white/20">person</span>
                                        )}
                                        {isCameraOpen && (
                                            <button
                                                type="button"
                                                onClick={capturePhoto}
                                                className="absolute bottom-2 right-2 bg-primary text-white p-2 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all"
                                            >
                                                <span className="material-icons-round text-sm">photo_camera</span>
                                            </button>
                                        )}
                                    </div>
                                    {!isCameraOpen ? (
                                        <button
                                            type="button"
                                            onClick={startCamera}
                                            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                                        >
                                            <span className="material-icons-round text-sm">{formData.imageUrl ? 'retake_photo' : 'add_a_photo'}</span>
                                            {formData.imageUrl ? 'Change Photo' : 'Capture Member Photo'}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={stopCamera}
                                            className="text-xs font-bold text-red-400 flex items-center gap-1 hover:underline"
                                        >
                                            Cancel Camera
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">First Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                            placeholder="John"
                                            value={formData.firstName}
                                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Last Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                            placeholder="Doe"
                                            value={formData.lastName}
                                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Email Address</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                            placeholder="john@example.com"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Phone Number</label>
                                        <input
                                            type="tel"
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                            placeholder="+1 234 567 890"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Birthday</label>
                                        <input
                                            type="date"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                            value={formData.birthDate}
                                            onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Sex</label>
                                        <div className="relative">
                                            <select
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
                                                value={formData.sex}
                                                onChange={e => setFormData({ ...formData, sex: e.target.value })}
                                            >
                                                <option value="" className="bg-surface">Select sex</option>
                                                <option value="Male" className="bg-surface">Male</option>
                                                <option value="Female" className="bg-surface">Female</option>
                                                <option value="Other" className="bg-surface">Other</option>
                                            </select>
                                            <span className="material-icons-round absolute right-4 top-3 text-text-muted pointer-events-none text-sm">expand_more</span>
                                        </div>
                                    </div>
                                </div>



                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Membership Plan</label>
                                    <div className="relative">
                                        <select
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
                                            value={formData.planId}
                                            onChange={e => setFormData({ ...formData, planId: e.target.value })}
                                        >
                                            <option value="" disabled>Select a plan</option>
                                            {plans.map(plan => (
                                                <option key={plan.id} value={plan.id} className="bg-surface text-white">
                                                    {plan.name} - ₱{plan.price} ({plan.duration} days)
                                                </option>
                                            ))}
                                        </select>
                                        <span className="material-icons-round absolute right-4 top-3 text-text-muted pointer-events-none text-sm">expand_more</span>
                                    </div>
                                    {selectedPlan && (
                                        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-text-muted">
                                            <p>
                                                Freeze: {selectedPlanFreezeLimit > 0
                                                    ? `${selectedPlanFreezeLimit} time${selectedPlanFreezeLimit > 1 ? 's' : ''}`
                                                    : 'Not included'}
                                            </p>
                                            <p className="mt-1">
                                                Guest Pass: {selectedPlanGuestPassLimit > 0
                                                    ? `${selectedPlanGuestPassLimit} time${selectedPlanGuestPassLimit > 1 ? 's' : ''}`
                                                    : 'Not included'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Payment Method</label>
                                    <div className="relative">
                                        <select
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
                                            value={formData.paymentMethod}
                                            onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                                        >
                                            <option value="CASH" className="bg-surface">Cash</option>
                                            <option value="CARD" className="bg-surface">Card</option>
                                            <option value="GCASH" className="bg-surface">GCash</option>
                                            <option value="TRANSFER" className="bg-surface">Transfer</option>
                                        </select>
                                        <span className="material-icons-round absolute right-4 top-3 text-text-muted pointer-events-none text-sm">expand_more</span>
                                    </div>
                                </div>

                                {/* Terms and Conditions Checkbox */}
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <label className="flex items-start gap-4 cursor-pointer group">
                                        <div className="relative mt-1">
                                            <input
                                                type="checkbox"
                                                required
                                                className="peer sr-only"
                                                checked={formData.agreedToTC}
                                                onChange={e => setFormData({ ...formData, agreedToTC: e.target.checked })}
                                            />
                                            <div className="w-5 h-5 bg-surfaceHighlight border border-white/20 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                                            <span className="material-icons-round absolute inset-0 text-white text-[16px] hidden peer-checked:block text-center leading-5 font-bold">check</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">Agree to Terms & Conditions</p>
                                            <p className="text-xs text-text-muted leading-relaxed mt-1">
                                                I hereby acknowledge that I have read and agree to the Gym's Safety Regulations, Membership Policies, and Privacy Agreement.
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { stopCamera(); setIsModalOpen(false); }}
                                        className="px-6 py-2.5 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-all font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-6 py-2.5 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Registering...' : 'Register Member'}
                                    </button>
                                </div>
                            </form>
                        </div>
                        {/* Hidden canvas for capture */}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                )}

                {/* Cash Payment Modal */}
                {showPaymentModal && formData.paymentMethod === 'CASH' && (
                    <div className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">Cash Payment</h2>
                                <p className="text-text-muted">Amount Due</p>
                                <p className="text-4xl font-bold text-primary mt-1">{formatPrice(planPrice)}</p>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-text-muted text-sm font-medium mb-2">Amount Tendered</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold">₱</span>
                                        <input
                                            type="number"
                                            autoFocus
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 pl-8 pr-4 text-white text-xl font-bold focus:border-green-500 outline-none"
                                            placeholder="0.00"
                                            value={amountTendered}
                                            onChange={(e) => setAmountTendered(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                    <span className="text-text-secondary">Change Due:</span>
                                    <span className={`text-2xl font-bold ${cashTenderedValue >= amountDueLocal ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatPrice(changeDue)}
                                    </span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            const tenderedAmount = cashTenderedValue;
                                            if (cashTenderedValue < amountDueLocal) return;
                                            setShowPaymentModal(false);
                                            submitRegistration({
                                                cashTendered: tenderedAmount,
                                                changeDue: changeDue
                                            });
                                        }}
                                        disabled={cashTenderedValue < amountDueLocal || submitting}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                        Confirm Payment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* GCash Payment Modal */}
                {showPaymentModal && formData.paymentMethod === 'GCASH' && (
                    <div className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">GCash Payment</h2>
                                <p className="text-text-muted">Amount Due</p>
                                <p className="text-4xl font-bold text-primary mt-1">{formatPrice(planPrice)}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-text-muted text-sm font-medium mb-2">GCash Reference ID</label>
                                    <input
                                        type="text"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white text-sm font-bold focus:border-primary outline-none"
                                        placeholder="Enter GCash transaction ID"
                                        value={gcashReference}
                                        onChange={(e) => setGcashReference(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-text-muted text-sm font-medium mb-2">Date</label>
                                        <input
                                            type="date"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-primary outline-none"
                                            value={gcashDate}
                                            onChange={(e) => setGcashDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-text-muted text-sm font-medium mb-2">Time</label>
                                        <input
                                            type="time"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:border-primary outline-none"
                                            value={gcashTime}
                                            onChange={(e) => setGcashTime(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!gcashReference || !gcashDate || !gcashTime) return;
                                            setShowPaymentModal(false);
                                            submitRegistration({
                                                gcashReference,
                                                gcashDate,
                                                gcashTime
                                            });
                                        }}
                                        disabled={!gcashReference || !gcashDate || !gcashTime || submitting}
                                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                        Confirm Payment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Transaction Info Modal */}
                {showTransactionModal && transactionInfo && (
                    <div className="fixed inset-0 z-[58] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                            <h3 className="text-xl font-bold text-white mb-2">Transaction Created</h3>
                            <p className="text-text-muted text-sm mb-4">Please record the details below.</p>
                            <div className="bg-white/5 rounded-xl p-4 space-y-3 text-sm">
                                <div className="flex justify-between text-text-muted">
                                    <span>Transaction ID</span>
                                    <span className="text-white font-bold">#{transactionInfo.id}</span>
                                </div>
                                <div className="flex justify-between text-text-muted">
                                    <span>Date</span>
                                    <span className="text-white">{new Date(transactionInfo.date).toLocaleDateString('en-US')}</span>
                                </div>
                                <div className="flex justify-between text-text-muted">
                                    <span>Time</span>
                                    <span className="text-white">{new Date(transactionInfo.date).toLocaleTimeString()}</span>
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowTransactionModal(false);
                                        setShowTCModal(true);
                                    }}
                                    className="flex-1 py-3 bg-primary hover:bg-orange-600 text-white font-bold rounded-xl"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Terms and Conditions Print Modal */}
                {showTCModal && newMember && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
                        <div className="bg-surface rounded-3xl border border-white/10 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <h2 className="text-xl font-bold text-white">Membership Agreement</h2>
                                <button onClick={() => setShowTCModal(false)} className="text-text-muted hover:text-white transition-colors">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto max-h-[70vh] bg-white text-black font-serif" ref={tcPrintRef}>
                                <div className="text-center mb-8">
                                    <h1 className="text-3xl font-black uppercase tracking-widest border-b-2 border-black pb-2 mb-1">Gym POS Membership Form</h1>
                                    <p className="text-sm italic">Official Registration & Waiver Agreement</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                                    <div className="border border-black p-3 rounded">
                                        <p className="font-bold border-b border-black mb-1">MEMBER INFORMATION</p>
                                        <p><strong>Name:</strong> {newMember.firstName} {newMember.lastName}</p>
                                        <p><strong>Email:</strong> {newMember.email}</p>
                                        <p><strong>Phone:</strong> {newMember.phone}</p>
                                    </div>
                                    <div className="border border-black p-3 rounded">
                                        <p className="font-bold border-b border-black mb-1">MEMBERSHIP DETAILS</p>
                                        <p><strong>Status:</strong> {newMember.status}</p>
                                        <p><strong>Join Date:</strong> {new Date(newMember.startDate).toLocaleDateString()}</p>
                                        <p><strong>Expiry Date:</strong> {new Date(newMember.expiryDate).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="border border-black p-3 rounded mb-8 text-sm flex items-center justify-between gap-6">
                                    <div>
                                        <p className="font-bold border-b border-black mb-1">MEMBER QR CODE</p>
                                        <p><strong>ID:</strong> {newMember.id}</p>
                                        <p><strong>Code:</strong> MEMBER:{newMember.id}</p>
                                    </div>
                                    <div className="bg-white p-2 border border-black">
                                        <QRCode value={getQrValue(newMember.id)} size={96} />
                                    </div>
                                </div>

                                <div className="space-y-4 text-xs leading-relaxed">
                                    <section>
                                        <p className="font-bold uppercase mb-1">1. Health and Safety</p>
                                        <p>I confirm that I am in good physical health and have no medical conditions that would prevent me from using the gym facilities safely. I assume all risks associated with physical exercise.</p>
                                    </section>
                                    <section>
                                        <p className="font-bold uppercase mb-1">2. Rules and Regulations</p>
                                        <p>Members must follow all gym rules, including appropriate attire and proper equipment usage. Management reserves the right to terminate membership for violation of rules.</p>
                                    </section>
                                    <section>
                                        <p className="font-bold uppercase mb-1">3. Liability Waiver</p>
                                        <p>The gym is not responsible for any lost or stolen items. Members use the facilities at their own risk. The gym and its staff are not liable for any injuries sustained on the premises.</p>
                                    </section>
                                    <section>
                                        <p className="font-bold uppercase mb-1">4. Membership Cancellation</p>
                                        <p>Membership fees are non-refundable. Notice requirement for cancellation depends on the specific plan purchased.</p>
                                    </section>
                                </div>

                                <div className="mt-12 grid grid-cols-2 gap-12 text-sm italic">
                                    <div className="border-t border-black pt-2">
                                        <p>Member Signature</p>
                                    </div>
                                    <div className="border-t border-black pt-2">
                                        <p>Gym Official Signature</p>
                                        <p className="text-[10px] mt-1">Date: {new Date().toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/5 bg-white/5 flex gap-4">
                                <button
                                    onClick={() => setShowTCModal(false)}
                                    className="flex-1 py-3 border border-white/10 rounded-xl text-text-muted hover:text-white transition-all font-bold"
                                >
                                    Not Now
                                </button>
                                <button
                                    onClick={handlePrintTC}
                                    className="flex-1 py-3 bg-primary hover:bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all"
                                >
                                    <span className="material-icons-round">print</span>
                                    Print Agreement
                                </button>
                            </div>
                        </div>
                    </div>
                )
                }

                {/* QR Code Modal */}
                {
                    qrMember && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fade-in">
                            <div className="bg-surface rounded-3xl border border-white/10 w-full max-w-sm shadow-2xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Member QR Code</h2>
                                        <p className="text-xs text-text-muted">{qrMember.firstName} {qrMember.lastName}</p>
                                    </div>
                                    <button onClick={() => setQrMember(null)} className="text-text-muted hover:text-white transition-colors">
                                        <span className="material-icons-round">close</span>
                                    </button>
                                </div>

                                <div className="p-6 flex flex-col items-center gap-4">
                                    <div className="bg-white p-4 rounded-2xl shadow-lg">
                                        <QRCode value={getQrValue(qrMember.id)} size={180} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-text-muted">Member ID</p>
                                        <p className="text-white font-mono text-sm">MEMBER:{qrMember.id}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Delete Confirmation Modal */}
                <Modal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="Delete Member"
                >
                    <div className="space-y-4">
                        <p className="text-text-muted">
                            Are you sure you want to delete <span className="text-white font-bold">{memberToDelete?.firstName} {memberToDelete?.lastName}</span>?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteMember}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </ErrorBoundary>
    );
}
