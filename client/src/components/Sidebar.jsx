import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import { useUIStore } from '../stores/useUIStore';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { isSidebarCollapsed: isCollapsed, toggleSidebar } = useUIStore();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const NavItem = ({ to, icon, label }) => (
        <NavLink
            to={to}
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) => `
                relative group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-text-secondary hover:bg-white/5 hover:text-white'
                }
            `}
        >
            {({ isActive }) => (
                <>
                    <span className="material-icons-round text-[19px] flex-shrink-0">{icon}</span>
                    <span className={`font-semibold text-[13px] whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'}`}>
                        {label}
                    </span>
                    {!isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                    )}
                </>
            )}
        </NavLink>
    );

    const SectionDivider = ({ label }) => (
        <div className="px-3 mt-4 mb-1.5">
            <div className={`flex items-center gap-2 transition-all duration-300 ${isCollapsed ? 'lg:justify-center' : ''}`}>
                {!isCollapsed && (
                    <>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider hidden lg:inline">
                            {label}
                        </span>
                        <div className="flex-1 h-px bg-white/5 hidden lg:block"></div>
                    </>
                )}
                {isCollapsed && (
                    <div className="w-6 h-px bg-white/10 hidden lg:block"></div>
                )}
            </div>
        </div>
    );

    const menuConfig = {
        [ROLES.STAFF]: [
            {
                section: "Operations", items: [
                    { to: "/payments", icon: "receipt_long", label: "POS" },
                    { to: "/members", icon: "groups", label: "Members" },
                    { to: "/access", icon: "qr_code_scanner", label: "Access" },
                ]
            },
            {
                section: "Programs", items: [
                    { to: "/trainers", icon: "fitness_center", label: "Trainers" },
                    { to: "/classes", icon: "event", label: "Classes" },
                ]
            },
            {
                section: "Engagement", items: [
                    { to: "/loyalty", icon: "loyalty", label: "Rewards" },
                    { to: "/announcements", icon: "campaign", label: "Announcements" },
                ]
            }
        ],
        [ROLES.ADMIN]: [
            {
                section: "Operations", items: [
                    { to: "/payments", icon: "receipt_long", label: "POS" },
                    { to: "/admin/members", icon: "groups", label: "Members" },
                    { to: "/access", icon: "qr_code_scanner", label: "Access" },
                ]
            },
            {
                section: "Management", items: [
                    { to: "/payroll", icon: "payments", label: "Payroll" },
                    { to: "/inventory", icon: "inventory_2", label: "Inventory" },
                    { to: "/suppliers", icon: "local_shipping", label: "Suppliers" },
                    { to: "/expenses", icon: "monetization_on", label: "Expenses" },
                    { to: "/pos-settings", icon: "pin", label: "POS Settings" },
                    { to: "/trainers", icon: "fitness_center", label: "Trainers" },
                    { to: "/classes", icon: "event", label: "Classes" },
                    { to: "/training-manager", icon: "assignment", label: "Training Sessions" },
                ]
            },
            {
                section: "Insights", items: [
                    { to: "/schedule", icon: "calendar_month", label: "Schedule" },
                    { to: "/analytics", icon: "analytics", label: "Analytics" },
                    { to: "/transactions", icon: "history", label: "Transactions" },
                    { to: "/refunds", icon: "assignment_return", label: "Refunds" },
                    { to: "/loyalty", icon: "loyalty", label: "Rewards" },
                    { to: "/announcements", icon: "campaign", label: "Broadcast" },
                ]
            }
        ],
        [ROLES.OWNER]: [
            {
                section: "Overview", items: [
                    { to: "/members", icon: "groups", label: "Members" },
                    { to: "/analytics", icon: "analytics", label: "Analytics" },
                ]
            },
            {
                section: "Administration", items: [
                    { to: "/users", icon: "admin_panel_settings", label: "Users" },
                    { to: "/payroll", icon: "payments", label: "Payroll" },
                    { to: "/audit", icon: "verified_user", label: "Audit Logs" },
                    { to: "/refunds", icon: "assignment_return", label: "Refunds" },
                    { to: "/projections", icon: "trending_up", label: "Projections" },
                    { to: "/settings", icon: "tune", label: "Settings" },
                    { to: "/suppliers", icon: "local_shipping", label: "Suppliers" },
                    { to: "/expenses", icon: "monetization_on", label: "Expenses" },
                    { to: "/pos-settings", icon: "pin", label: "POS Settings" },
                ]
            }
        ],
        [ROLES.MEMBER]: [
            {
                section: "Services", items: [
                    { to: "/shop", icon: "shopping_bag", label: "Shop" },
                ]
            }
        ],
        [ROLES.TRAINER]: [
            {
                section: "Trainer", items: [
                    { to: "/trainer/sessions", icon: "event_note", label: "Sessions" },
                    { to: "/trainer/classes", icon: "event", label: "Classes" }
                ]
            }
        ]
    };

    const currentMenu = menuConfig[user?.role] || [];

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="fixed top-4 left-4 z-50 lg:hidden w-11 h-11 rounded-xl bg-surface border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
                <span className="material-icons-round text-xl">
                    {isMobileOpen ? 'close' : 'menu'}
                </span>
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed left-0 top-0 h-screen bg-surface border-r border-white/5 flex flex-col z-40 transition-all duration-300
                lg:static lg:h-full lg:z-auto lg:translate-x-0
                ${isMobileOpen ? 'w-64 translate-x-0 shadow-2xl' : 'w-20 -translate-x-full lg:translate-x-0'}
                ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-5 border-b border-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
                            <span className="material-icons-round text-white text-xl">fitness_center</span>
                        </div>
                        <div className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'}`}>
                            <h1 className="text-white font-bold text-lg whitespace-nowrap">FitOS</h1>
                            <p className="text-text-muted text-[10px] uppercase tracking-wider font-medium whitespace-nowrap">
                                {user?.role || 'System'}
                            </p>
                        </div>
                    </div>

                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={toggleSidebar}
                        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 transition-all flex-shrink-0 hover:scale-105 active:scale-95"
                    >
                        <span className="material-icons-round text-base text-text-muted">
                            {isCollapsed ? 'chevron_right' : 'chevron_left'}
                        </span>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col px-3 py-4 gap-1 overflow-y-visible overflow-x-hidden no-scrollbar">
                    <NavItem to="/dashboard" icon="dashboard" label="Dashboard" />

                    {currentMenu.map((section, idx) => (
                        <div key={idx}>
                            <SectionDivider label={section.section} />
                            {section.items.map((item) => (
                                <NavItem key={item.to} {...item} />
                            ))}
                        </div>
                    ))}
                </nav>

                {/* User Profile & Logout */}
                <div className="border-t border-white/5 p-3 space-y-2">
                    {/* User Info */}
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 transition-all duration-300 ${isCollapsed ? 'lg:justify-center' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
                            <span className="text-white text-xs font-bold">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className={`min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:w-0 lg:opacity-0 lg:overflow-hidden' : 'w-auto opacity-100'}`}>
                            <p className="text-white text-sm font-semibold truncate">
                                {user?.username || 'User'}
                            </p>
                            <p className="text-text-muted text-xs truncate capitalize">
                                {user?.role?.toLowerCase() || 'Guest'}
                            </p>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button
                        onClick={logout}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-all group ${isCollapsed ? 'lg:justify-center' : ''}`}
                    >
                        <span className="material-icons-round text-[19px] flex-shrink-0 group-hover:rotate-12 transition-transform">
                            logout
                        </span>
                        <span className={`font-semibold text-sm transition-all duration-300 ${isCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'}`}>
                            Sign Out
                        </span>
                    </button>
                </div>
            </aside>
        </>
    );
}
