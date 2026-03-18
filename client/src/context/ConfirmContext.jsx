/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';

const ConfirmContext = createContext(null);
const VALID_TYPES = ['info', 'danger', 'success', 'warning'];

const normalizeOptions = (options) => {
    if (typeof options === 'string') {
        return { message: options };
    }
    if (!options || typeof options !== 'object') {
        return {};
    }
    return options;
};

const normalizeType = (rawType) => {
    const normalized = String(rawType || 'info').toLowerCase();
    return VALID_TYPES.includes(normalized) ? normalized : 'info';
};

const getDefaultAlertTitle = (type) => {
    if (type === 'success') return 'Success';
    if (type === 'danger') return 'Action Failed';
    if (type === 'warning') return 'Attention';
    return 'Notice';
};

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
        const parsed = normalizeOptions(options);
        const type = normalizeType(parsed.type);
        return new Promise((resolve) => {
            setConfig({
                isOpen: true,
                title: parsed.title || 'Please Confirm',
                message: parsed.message || '',
                confirmLabel: parsed.confirmLabel || 'Confirm',
                cancelLabel: parsed.cancelLabel || 'Cancel',
                type,
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
        const parsed = normalizeOptions(options);
        const type = normalizeType(parsed.type);
        return new Promise((resolve) => {
            setConfig({
                isOpen: true,
                title: parsed.title || getDefaultAlertTitle(type),
                message: parsed.message || '',
                confirmLabel: parsed.confirmLabel || 'OK',
                cancelLabel: null, // No cancel button for alert
                type,
                onConfirm: () => {
                    setConfig(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    // Support dismiss-by-backdrop/escape while still resolving the promise.
                    setConfig(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
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
