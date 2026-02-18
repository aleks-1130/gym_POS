import { useCallback, useEffect, useMemo, useState } from 'react';

const getFullscreenElement = () =>
    document.fullscreenElement || document.webkitFullscreenElement || null;

const isInstalledAppContext = () => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const fullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const minimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
    const iosStandalone = window.navigator.standalone === true;
    const androidTwa = document.referrer?.startsWith('android-app://');
    return Boolean(standalone || fullscreen || minimalUi || iosStandalone || androidTwa);
};

const requestFullscreenCompat = async () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
        return el.requestFullscreen({ navigationUI: 'hide' });
    }
    if (el.webkitRequestFullscreen) {
        return el.webkitRequestFullscreen();
    }
    throw new Error('Fullscreen API not supported');
};

export default function FullscreenController({ enabled = true }) {
    const [isFullscreen, setIsFullscreen] = useState(Boolean(getFullscreenElement()));
    const [isInstalledMode, setIsInstalledMode] = useState(() => isInstalledAppContext());
    const supportsFullscreen = useMemo(() => {
        const el = document.documentElement;
        return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
    }, []);

    const syncFullscreenState = useCallback(() => {
        setIsFullscreen(Boolean(getFullscreenElement()));
    }, []);

    const enterFullscreen = useCallback(async () => {
        if (!enabled || !supportsFullscreen || getFullscreenElement()) return;
        try {
            await requestFullscreenCompat();
            syncFullscreenState();
        } catch {
            // Browser may block fullscreen for some contexts.
        }
    }, [enabled, supportsFullscreen, syncFullscreenState]);

    useEffect(() => {
        if (!enabled || !supportsFullscreen) return;
        const handler = () => syncFullscreenState();
        document.addEventListener('fullscreenchange', handler);
        document.addEventListener('webkitfullscreenchange', handler);
        return () => {
            document.removeEventListener('fullscreenchange', handler);
            document.removeEventListener('webkitfullscreenchange', handler);
        };
    }, [enabled, supportsFullscreen, syncFullscreenState]);

    useEffect(() => {
        const syncInstalledMode = () => setIsInstalledMode(isInstalledAppContext());
        const displayModeQuery = window.matchMedia('(display-mode: standalone)');

        syncInstalledMode();
        window.addEventListener('appinstalled', syncInstalledMode);
        window.addEventListener('focus', syncInstalledMode);
        document.addEventListener('visibilitychange', syncInstalledMode);
        if (displayModeQuery.addEventListener) {
            displayModeQuery.addEventListener('change', syncInstalledMode);
        } else if (displayModeQuery.addListener) {
            displayModeQuery.addListener(syncInstalledMode);
        }

        return () => {
            window.removeEventListener('appinstalled', syncInstalledMode);
            window.removeEventListener('focus', syncInstalledMode);
            document.removeEventListener('visibilitychange', syncInstalledMode);
            if (displayModeQuery.removeEventListener) {
                displayModeQuery.removeEventListener('change', syncInstalledMode);
            } else if (displayModeQuery.removeListener) {
                displayModeQuery.removeListener(syncInstalledMode);
            }
        };
    }, []);

    // Installed app should not show fullscreen prompt/button.
    if (!enabled || isInstalledMode || !supportsFullscreen || isFullscreen) return null;

    return (
        <button
            type="button"
            onClick={enterFullscreen}
            className="fixed bottom-5 right-5 z-[70] px-4 py-2.5 rounded-xl bg-primary text-background font-bold shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95"
        >
            Enter Fullscreen
        </button>
    );
}
