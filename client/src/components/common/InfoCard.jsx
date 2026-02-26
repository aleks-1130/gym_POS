import React from 'react';

/**
 * Reusable InfoCard component for displaying information sections
 * @param {string} title - Card title
 * @param {string} icon - Material icon name
 * @param {React.ReactNode} children - Card content
 * @param {React.ReactNode} headerAction - Optional action element in header
 */
export default function InfoCard({ title, icon, children, headerAction }) {
    return (
        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    {icon && <span className="material-icons-round text-primary">{icon}</span>}
                    {title}
                </h3>
                {headerAction}
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}
