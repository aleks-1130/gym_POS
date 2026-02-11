import React from 'react';

/**
 * Reusable TabNavigation component
 * @param {Array} tabs - Array of tab objects with { id, label, icon }
 * @param {string} activeTab - Currently active tab id
 * @param {function} onTabChange - Tab change handler
 */
export default function TabNavigation({ tabs, activeTab, onTabChange }) {
    return (
        <div className="bg-surface rounded-2xl border border-white/5 p-2 flex gap-2">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === tab.id
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        {tab.icon && <span className="material-icons-round text-[18px]">{tab.icon}</span>}
                        {tab.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
