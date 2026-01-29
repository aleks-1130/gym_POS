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
      <Route path="/inventory" element={<ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}><Inventory /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute allowedRoles={['ADMIN']}><Analytics /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><Settings /></ProtectedRoute>} />

    </Routes>
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
