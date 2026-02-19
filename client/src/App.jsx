import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { SettingsProvider } from './context/SettingsContext';
import { ROLES } from './constants/roles';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import FullscreenController from './components/FullscreenController';

// Auth & Public
import Landing from './pages/Landing';
import Signup from './pages/auth/Signup';
import Login from './pages/auth/Login';

// Shared
import Dashboard from './pages/shared/Dashboard';
import Payments from './pages/shared/Payments';
import Access from './pages/staff/Access';
import Loyalty from './pages/shared/Loyalty';
import Announcements from './pages/shared/Announcements';
import DisplayMonitor from './pages/shared/DisplayMonitor';

// Owner Pages
import Settings from './pages/owner/Settings';
import UserManagement from './pages/owner/UserManagement';
import AuditLogs from './pages/owner/AuditLogs';

// Admin Pages
import Analytics from './pages/admin/Analytics';
import Expenses from './pages/admin/Expenses';
import Suppliers from './pages/admin/Suppliers';
import TrainingManager from './pages/admin/TrainingManager';
import PosSettings from './pages/admin/PosSettings';
import Transactions from './pages/admin/Transactions';
import Trainers from './pages/admin/Trainers';
import Classes from './pages/admin/Classes';
import AdminMembers from './pages/admin/Members';
import DashboardReportPage from './pages/admin/DashboardReportPage';
import PnLReportPage from './pages/admin/PnLReportPage';
import AnalyticsReportPage from './pages/admin/AnalyticsReportPage';
import Payroll from './pages/admin/Payroll';

// Staff Pages
import Inventory from './pages/staff/Inventory';
import Members from './pages/staff/Members';
import MemberDetail from './pages/staff/MemberDetail';
import TransactionDetail from './pages/staff/TransactionDetail';
import DoorScanner from './pages/staff/DoorScanner';

// Trainer Pages
import TrainerSessions from './pages/trainer/TrainerSessions';
import TrainerClasses from './pages/trainer/TrainerClasses';
import TrainerProfile from './pages/trainer/TrainerProfile';
import TrainerShop from './pages/trainer/TrainerShop';
import TrainerPaymentMethods from './pages/trainer/TrainerPaymentMethods';
import TrainerPurchaseHistory from './pages/trainer/TrainerPurchaseHistory';
import TrainerGymTraffic from './pages/trainer/TrainerGymTraffic';
import TrainerCommissionHistory from './pages/trainer/TrainerCommissionHistory';
import TrainerLoyalty from './pages/trainer/TrainerLoyalty';

// Member Pages
import Schedule from './pages/member/Schedule';
import MemberShop from './pages/member/MemberShop';
import Profile from './pages/member/Profile';
import Attendance from './pages/member/Attendance';
import PurchaseHistory from './pages/member/PurchaseHistory';
import TrainerBooking from './pages/member/TrainerBooking';
import GymTraffic from './pages/member/GymTraffic';
import PaymentMethods from './pages/member/PaymentMethods';
import ShopCheckout from './pages/member/ShopCheckout';

// Components
import ProfileResult from './components/ProfileResult';

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

function AppRoutes() {
  const { user } = useAuth();

  return (
    <div className="flex-1 w-full bg-background overflow-auto relative">
      <PWAInstallPrompt user={user} />
      <FullscreenController enabled={Boolean(user)} />
      <Routes>
        {/* --- PUBLIC ROUTES --- */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

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
            <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}>
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
          path="/trainers"
          element={
            <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
              <Trainers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes"
          element={
            <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}>
              <Classes />
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
          path="/trainer/sessions"
          element={
            <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
              <TrainerSessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trainer/classes"
          element={
            <ProtectedRoute allowedRoles={[ROLES.TRAINER]}>
              <TrainerClasses />
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
            <ProtectedRoute allowedRoles={[ROLES.OWNER]}>
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
              <Suppliers />
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
            <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MEMBER, ROLES.ADMIN, ROLES.STAFF]}>
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
              <Profile />
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

function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <SettingsProvider>
          <Router>
            <AppRoutes />
          </Router>
        </SettingsProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;
