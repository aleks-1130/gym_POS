import React from 'react';
import { createPortal } from 'react-dom';

const ConfirmDialog = ({ isOpen, title, message, confirmLabel, cancelLabel, type, onConfirm, onCancel, onClose }) => {
    if (!isOpen) return null;

    const getTypeStyles = () => {
        switch (type) {
            case 'danger':
                return {
                    icon: 'report_problem',
                    iconBg: 'bg-red-100 text-red-600',
                    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                };
            case 'success':
                return {
                    icon: 'check_circle',
                    iconBg: 'bg-green-100 text-green-600',
                    button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                };
            case 'warning':
                return {
                    icon: 'warning',
                    iconBg: 'bg-amber-100 text-amber-600',
                    button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                };
            default:
                return {
                    icon: 'info',
                    iconBg: 'bg-blue-100 text-blue-600',
                    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                };
        }
    };

    const styles = getTypeStyles();

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onCancel || onClose}
            ></div>

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${styles.iconBg}`}>
                        <span className="material-icons-round text-3xl">{styles.icon}</span>
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row-reverse gap-2 w-full">
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`w-full inline-flex justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${styles.button}`}
                        >
                            {confirmLabel}
                        </button>
                        {cancelLabel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full inline-flex justify-center rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors"
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
