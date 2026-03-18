import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const ConfirmDialog = ({ isOpen, title, message, confirmLabel, cancelLabel, type, onConfirm, onCancel, onClose }) => {
    const getTypeStyles = () => {
        switch (type) {
            case 'danger':
                return {
                    icon: 'report_problem',
                    iconBox: 'border-red-500/25 bg-red-500/10 text-red-300',
                    button: 'border-red-500/35 bg-red-500/15 text-red-200 hover:bg-red-500/25 focus:ring-red-500/50'
                };
            case 'success':
                return {
                    icon: 'check_circle',
                    iconBox: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
                    button: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 focus:ring-emerald-500/50'
                };
            case 'warning':
                return {
                    icon: 'warning',
                    iconBox: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
                    button: 'border-amber-500/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 focus:ring-amber-500/50'
                };
            default:
                return {
                    icon: 'info',
                    iconBox: 'border-primary/30 bg-primary/10 text-primary',
                    button: 'border-primary/35 bg-primary/15 text-primary hover:bg-primary/25 focus:ring-primary/50'
                };
        }
    };

    const styles = getTypeStyles();
    const handleDismiss = onCancel || onClose;

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && handleDismiss) {
                handleDismiss();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleDismiss, isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
                onClick={handleDismiss}
            ></div>

            {/* Modal */}
            <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-surface shadow-2xl p-6 transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 ${styles.iconBox}`}>
                        <span className="material-icons-round text-[28px]">{styles.icon}</span>
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-bold text-white mb-2">
                        {title}
                    </h3>
                    <p className="text-text-secondary text-sm mb-6 leading-relaxed whitespace-pre-line">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row-reverse gap-2 w-full">
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`w-full inline-flex justify-center rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 transition-colors ${styles.button}`}
                        >
                            {confirmLabel}
                        </button>
                        {cancelLabel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full inline-flex justify-center rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                {cancelLabel}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
