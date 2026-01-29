import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';

export default function Sidebar() {
    const { user, logout } = useAuth();

    const NavItem = ({ to, icon, label }) => (
        <NavLink to={to} className={({ isActive }) => `
        relative group flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 mb-2
        ${isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-white/5 hover:text-white'}
    `}>
            {({ isActive }) => (
                <>
                    {isActive && <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"></div>}
                    <span className="material-icons-round text-2xl mb-1">{icon}</span>
                    <span className="text-[10px] font-medium">{label}</span>
                </>
            )}
        </NavLink>
    );

    return (
        <aside className="fixed left-0 top-0 h-screen w-20 bg-surface border-r border-white/5 flex flex-col items-center py-6 z-50 shadow-sm">
            {/* Logo */}
            <div className="mb-8">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="font-bold text-white text-xl">S</span>
                </div>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 flex flex-col items-center w-full px-2 gap-1 overflow-y-auto no-scrollbar pb-4">
                <NavItem to="/" icon="dashboard" label="Home" />

                <NavItem to="/payments" icon="receipt_long" label={user.role === ROLES.MEMBER ? "History" : "Payments"} />
                {user.role === ROLES.MEMBER && (
                    <NavItem to="/access" icon="history" label="Attendance" />
                )}
                {[ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                    <>
                        <NavItem to="/members" icon="groups" label="Members" />
                        <NavItem to="/access" icon="assignment_ind" label="Access Ctrl" />
                    </>
                )}

                <div className="w-8 h-[1px] bg-white/10 my-1"></div>

                {[ROLES.ADMIN, ROLES.STAFF].includes(user?.role) && (
                    <NavItem to="/inventory" icon="inventory_2" label="Stock" />
                )}

                <NavItem to="/trainers" icon="fitness_center" label="Trainer" />
                <NavItem to="/classes" icon="schedule" label="Class" />

                <div className="w-8 h-[1px] bg-white/10 my-1"></div>

                <NavItem to="/schedule" icon="calendar_today" label="Sched" />
                <NavItem to="/shop" icon="shopping_bag" label="Shop" />

                {[ROLES.OWNER, ROLES.ADMIN].includes(user?.role) && (
                    <NavItem to="/analytics" icon="insights" label="Analyt" />
                )}

                <NavItem to="/loyalty" icon="loyalty" label="Loyal" />
                <NavItem to="/notifications" icon="notifications" label="Notif" />

                <div className="w-8 h-[1px] bg-white/10 my-1"></div>

                {user?.role === ROLES.OWNER && (
                    <>
                        <NavItem to="/users" icon="admin_panel_settings" label="Users" />
                        <NavItem to="/audit" icon="security" label="Audit" />
                    </>
                )}

                {[ROLES.OWNER].includes(user?.role) && (
                    <NavItem to="/settings" icon="settings" label="Config" />
                )}
            </nav>

            {/* Logout */}
            <button onClick={logout} className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-colors">
                <span className="material-icons-round">logout</span>
            </button>
        </aside>
    );
}
