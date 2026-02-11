import React from 'react';

/**
 * Reusable StatCard component for displaying metrics
 * @param {string} icon - Material icon name
 * @param {string} label - Label text for the stat
 * @param {string|number} value - The stat value to display
 * @param {string} iconColor - Tailwind color class for the icon (e.g., 'amber-500')
 */
export default function StatCard({ icon, label, value, iconColor = 'primary' }) {
    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
                <span className={`material-icons-round text-${iconColor} text-xl`}>{icon}</span>
                <p className="text-text-muted text-xs font-bold uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-3xl font-extrabold text-white">{value}</p>
        </div>
    );
}
