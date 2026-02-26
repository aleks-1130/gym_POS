import React from 'react';

/**
 * Reusable Modal component wrapper
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Close handler
 * @param {string} title - Modal title
 * @param {React.ReactNode} children - Modal content
 * @param {string} maxWidth - Max width class (default: 'max-w-sm')
 */
export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-sm' }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className={`bg-surface p-8 rounded-[32px] w-full ${maxWidth} border border-white/10 shadow-2xl`}>
                <h3 className="text-xl font-bold text-white mb-6">{title}</h3>
                {children}
            </div>
        </div>
    );
}
