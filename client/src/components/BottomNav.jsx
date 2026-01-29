import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, ShoppingBag, Gift, User, Users, Dumbbell, CheckCircle, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';

export default function BottomNav() {
    const { user } = useAuth();
    const location = useLocation();
    const [activeIndex, setActiveIndex] = useState(0);

    const memberNavItems = [
        { to: "/attendance", icon: CheckCircle, label: "Attendance" },
        { to: "/profile", icon: User, label: "Profile" },
        { to: "/schedule", icon: Calendar, label: "Schedule" },
        { to: "/", icon: Home, label: "Home" },
        { to: "/shop", icon: ShoppingBag, label: "Shop" },
        { to: "/loyalty", icon: Gift, label: "Rewards" },
        { to: "/purchase-history", icon: History, label: "History" },
    ];

    const staffNavItems = [
        { to: "/members", icon: Users, label: "Members" },
        { to: "/classes", icon: Dumbbell, label: "Classes" },
        { to: "/", icon: Home, label: "Home" },
        { to: "/schedule", icon: Calendar, label: "Schedule" },
        { to: "/profile", icon: User, label: "Profile" },
    ];

    const navItems = user?.role === ROLES.MEMBER ? memberNavItems : staffNavItems;
    const isMember = user?.role === ROLES.MEMBER;

    // Update active index based on current location
    useEffect(() => {
        const currentIndex = navItems.findIndex(item => item.to === location.pathname);
        if (currentIndex !== -1) {
            setActiveIndex(currentIndex);
        }
    }, [location.pathname, navItems]);

    return (
        <nav className={`fixed bottom-0 left-0 right-0 bg-background z-40 ${!isMember && 'lg:hidden'}`}>
            <div className="relative max-w-full">
                {/* Background bar */}
                <div className="relative h-20 bg-surface">
                    {/* Floating circle with active icon */}
                    <div 
                        className="absolute -top-6 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/50 transition-all duration-500 ease-out flex items-center justify-center z-20"
                        style={{
                            left: `calc(${activeIndex * (100 / navItems.length)}% + 8px)`,
                        }}
                    >
                        {React.createElement(navItems[activeIndex].icon, {
                            size: 24,
                            className: "text-white",
                            strokeWidth: 2.5
                        })}
                    </div>

                    {/* Navigation Items */}
                    <div className="absolute inset-0 flex items-center justify-around px-2">
                        {navItems.map((item, index) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={`flex flex-col items-center justify-center w-14 h-20 transition-all duration-300 relative group bg-transparent`}
                                title={item.label}
                            >
                                {({ isActive }) => {
                                    const IconComponent = item.icon;
                                    return (
                                        <>
                                            {/* Icon - hidden when active (shown in floating circle) */}
                                            <IconComponent
                                                size={24}
                                                className={`transition-all duration-300 ${
                                                    isActive 
                                                        ? 'opacity-0 scale-0' 
                                                        : 'opacity-100 scale-100 text-text-muted group-hover:text-white'
                                                }`}
                                                strokeWidth={2}
                                            />
                                        </>
                                    );
                                }}
                            </NavLink>
                        ))}
                    </div>
                </div>

                {/* Border separator */}
                <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>
        </nav>
    );
}
