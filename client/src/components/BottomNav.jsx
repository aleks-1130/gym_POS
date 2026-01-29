import React from 'react';
import { NavLink } from 'react-router-dom';

export default function BottomNav() {
    const navItems = [
        { to: "/", icon: "home", label: "Home" },
        { to: "/schedule", icon: "calendar_today", label: "Schedule" },
        { to: "/shop", icon: "shopping_bag", label: "Shop" },
        { to: "/profile", icon: "person", label: "Profile" },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 px-6 py-3 flex justify-between items-center z-50 md:hidden">
            {navItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${isActive ? 'text-primary' : 'text-text-muted hover:text-white'
                        }`
                    }
                >
                    <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                    <span>{item.label}</span>
                </NavLink>
            ))}
        </div>
    );
}
