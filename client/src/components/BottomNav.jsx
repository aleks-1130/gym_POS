import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, ShoppingBag, User, Users, Dumbbell, CheckCircle, Menu, X, Gift, History, Megaphone, Activity, CreditCard, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import axios from 'axios';

export default function BottomNav() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        const fetchUnreadCount = async () => {
            try {
                const res = await axios.get('/api/notifications');
                // Filter for announcements or notifications meant for this member
                const unread = res.data.filter(n => !n.isRead).length;
                setUnreadCount(unread);
            } catch (error) {
                console.error("Failed to fetch notification count");
            }
        };

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [user]);

    // Primary navigation items (bottom bar)
    const memberPrimaryNav = [
        { to: "/dashboard", icon: Home, label: "Home" },
        { to: "/attendance", icon: CheckCircle, label: "Attendance" },
        { to: "/trainer-booking", icon: Dumbbell, label: "Trainers" },
        { to: "/gym-traffic", icon: Activity, label: "Traffic" },
        { to: "/schedule", icon: Calendar, label: "Classes" },
        { to: "/shop", icon: ShoppingBag, label: "Shop" },
        { to: "/profile", icon: User, label: "Profile" },
    ];
    const trainerPrimaryNav = [
        { to: "/dashboard", icon: Home, label: "Home" },
        { to: "/trainer/classes-sessions", icon: Calendar, label: "Class&Session" },
        { to: "/trainer/gym-traffic", icon: Activity, label: "Traffic" },
        { to: "/trainer/shop", icon: ShoppingBag, label: "Shop" },
        { to: "/trainer/profile", icon: User, label: "Profile" },
    ];
    const trainerSecondaryNav = [
        { to: "/announcements", icon: Megaphone, label: "Announcements" },
        { to: "/trainer/loyalty", icon: Gift, label: "Rewards" },
        { to: "/trainer/commission-history", icon: Gift, label: "Commissions" },
        { to: "/trainer/payment-methods", icon: CreditCard, label: "Payment Methods" },
        { to: "/trainer/purchase-history", icon: History, label: "Purchase History" },
    ];

    // Secondary navigation items (hamburger menu)
    const memberSecondaryNav = [
        { to: "/announcements", icon: Megaphone, label: "Announcements" },
        { to: "/payment-methods", icon: CreditCard, label: "Payment Methods" },
        { to: "/loyalty", icon: Gift, label: "Rewards & Loyalty" },
        { to: "/purchase-history", icon: History, label: "Purchase History" },
    ];

    const staffPrimaryNav = [
        { to: "/dashboard", icon: Home, label: "Home" },
        { to: "/members", icon: Users, label: "Members" },
        { to: "/classes", icon: Dumbbell, label: "Classes" },
        { to: "/schedule", icon: Calendar, label: "Schedule" },
        { to: "/profile", icon: User, label: "Profile" },
    ];

    const primaryNavItems = user?.role === ROLES.MEMBER
        ? memberPrimaryNav
        : user?.role === ROLES.TRAINER
            ? trainerPrimaryNav
            : staffPrimaryNav;
    const secondaryNavItems = user?.role === ROLES.MEMBER
        ? memberSecondaryNav
        : user?.role === ROLES.TRAINER
            ? trainerSecondaryNav
            : [];
    const isMember = user?.role === ROLES.MEMBER;
    const isTrainer = user?.role === ROLES.TRAINER;
    const hasMoreMenu = isMember || isTrainer;

    // Update active index based on current location
    useEffect(() => {
        const currentIndex = primaryNavItems.findIndex(item => item.to === location.pathname);
        if (currentIndex !== -1) {
            setActiveIndex(currentIndex);
        } else {
            // If current path is in secondary nav (more menu), set activeIndex to -1 to hide highlights
            const isInSecondaryNav = secondaryNavItems.some(item => item.to === location.pathname);
            if (isInSecondaryNav) {
                setActiveIndex(-1);
            }
        }
    }, [location.pathname, primaryNavItems, secondaryNavItems]);

    // Close menu when route changes
    useEffect(() => {
        setShowMenu(false);
    }, [location.pathname]);

    // Calculate item width percentage - include "More" button for members
    const totalItems = hasMoreMenu ? primaryNavItems.length + 1 : primaryNavItems.length;
    const itemWidthPercent = 100 / totalItems;

    const handleSecondaryNavClick = (path) => {
        navigate(path);
        setShowMenu(false);
    };

    return (
        <>
            {/* Hamburger Menu Overlay */}
            {showMenu && hasMoreMenu && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
                    onClick={() => setShowMenu(false)}
                >
                    <div
                        className="absolute bottom-16 left-0 right-0 bg-surface border-t border-white/10 animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Menu Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Menu className="text-primary" size={20} />
                                <h3 className="text-white font-semibold text-sm">More Options</h3>
                            </div>
                            <button
                                onClick={() => setShowMenu(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                            >
                                <X className="text-white/70" size={18} />
                            </button>
                        </div>

                        {/* Menu Items */}
                        <div className="p-2">
                            {secondaryNavItems.map((item) => {
                                const IconComponent = item.icon;
                                const isActive = location.pathname === item.to;

                                return (
                                    <button
                                        key={item.to}
                                        onClick={() => handleSecondaryNavClick(item.to)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                                            ${isActive
                                                ? 'bg-primary/10 border border-primary/30'
                                                : 'hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        <IconComponent
                                            size={20}
                                            className={isActive ? 'text-primary' : 'text-text-muted'}
                                            strokeWidth={2}
                                        />
                                        <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-white'}`}>
                                            {item.label}
                                        </span>
                                        {item.to === '/announcements' && unreadCount > 0 && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary text-[10px] font-black text-background">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                        {isActive && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation Bar */}
            <nav className={`fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md z-40 border-t border-white/5 ${(!isMember && !isTrainer) && 'lg:hidden'}`}>
                <div className="relative max-w-full mx-auto">
                    <div className="relative h-16 bg-surface/50">
                        {/* This container prevents overflow */}
                        <div className="absolute inset-0 overflow-hidden">
                            {/* Animated highlight indicator - only show if activeIndex is valid */}
                            {activeIndex >= 0 && (
                                <div
                                    className="absolute bottom-0 h-0.5 bg-gradient-to-r from-primary to-orange-500 transition-all duration-300 ease-out rounded-full"
                                    style={{
                                        left: `${activeIndex * itemWidthPercent}%`,
                                        width: `${itemWidthPercent}%` }}
                                />
                            )}

                            {/* Active background glow - only show if activeIndex is valid */}
                            {activeIndex >= 0 && (
                                <div
                                    className="absolute inset-y-0 bg-gradient-to-t from-primary/10 to-transparent transition-all duration-300 ease-out pointer-events-none"
                                    style={{
                                        left: `${activeIndex * itemWidthPercent}%`,
                                        width: `${itemWidthPercent}%` }}
                                />
                            )}
                        </div>

                        {/* Navigation Items */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            {primaryNavItems.map((item, index) => {
                                const isActive = activeIndex === index;

                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className="flex-1 h-full transition-all duration-200 relative group"
                                    >
                                        {({ isActive: navIsActive }) => {
                                            const IconComponent = item.icon;
                                            return (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-10">
                                                    {/* Icon Container with contained effects */}
                                                    <div className={`
                                                        relative flex items-center justify-center w-9 h-9
                                                        transition-all duration-200 overflow-hidden rounded-full
                                                        ${isActive ? 'scale-110' : 'scale-100 group-hover:scale-105'}
                                                    `}>
                                                        {/* Icon glow effect when active - tightly contained with minimal blur */}
                                                        {isActive && (
                                                            <div className="absolute inset-0 bg-primary/20 blur-[2px] rounded-full scale-75" />
                                                        )}

                                                        {/* Icon */}
                                                        <IconComponent
                                                            size={22}
                                                            className={`
                                                                transition-all duration-200 relative z-10
                                                                ${isActive
                                                                    ? 'text-primary'
                                                                    : 'text-text-muted group-hover:text-white'
                                                                }
                                                            `}
                                                            strokeWidth={isActive ? 2.5 : 2}
                                                        />
                                                    </div>

                                                    {/* Label */}
                                                    <span className={`
                                                        text-[10px] font-medium tracking-tight transition-all duration-200
                                                        ${isActive
                                                            ? 'text-primary opacity-100'
                                                            : 'text-text-muted opacity-70 group-hover:opacity-100 group-hover:text-white'
                                                        }
                                                    `}>
                                                        {item.label}
                                                    </span>
                                                </div>
                                            );
                                        }}
                                    </NavLink>
                                );
                            })}

                            {/* Hamburger Menu Button (Members only) */}
                            {hasMoreMenu && (
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="flex-1 h-full transition-all duration-200 relative group"
                                >
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-10">
                                        {/* Icon Container with contained effects */}
                                        <div className={`
                                            relative flex items-center justify-center w-9 h-9
                                            transition-all duration-200 overflow-hidden rounded-full
                                            ${showMenu ? 'scale-110' : 'scale-100 group-hover:scale-105'}
                                        `}>
                                            {/* Glow effect when menu is open - tightly contained with minimal blur */}
                                            {showMenu && (
                                                <div className="absolute inset-0 bg-primary/20 blur-[2px] rounded-full scale-75" />
                                            )}

                                            <Menu
                                                size={22}
                                                className={`
                                                    transition-all duration-200 relative z-10
                                                    ${showMenu
                                                        ? 'text-primary'
                                                        : 'text-text-muted group-hover:text-white'
                                                    }
                                                `}
                                                strokeWidth={showMenu ? 2.5 : 2}
                                            />
                                            {unreadCount > 0 && (
                                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary border-2 border-surface rounded-full z-20 animate-pulse" />
                                            )}
                                        </div>

                                        <span className={`
                                            text-[10px] font-medium tracking-tight transition-all duration-200
                                            ${showMenu
                                                ? 'text-primary opacity-100'
                                                : 'text-text-muted opacity-70 group-hover:opacity-100 group-hover:text-white'
                                            }
                                        `}>
                                            More
                                        </span>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <style>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }

                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </>
    );
}

