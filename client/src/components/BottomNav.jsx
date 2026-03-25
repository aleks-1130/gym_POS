import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, User, Users, Dumbbell } from 'lucide-react';
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

    const renderNavIcon = (icon, { size = 22, className = '', strokeWidth = 2 } = {}) => {
        if (typeof icon === 'string') {
            return (
                <span
                    className={`material-icons-round leading-none ${className}`.trim()}
                    style={{ fontSize: `${size}px` }}
                >
                    {icon}
                </span>
            );
        }
        const IconComponent = icon;
        return <IconComponent size={size} className={className} strokeWidth={strokeWidth} />;
    };

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
    
    // Drag-to-scroll logic for horizontal navigation
    const scrollRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragMoved, setDragMoved] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setDragMoved(false);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !scrollRef.current) return;
        
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        
        // If moved more than 5px, mark as dragMoved to prevent accidental clicks
        if (Math.abs(x - startX) > 5) {
            setDragMoved(true);
        }

        e.preventDefault();
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleItemClick = (e) => {
        if (dragMoved) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    // Primary navigation items (bottom bar)
    const memberPrimaryNav = [
        { to: "/dashboard", icon: "dashboard", label: "Home" },
        { to: "/attendance", icon: "fact_check", label: "Attendance" },
        { to: "/trainer-booking", icon: "sports_gymnastics", label: "Trainers" },
        { to: "/gym-traffic", icon: "timeline", label: "Traffic" },
        { to: "/schedule", icon: "calendar_month", label: "Classes" },
        { to: "/shop", icon: "storefront", label: "Shop" },
        { to: "/profile", icon: "person", label: "Profile" },
    ];
    const trainerPrimaryNav = [
        { to: "/dashboard", icon: "dashboard", label: "Home" },
        { to: "/trainer/classes-sessions", icon: "calendar_month", label: "Class&Session" },
        { to: "/trainer/gym-traffic", icon: "timeline", label: "Traffic" },
        { to: "/trainer/shop", icon: "storefront", label: "Shop" },
        { to: "/trainer/profile", icon: "person", label: "Profile" },
    ];
    const trainerSecondaryNav = [
        { to: "/announcements", icon: "campaign", label: "Announcements" },
        { to: "/trainer/loyalty", icon: "card_giftcard", label: "Rewards" },
        { to: "/trainer/commission-history", icon: "payments", label: "Commissions" },
        { to: "/trainer/payment-methods", icon: "wallet", label: "Payment Methods" },
        { to: "/trainer/purchase-history", icon: "receipt_long", label: "Purchase History" },
    ];

    // Secondary navigation items (hamburger menu)
    const memberSecondaryNav = [
        { to: "/announcements", icon: "campaign", label: "Announcements" },
        { to: "/payment-methods", icon: "wallet", label: "Payment Methods" },
        { to: "/loyalty", icon: "card_giftcard", label: "Rewards & Loyalty" },
        { to: "/purchase-history", icon: "receipt_long", label: "Purchase History" },
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
                                <span className="material-icons-round text-primary text-[20px] leading-none">menu</span>
                                <h3 className="text-white font-semibold text-sm">More Options</h3>
                            </div>
                            <button
                                onClick={() => setShowMenu(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                            >
                                <span className="material-icons-round text-white/70 text-[18px] leading-none">close</span>
                            </button>
                        </div>

                        {/* Menu Items */}
                        <div className="p-2">
                            {secondaryNavItems.map((item) => {
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
                                        {renderNavIcon(item.icon, {
                                            size: 20,
                                            className: isActive ? 'text-primary' : 'text-text-muted',
                                            strokeWidth: 2
                                        })}
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
                    {/* Scrollable Container - allows horizontal scroll if items overflow */}
                    <div 
                        ref={scrollRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                        className={`
                            relative h-16 bg-surface/50 overflow-x-auto scrollbar-hide
                            select-none touch-pan-x
                            ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
                        `}
                    >
                        {/* 
                            Navigation Items Container 
                            - Use w-full and justify-center to look good on large screens 
                            - Use flex-nowrap to keep items in a row for scrolling
                        */}
                        <div className="flex items-center h-full w-full">
                            {primaryNavItems.map((item, index) => {
                                const isActive = activeIndex === index;

                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        onClick={handleItemClick}
                                        onDragStart={(e) => e.preventDefault()}
                                        className="flex-1 min-w-[90px] flex-shrink-0 h-full transition-all duration-200 relative group"
                                    >
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-10">
                                            {/* Icon Container with active effects */}
                                            <div className={`
                                                relative flex items-center justify-center w-9 h-9
                                                transition-all duration-200 overflow-hidden rounded-full
                                                ${isActive ? 'scale-110' : 'scale-100 group-hover:scale-105'}
                                            `}>
                                                {/* Icon glow effect when active */}
                                                {isActive && (
                                                    <div className="absolute inset-0 bg-primary/20 blur-[2px] rounded-full scale-75" />
                                                )}

                                                {/* Icon */}
                                                {renderNavIcon(item.icon, {
                                                    size: 22,
                                                    className: `
                                                        transition-all duration-200 relative z-10
                                                        ${isActive
                                                            ? 'text-primary'
                                                            : 'text-text-muted group-hover:text-white'
                                                        }
                                                    `,
                                                    strokeWidth: isActive ? 2.5 : 2
                                                })}
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

                                            {/* Local Active Indicator (Line) */}
                                            {isActive && (
                                                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-primary to-orange-500 rounded-full animate-fade-in" />
                                            )}
                                        </div>
                                    </NavLink>
                                );
                            })}

                            {/* Hamburger Menu Button */}
                            {hasMoreMenu && (
                                <button
                                    onClick={(e) => {
                                        if (dragMoved) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            return;
                                        }
                                        setShowMenu(!showMenu);
                                    }}
                                    onDragStart={(e) => e.preventDefault()}
                                    className="flex-1 min-w-[90px] flex-shrink-0 h-full transition-all duration-200 relative group"
                                >
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-10">
                                        <div className={`
                                            relative flex items-center justify-center w-9 h-9
                                            transition-all duration-200 overflow-hidden rounded-full
                                            ${showMenu ? 'scale-110' : 'scale-100 group-hover:scale-105'}
                                        `}>
                                            {showMenu && (
                                                <div className="absolute inset-0 bg-primary/20 blur-[2px] rounded-full scale-75" />
                                            )}

                                            <span
                                                className={`
                                                    material-icons-round leading-none
                                                    transition-all duration-200 relative z-10
                                                    ${showMenu
                                                        ? 'text-primary'
                                                        : 'text-text-muted group-hover:text-white'
                                                    }
                                                `}
                                                style={{ fontSize: '22px' }}
                                            >
                                                menu
                                            </span>
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

                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </>
    );
}

