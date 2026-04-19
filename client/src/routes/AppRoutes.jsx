import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import { withApiBase } from '../config/api';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

// Auth & Public
import Landing from '../features/shared/Landing';
import Signup from '../features/auth/Signup';
import Login from '../features/auth/Login';
import ActivateAccount from '../features/auth/ActivateAccount';
import ForgotPassword from '../features/auth/ForgotPassword';
import ResetPassword from '../features/auth/ResetPassword';

// Shared
import Dashboard from '../features/shared/Dashboard';
import Payments from '../features/shared/Payments';
import Access from '../features/staff/Access';
import Loyalty from '../features/shared/Loyalty';
import Announcements from '../features/shared/Announcements';
import DisplayMonitor from '../features/shared/DisplayMonitor';

// Owner Pages
import Settings from '../features/shared/Settings';
import UserManagement from '../features/shared/UserManagement';
import AuditLogs from '../features/shared/AuditLogs';
import Branches from '../features/admin/Branches';

// Admin Pages
import Analytics from '../features/admin/Analytics';
import Expenses from '../features/admin/Expenses';
import TrainingManager from '../features/admin/TrainingManager';
import PosSettings from '../features/admin/PosSettings';
import Transactions from '../features/admin/Transactions';
import AdminAccountSettings from '../features/admin/AdminAccountSettings';
import Refunds from '../features/admin/Refunds';
import Trainers from '../features/admin/Trainers';
import Classes from '../features/admin/Classes';
import AdminMembers from '../features/admin/Members';
import DashboardReportPage from '../features/admin/DashboardReportPage';
import PnLReportPage from '../features/admin/PnLReportPage';
import AnalyticsReportPage from '../features/admin/AnalyticsReportPage';
import Payroll from '../features/admin/Payroll';
import Projections from '../features/admin/Projections';

// Staff Pages
import Inventory from '../features/admin/Inventory';
import Members from '../features/staff/Members';
import MemberDetail from '../features/staff/MemberDetail';
import TransactionDetail from '../features/staff/TransactionDetail';
import DoorScanner from '../features/staff/DoorScanner';
import StaffSettings from '../features/staff/StaffSettings';
import StaffTrainers from '../features/staff/Trainers';
import StaffClasses from '../features/staff/Classes';
import StaffRefunds from '../features/staff/Refunds';

// Trainer Pages
import TrainerClassesSessions from '../features/trainer/TrainerClassesSessions';
import TrainerProfile from '../features/trainer/TrainerProfile';
import TrainerShop from '../features/trainer/TrainerShop';
import TrainerPaymentMethods from '../features/trainer/TrainerPaymentMethods';
import TrainerPurchaseHistory from '../features/trainer/TrainerPurchaseHistory';
import TrainerGymTraffic from '../features/trainer/TrainerGymTraffic';
import TrainerCommissionHistory from '../features/trainer/TrainerCommissionHistory';
import TrainerRewards from '../features/trainer/TrainerRewards';

// Member Pages
import Schedule from '../features/member/Schedule';
import MemberShop from '../features/member/MemberShop';
import Profile from '../features/member/Profile';
import Attendance from '../features/member/Attendance';
import PurchaseHistory from '../features/member/PurchaseHistory';
import TrainerBooking from '../features/member/TrainerBooking';
import GymTraffic from '../features/member/GymTraffic';
import PaymentMethods from '../features/member/PaymentMethods';
import ShopCheckout from '../features/member/ShopCheckout';
import MemberAnnouncements from '../features/member/MemberAnnouncements';
import TermsConditions from '../features/member/TermsConditions';

// SuperAdmin Pages
import SuperAdminLayout from '../features/superadmin/SuperAdminLayout';
import TenantManagement from '../features/superadmin/TenantManagement';

// Components
import ProfileResult from '../components/ProfileResult';

const ProtectedRoute = ({ children, allowedRoles, fullScreen }) => {
    const { user, loading } = useAuth();

    if (loading)
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center text-cyan-600">
                Loading...
            </div>
        );

    if (!user) return <Navigate to="/login" />;

    // Redirect unauthorized users
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === ROLES.SUPERADMIN) {
            return <Navigate to="/superadmin/tenants" replace />;
        }
        return <Navigate to="/dashboard" replace />;
    }

    if (fullScreen) {
        return (
            <div className="bg-background min-h-screen w-full overflow-y-auto">
                {children}
            </div>
        );
    }

    // Members and Trainers use bottom nav only (no sidebar)
    if (user.role === ROLES.MEMBER || user.role === ROLES.TRAINER) {
        const gymName = user?.gym?.name;
        return (
            <div className="flex flex-col bg-background min-h-screen overflow-x-hidden">
                {gymName && (
                    <div className="w-full bg-[#14171c] border-b border-white/5 py-2 text-center text-[11px] tracking-wide text-gray-400">
                        {gymName}
                    </div>
                )}
                <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 overflow-y-auto transition-all duration-300">
                    {children}
                </main>
                <BottomNav />
            </div>
        );
    }

    // SuperAdmin uses its own layout
    if (user.role === ROLES.SUPERADMIN) {
        return (
            <SuperAdminLayout>
                {children}
            </SuperAdminLayout>
        );
    }

    // Staff/Admin/Owner use sidebar
    return (
        <div className="flex flex-col lg:flex-row bg-background h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8 overflow-y-auto h-full scrollbar-hide">
                {children}
            </main>
        </div>
    );
};

const getMembershipLockState = (member) => {
    if (!member) return null;

    const now = new Date();
    const normalizedStatus = String(member.status || '').toUpperCase();
    if (normalizedStatus === 'FREEZED' || normalizedStatus === 'FROZEN') return 'freezed';
    if (normalizedStatus === 'EXPIRED') return 'expired';

    const freezeStart = member.freezeStartDate ? new Date(member.freezeStartDate) : null;
    const freezeEnd = member.freezeEndDate ? new Date(member.freezeEndDate) : null;
    if (
        freezeStart
        && freezeEnd
        && !Number.isNaN(freezeStart.getTime())
        && !Number.isNaN(freezeEnd.getTime())
        && now >= freezeStart
        && now <= freezeEnd
    ) {
        return 'freezed';
    }

    if (!member.expiryDate) return null;
    const expiryDate = new Date(member.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) return 'expired';

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return expiryDate < todayStart ? 'expired' : null;
};

const MEMBERSHIP_FREEZE_REDIRECT_SECONDS = 5;

const ActiveMembershipGate = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(Boolean(user?.role === ROLES.MEMBER));
    const [lockState, setLockState] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const verifyMembership = async () => {
            if (user?.role !== ROLES.MEMBER || !user?.id) {
                if (!isMounted) return;
                setChecking(false);
                setLockState(null);
                return;
            }

            if (isMounted) setChecking(true);
            try {
                const res = await axios.get(withApiBase(`/api/members/${user.id}`));
                const member = res.data?.member || res.data || null;
                if (!isMounted) return;
                setLockState(getMembershipLockState(member));
            } catch {
                if (!isMounted) return;
                // Fail safe: when membership cannot be verified, keep access to avoid accidental lockout.
                setLockState(null);
            } finally {
                if (isMounted) setChecking(false);
            }
        };

        verifyMembership();
        return () => {
            isMounted = false;
        };
    }, [user?.id, user?.role]);

    useEffect(() => {
        if (lockState !== 'freezed') return;

        const redirectTimer = window.setTimeout(() => {
            navigate('/profile?membership=freezed', { replace: true });
        }, MEMBERSHIP_FREEZE_REDIRECT_SECONDS * 1000);

        return () => {
            window.clearTimeout(redirectTimer);
        };
    }, [lockState, navigate]);

    if (user?.role !== ROLES.MEMBER) return children;
    if (checking) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-text-muted text-sm">Checking membership status...</div>
            </div>
        );
    }
    if (lockState === 'expired') {
        return <Navigate to="/profile?membership=expired" replace />;
    }
    if (lockState === 'freezed') {
        return (
            <div className="relative min-h-[60vh]">
                <div className="pointer-events-none select-none opacity-30 blur-[1px]">
                    {children}
                </div>
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-blue-400/35 bg-surface p-5 sm:p-6 text-center shadow-2xl">
                        <div className="mx-auto mb-3 h-11 w-11 rounded-full bg-blue-500/15 border border-blue-400/35 flex items-center justify-center">
                            <span className="material-icons-round text-blue-300">ac_unit</span>
                        </div>
                        <h3 className="text-white text-base sm:text-lg font-bold">Membership Freezed</h3>
                        <p className="mt-2 text-xs sm:text-sm text-text-muted">
                            This page is blocked while your membership is on freeze.
                        </p>
                    </div>
                </div>
            </div>
        );
    }
    return children;
};

export default function AppRoutes() {
    const { user } = useAuth();
    const globalScanBufferRef = useRef('');
    const globalScanTimerRef = useRef(null);
    const isStandaloneApp = typeof window !== 'undefined'
        && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    const rootElement = user
        ? String(user.role || '').toUpperCase() === ROLES.SUPERADMIN
            ? <Navigate to="/superadmin/tenants" replace />
            : <Navigate to="/dashboard" replace />
        : isStandaloneApp
            ? <Navigate to="/signup" replace />
            : <Landing />;

    useEffect(() => {
        const role = String(user?.role || '').toUpperCase();
        const enableGlobalScanner = role === ROLES.ADMIN || role === ROLES.STAFF || role === ROLES.OWNER;

        if (!enableGlobalScanner) return;

        const processGlobalScan = async (raw) => {
            const payloadRaw = String(raw || '').trim();
            if (!payloadRaw) return;

            const accessTokenMatch = payloadRaw.match(/^access\s*:\s*(.+)$/i);
            if (accessTokenMatch?.[1]) {
                try {
                    const res = await axios.post('/api/access/checkin', { qrToken: accessTokenMatch[1].trim() });
                    window.dispatchEvent(new CustomEvent('global-access-scan', { detail: { ok: true, log: res.data } }));
                } catch (error) {
                    window.dispatchEvent(new CustomEvent('global-access-scan', { detail: { ok: false, error } }));
                }
                return;
            }

            const memberMatch = payloadRaw.match(/member\s*:\s*(\d+)/i);
            const trainerMatch = payloadRaw.match(/trainer\s*:\s*(\d+)/i);
            const genericMatch = payloadRaw.match(/(\d+)/);

            if (!memberMatch && !trainerMatch && !genericMatch) return;

            const payload = trainerMatch
                ? { trainerId: Number(trainerMatch[1]) }
                : { memberId: Number((memberMatch || genericMatch)[1]) };

            if ((!payload.memberId && !payload.trainerId) || payload.memberId === 0 || payload.trainerId === 0) return;

            try {
                const res = await axios.post('/api/access/checkin', payload);
                window.dispatchEvent(new CustomEvent('global-access-scan', { detail: { ok: true, log: res.data } }));
            } catch (error) {
                window.dispatchEvent(new CustomEvent('global-access-scan', { detail: { ok: false, error } }));
            }
        };

        const handleGlobalKeyDown = (e) => {
            const target = e.target;
            const isTyping =
                target?.tagName === 'INPUT'
                || target?.tagName === 'TEXTAREA'
                || target?.isContentEditable;
            if (isTyping) return;

            if (globalScanTimerRef.current) {
                clearTimeout(globalScanTimerRef.current);
            }

            if (e.key === 'Enter') {
                const raw = globalScanBufferRef.current.trim();
                globalScanBufferRef.current = '';
                if (raw) processGlobalScan(raw);
                return;
            }

            if (e.key.length === 1) {
                globalScanBufferRef.current += e.key;
                globalScanTimerRef.current = setTimeout(() => {
                    const raw = globalScanBufferRef.current.trim();
                    globalScanBufferRef.current = '';
                    if (raw) processGlobalScan(raw);
                }, 300);
            }
        };

        window.__globalAccessScannerEnabled = true;
        window.addEventListener('keydown', handleGlobalKeyDown);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            if (globalScanTimerRef.current) {
                clearTimeout(globalScanTimerRef.current);
            }
            globalScanBufferRef.current = '';
            window.__globalAccessScannerEnabled = false;
        };
    }, [user?.role]);

    return (
        <div className="flex-1 w-full bg-background overflow-auto relative">
            <PWAInstallPrompt user={user} />
            <Routes>
                {/* --- PUBLIC ROUTES --- */}
                <Route path="/" element={rootElement} />
                <Route
                    path="/landing"
                    element={!user && isStandaloneApp ? <Navigate to="/login" replace /> : <Landing />}
                />
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/activate" element={<ActivateAccount />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />


                {/* --- PROTECTED ROUTES --- */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER, ROLES.TRAINER]}>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                {/* --- SUPERADMIN ROUTES --- */}
                <Route
                    path="/superadmin/tenants"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN]}>
                            <TenantManagement />
                        </ProtectedRoute>
                    }
                />

                {/* Staff Tools */}
                <Route
                    path="/scanner"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <DoorScanner />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/scan-result/:logId"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]} fullScreen>
                            <ProfileResult />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/display-monitor"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]} fullScreen>
                            <DisplayMonitor />
                        </ProtectedRoute>
                    }
                />

                {/* Shared / Hybrid Routes */}
                <Route
                    path="/payments"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}>
                            <Payments />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/loyalty"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}>
                            <Loyalty />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/access"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}>
                            <Access />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/announcements"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.TRAINER]}>
                            {user?.role === ROLES.MEMBER || user?.role === ROLES.TRAINER ? <MemberAnnouncements /> : <Announcements />}
                        </ProtectedRoute>
                    }
                />

                {/* Staff Management */}
                <Route
                    path="/members"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <Members />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/members"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <AdminMembers />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/members/:id"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <MemberDetail />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/pos/transactions/:id"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <TransactionDetail />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/inventory"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <Inventory />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/inventory/products/new"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <Inventory />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/inventory/products/:id/edit"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <Inventory />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/inventory/stock-orders/new"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <Inventory />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/inventory/stock-orders/:id/edit"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <Inventory />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/trainers"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            {user?.role === ROLES.STAFF ? <StaffTrainers /> : <Trainers />}
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/classes"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            {user?.role === ROLES.STAFF ? <StaffClasses /> : <Classes />}
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/training-manager"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <TrainingManager />
                        </ProtectedRoute>
                    }
                />

                {/* Trainer Routes */}
                <Route
                    path="/trainer/classes-sessions"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerClassesSessions />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/sessions"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <Navigate to="/trainer/classes-sessions" replace />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/classes"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <Navigate to="/trainer/classes-sessions" replace />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/profile"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerProfile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/profile/edit"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerProfile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/profile/availability"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerProfile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/profile/member-card"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerProfile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/profile/requests"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerProfile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/shop"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerShop />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/payment-methods"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerPaymentMethods />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/purchase-history"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerPurchaseHistory />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/gym-traffic"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerGymTraffic />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/commission-history"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerCommissionHistory />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/loyalty"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <TrainerRewards />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer/availability"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
                            <Navigate to="/trainer/profile/availability" replace />
                        </ProtectedRoute>
                    }
                />

                {/* Admin / Owner Features */}
                <Route
                    path="/analytics"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <Analytics />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/analytics/pnl-report"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]} fullScreen>
                            <PnLReportPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/analytics/report/:type"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]} fullScreen>
                            <AnalyticsReportPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/report"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]} fullScreen>
                            <DashboardReportPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <Settings />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/users"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <UserManagement />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/audit"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER]}>
                            <AuditLogs />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/branches"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER]}>
                            <Branches />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/expenses"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <Expenses />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/suppliers"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <Navigate to="/inventory?tab=suppliers" replace />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/transactions"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <Transactions />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/refunds"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            {user?.role === ROLES.STAFF ? <Navigate to="/staff/refunds" replace /> : <Refunds />}
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/staff/refunds"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.STAFF]}>
                            <StaffRefunds />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projections"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER]}>
                            <Projections />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/pos-settings"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <PosSettings />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/payroll"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <Payroll />
                        </ProtectedRoute>
                    }
                />

                {/* Member Features */}
                <Route
                    path="/schedule"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MEMBER, ROLES.STAFF]}>
                            <ActiveMembershipGate>
                                <Schedule />
                            </ActiveMembershipGate>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/shop"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MEMBER, ROLES.ADMIN]}>
                            <MemberShop />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MEMBER, ROLES.ADMIN, ROLES.STAFF]}>
                            {user?.role === ROLES.STAFF
                                ? <Navigate to="/staff/settings" replace />
                                : user?.role === ROLES.ADMIN
                                    ? <AdminAccountSettings />
                                    : <Profile />}
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/terms-and-conditions"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <TermsConditions />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/staff/settings"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.STAFF]}>
                            <StaffSettings />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/attendance"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER]}>
                            <Attendance />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/purchase-history"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <PurchaseHistory />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/trainer-booking"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <ActiveMembershipGate>
                                <TrainerBooking />
                            </ActiveMembershipGate>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/gym-traffic"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <GymTraffic />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/payment-methods"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <PaymentMethods />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/shop-checkout"
                    element={
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <ShopCheckout />
                        </ProtectedRoute>
                    }
                />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}

