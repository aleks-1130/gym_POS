import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
    const [config, setConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        type: 'info', // info, danger, success, warning
        onConfirm: () => { },
        onCancel: () => { }
    });

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            setConfig({
                isOpen: true,
                title: options.title || 'Are you sure?',
                message: options.message || '',
                confirmLabel: options.confirmLabel || 'Confirm',
                cancelLabel: options.cancelLabel || 'Cancel',
                type: options.type || 'info',
                onConfirm: () => {
                    setConfig(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setConfig(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                }
            });
        });
    }, []);

    const alert = useCallback((options) => {
        return new Promise((resolve) => {
            setConfig({
                isOpen: true,
                title: options.title || 'Notice',
                message: options.message || '',
                confirmLabel: options.confirmLabel || 'OK',
                cancelLabel: null, // No cancel button for alert
                type: options.type || 'info',
                onConfirm: () => {
                    setConfig(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                }
            });
        });
    }, []);

    return (
        <ConfirmContext.Provider value={{ confirm, alert }}>
            {children}
            <ConfirmDialog
                {...config}
                onClose={() => setConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};
