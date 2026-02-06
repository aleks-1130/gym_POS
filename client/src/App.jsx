import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ROLES } from './constants/roles';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

// Auth & Public
import Landing from './pages/Landing'; // Added
import Signup from './pages/auth/Signup'; // Added
import Login from './pages/auth/Login';

// Shared
import Dashboard from './pages/shared/Dashboard';
import Payments from './pages/shared/Payments';
import Access from './pages/shared/Access';
import Loyalty from './pages/shared/Loyalty';
import Announcements from './pages/shared/Announcements';

// Owner Pages
import Settings from './pages/owner/Settings';
import UserManagement from './pages/owner/UserManagement';
import AuditLogs from './pages/owner/AuditLogs';

// Admin Pages
import Analytics from './pages/admin/Analytics';

// Staff Pages
import Inventory from './pages/staff/Inventory';
import Members from './pages/staff/Members';
import MemberDetail from './pages/staff/MemberDetail';
import Trainers from './pages/staff/Trainers';
import Classes from './pages/staff/Classes';

// Member Pages
import Schedule from './pages/member/Schedule';
import MemberShop from './pages/member/MemberShop';
import Profile from './pages/member/Profile';
import Attendance from './pages/member/Attendance';
import PurchaseHistory from './pages/member/PurchaseHistory';
import TrainerBooking from './pages/member/TrainerBooking';

// ✅ NEW IMPORTS
import DoorScanner from './pages/staff/DoorScanner';
import DisplayMonitor from './pages/shared/DisplayMonitor';
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

  // Changed redirect to /dashboard so logged in users don't loop to Landing
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

  if (user.role === ROLES.MEMBER) {
    return (
      <div className="flex flex-col bg-background min-h-screen overflow-x-hidden">
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 overflow-y-auto transition-all duration-300">
          {children}
        </main>
        <BottomNav />
      </div>
    );
  }

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
  return (
    <div className="flex-1 w-full bg-background overflow-auto relative">
      <Routes>
        {/* --- PUBLIC ROUTES (No Protection) --- */}
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* --- DASHBOARD (Protected) --- */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* --- STAFF/ADMIN TOOLS --- */}
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

        {/* --- SHARED ROUTES --- */}
        <Route path="/payments" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}><Payments /></ProtectedRoute>} />
        <Route path="/loyalty" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}><Loyalty /></ProtectedRoute>} />
        <Route path="/access" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF, ROLES.MEMBER]}><Access /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><Announcements /></ProtectedRoute>} />

        {/* --- STAFF MANAGEMENT --- */}
        <Route path="/members" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><Members /></ProtectedRoute>} />
        <Route path="/members/:id" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><MemberDetail /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><Inventory /></ProtectedRoute>} />
        <Route path="/trainers" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><Trainers /></ProtectedRoute>} />
        <Route path="/classes" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><Classes /></ProtectedRoute>} />

        {/* --- ADMIN/OWNER ONLY --- */}
        <Route path="/analytics" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}><Analytics /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={[ROLES.OWNER]}><Settings /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.ADMIN]}><UserManagement /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute allowedRoles={[ROLES.OWNER]}><AuditLogs /></ProtectedRoute>} />

        {/* --- MEMBER FEATURES --- */}
        <Route path="/schedule" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MEMBER, ROLES.ADMIN, ROLES.STAFF]}><Schedule /></ProtectedRoute>} />
        <Route path="/shop" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MEMBER, ROLES.ADMIN]}><MemberShop /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MEMBER, ROLES.ADMIN, ROLES.STAFF]}><Profile /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><Attendance /></ProtectedRoute>} />
        <Route path="/purchase-history" element={<ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><PurchaseHistory /></ProtectedRoute>} />
        <Route path="/trainer-booking" element={<ProtectedRoute allowedRoles={[ROLES.MEMBER, ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF]}><TrainerBooking /></ProtectedRoute>} />

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
        <Router>
          <AppRoutes />
        </Router>
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;