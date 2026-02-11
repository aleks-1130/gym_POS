import React from 'react';
import { usePWA } from '../hooks/usePWA';

export default function PWAInstallPrompt({ isAuthenticated }) {
    const { isInstallable, isInstalled, isDismissed, installApp, dismissInstallPrompt } = usePWA();
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');

    if (!isAuthenticated || isInstalled || isDismissed) {
        return null;
    }

    return (
        <div className="fixed left-4 right-4 bottom-24 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[380px] z-[60]">
            <div className="bg-surface/95 backdrop-blur-md border border-primary/30 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                    <span className="material-icons-round text-primary text-2xl mt-0.5">download</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">Install FitOS App</p>
                        <p className="text-text-muted text-xs mt-1">
                            {isInstallable
                                ? 'Get quick access from your home screen.'
                                : isIOS
                                    ? 'On iPhone/iPad, tap Share then Add to Home Screen.'
                                    : 'Use your browser menu and choose Install App.'}
                        </p>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={dismissInstallPrompt}
                        className="px-3 py-2 rounded-lg bg-white/5 text-text-muted hover:text-white text-xs font-semibold"
                    >
                        Later
                    </button>
                    {isInstallable ? (
                        <button
                            type="button"
                            onClick={installApp}
                            className="px-3 py-2 rounded-lg bg-primary text-background text-xs font-bold hover:brightness-110"
                        >
                            Install
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
