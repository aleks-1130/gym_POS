import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * SuperAdminLayout - Minimalist layout for Superadmin functionality.
 * Focused on Tenant Management with a professional dark aesthetic.
 */
export default function SuperAdminLayout({ children }) {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { label: 'Tenants', path: '/superadmin/tenants', icon: 'business' },
    ];

    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] flex flex-col pt-8">
                <div className="px-6 mb-10">
                    <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
                        <span className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-black">S</span>
                        SUPERADMIN
                    </h1>
                    <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] mt-1 font-bold">Platform Control</p>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                                    isActive 
                                        ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5' 
                                        : 'text-text-muted hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <span className="material-icons-round text-xl">{item.icon}</span>
                                <span className="font-bold text-sm tracking-tight">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto border-t border-white/5">
                    <div className="flex items-center gap-3 px-4 py-4 mb-2">
                        <div className="w-10 h-10 rounded-full bg-surfaceHighlight border border-white/10 flex items-center justify-center font-bold text-primary">
                            {user?.name?.charAt(0) || 'S'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{user?.name || 'Super Admin'}</p>
                            <p className="text-[10px] text-text-muted truncate uppercase tracking-widest">{user?.role}</p>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all group"
                    >
                        <span className="material-icons-round group-hover:scale-110 transition-transform">logout</span>
                        <span className="font-bold text-sm tracking-tight">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto scrollbar-hide bg-[#050505]">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
