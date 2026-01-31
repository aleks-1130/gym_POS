import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const NavItem = ({ to, icon, label }) => (
        <NavLink to={to} onClick={() => setIsMobileOpen(false)} className={({ isActive }) => `
        relative group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300
        ${isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-white/5 hover:text-white'}
    `}>
            {({ isActive }) => (
                <>
                    {isActive && <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"></div>}
                    <span className="material-icons-round flex-shrink-0 text-2xl">{icon}</span>
                    <span className={`font-medium transition-all duration-300 ${isCollapsed ? 'hidden' : 'inline'}`}>{label}</span>
                </>
            )}
        </NavLink>
    );

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="fixed top-4 left-4 z-40 lg:hidden w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
            >
                <span className="material-icons-round">{isMobileOpen ? 'close' : 'menu'}</span>
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed left-0 top-0 h-screen bg-surface border-r border-white/5 flex flex-col py-6 z-40 transition-all duration-300 shadow-lg
                lg:static lg:h-full lg:z-auto lg:translate-x-0
                ${isMobileOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
                ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
            `}>
                {/* Logo */}
                <div className="flex items-center justify-between px-4 mb-8">
                    <div className={`w-10 h-10 bg-gradient-to-br from-orange-400 to-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}>
                        <span className="font-bold text-white text-xl">S</span>
                    </div>
                    {!isCollapsed && (
                        <span className="text-white font-bold ml-3 hidden lg:inline">FitOS</span>
                    )}
                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 transition-colors ml-auto"
                    >
                        <span className="material-icons-round text-lg">{isCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_left'}</span>
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 flex flex-col w-full px-2 gap-1 overflow-y-auto no-scrollbar pb-4">
                    <NavItem to="/" icon="dashboard" label="Home" />

                    {[ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                        <NavItem to="/payments" icon="receipt_long" label="Payments" />
                    )}

                    {[ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                        <NavItem to="/members" icon="groups" label="Members" />
                    )}

                    {[ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                        <NavItem to="/access" icon="assignment_ind" label="Access Ctrl" />
                    )}

                    <div className={`w-8 h-[1px] bg-white/10 my-1 ${isCollapsed ? 'mx-auto' : ''}`}></div>

                    {[ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                        <NavItem to="/inventory" icon="inventory_2" label="Stock" />
                    )}

                    {[ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                        <>
                            <NavItem to="/trainers" icon="fitness_center" label="Trainer" />
                            <NavItem to="/classes" icon="schedule" label="Class" />
                            <div className={`w-8 h-[1px] bg-white/10 my-1 ${isCollapsed ? 'mx-auto' : ''}`}></div>
                            <NavItem to="/schedule" icon="calendar_today" label="Schedule" />
                        </>
                    )}
                    {/* Shop is likely for members only unless POS is integrated here */}
                    {user.role === ROLES.MEMBER && (
                        <NavItem to="/shop" icon="shopping_bag" label="Shop" />
                    )}

                    {[ROLES.OWNER, ROLES.ADMIN].includes(user?.role) && (
                        <NavItem to="/analytics" icon="insights" label="Analytics" />
                    )}

                    {[ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                        <>
                            <NavItem to="/loyalty" icon="loyalty" label="Loyalty" />
                            <NavItem to="/notifications" icon="notifications" label="Notifications" />
                        </>
                    )}

                    <div className={`w-8 h-[1px] bg-white/10 my-1 ${isCollapsed ? 'mx-auto' : ''}`}></div>

                    {user?.role === ROLES.OWNER && (
                        <>
                            <NavItem to="/users" icon="admin_panel_settings" label="Users" />
                            <NavItem to="/audit" icon="security" label="Audit" />
                        </>
                    )}

                    {[ROLES.OWNER].includes(user?.role) && (
                        <NavItem to="/settings" icon="settings" label="Settings" />
                    )}
                </nav>

                {/* Logout */}
                <div className="border-t border-white/10 pt-4 px-2">
                    <button
                        onClick={logout}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors`}
                    >
                        <span className="material-icons-round flex-shrink-0">logout</span>
                        <span className={`font-medium transition-all duration-300 ${isCollapsed ? 'hidden' : 'inline'}`}>Sign Out</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
