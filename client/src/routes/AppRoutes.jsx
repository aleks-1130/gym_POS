import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
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

// Admin Pages
import Analytics from '../features/admin/Analytics';
import Expenses from '../features/admin/Expenses';
import TrainingManager from '../features/admin/TrainingManager';
import PosSettings from '../features/admin/PosSettings';
import Transactions from '../features/admin/Transactions';
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

// Trainer Pages
import TrainerClassesSessions from '../features/trainer/TrainerClassesSessions';
import TrainerProfile from '../features/trainer/TrainerProfile';
import TrainerShop from '../features/trainer/TrainerShop';
import TrainerPaymentMethods from '../features/trainer/TrainerPaymentMethods';
import TrainerPurchaseHistory from '../features/trainer/TrainerPurchaseHistory';
import TrainerGymTraffic from '../features/trainer/TrainerGymTraffic';
import TrainerCommissionHistory from '../features/trainer/TrainerCommissionHistory';
import TrainerLoyalty from '../features/trainer/TrainerLoyalty';

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

    // Redirect unauthorized users to dashboard
    if (allowedRoles && !allowedRoles.includes(user.role)) {
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
        return (
            <div className="flex flex-col bg-background min-h-screen overflow-x-hidden">
                <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 overflow-y-auto transition-all duration-300">
                    {children}
                </main>
                <BottomNav />
            </div>
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

export default function AppRoutes() {
    const { user } = useAuth();
    const isStandaloneApp = typeof window !== 'undefined'
        && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    const rootElement = user
        ? <Navigate to="/dashboard" replace />
        : isStandaloneApp
            ? <Navigate to="/login" replace />
            : <Landing />;

    return (
        <div className="flex-1 w-full bg-background overflow-auto relative">
            <PWAInstallPrompt user={user} />
            <Routes>
                {/* --- PUBLIC ROUTES --- */}
                <Route path="/" element={rootElement} />
                <Route path="/landing" element={<Landing />} />
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
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
                            <Announcements />
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
                            <TrainerLoyalty />
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
                        <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}>
                            <Refunds />
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
                            <Schedule />
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
                            {user?.role === ROLES.STAFF ? <Navigate to="/staff/settings" replace /> : <Profile />}
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
                        <ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
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
                            <TrainerBooking />
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
