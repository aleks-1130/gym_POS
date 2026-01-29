import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Payments from './pages/Payments';
import Access from './pages/Access';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Trainers from './pages/Trainers';
import Classes from './pages/Classes';
import Analytics from './pages/Analytics';
import Loyalty from './pages/Loyalty';
import Notifications from './pages/Notifications';
import UserManagement from './pages/UserManagement';
import AuditLogs from './pages/AuditLogs';
import Schedule from './pages/Schedule';
import MemberShop from './pages/MemberShop';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-cyan-600">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  // Check role access
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If unauthorized, redirect to home or show error
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-20 p-8 overflow-y-auto h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
};

// Placeholder components until real ones are made
const Placeholder = ({ title }) => <h1 className="text-3xl font-bold text-white">{title}</h1>;

function AppRoutes() {
  return (
    <div className="flex-1 w-full bg-background overflow-auto p-8 relative">
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Public / Common Routes */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/trainers" element={<ProtectedRoute><Trainers /></ProtectedRoute>} />

        {/* Member Accessible Routes */}
        <Route path="/payments" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'MEMBER']}><Payments /></ProtectedRoute>} />
        <Route path="/loyalty" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'MEMBER']}><Loyalty /></ProtectedRoute>} />

        {/* Admin/Staff Only Routes */}
        <Route path="/members" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}><Members /></ProtectedRoute>} />
        <Route path="/members/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}><MemberDetail /></ProtectedRoute>} />
        <Route path="/access" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'MEMBER']}><Access /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}><Inventory /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}><Analytics /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={['OWNER']}><Settings /></ProtectedRoute>} />

        {/* RBAC Management */}
        <Route path="/users" element={<ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}><UserManagement /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute allowedRoles={['OWNER']}><AuditLogs /></ProtectedRoute>} />

        {/* Member Portal */}
        <Route path="/schedule" element={<ProtectedRoute allowedRoles={['MEMBER', 'ADMIN', 'STAFF']}><Schedule /></ProtectedRoute>} />
        <Route path="/shop" element={<ProtectedRoute allowedRoles={['MEMBER', 'ADMIN', 'STAFF']}><MemberShop /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={['MEMBER', 'ADMIN', 'STAFF']}><Profile /></ProtectedRoute>} />

      </Routes>
      {/* Mobile Navigation */}
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
