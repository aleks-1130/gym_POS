import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { queryClient } from '../config/queryClient';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIsDismissed(false); // Reset dismissal when back online
      
      // 1. Resume any paused offline mutations (standard React Query behavior)
      queryClient.resumePausedMutations().then(() => {
        console.log('Offline Sync: Resumed all paused mutations.');
      });

      // 2. Explicitly retry any mutations that actually FAILED (error status)
      // This ensures "SYNC FAILED" items get a second chance automatically
      const mutationCache = queryClient.getMutationCache();
      const failedMutations = mutationCache.getAll().filter(m => m.state.status === 'error');
      
      if (failedMutations.length > 0) {
        console.log(`Offline Sync: Auto-retrying ${failedMutations.length} failed mutations...`);
        failedMutations.forEach(mutation => {
          mutation.continue().catch(err => console.error('Auto-retry failed:', err));
        });
      }
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Smart Auto-Update Logic: We rely on registerType: 'autoUpdate' in vite.config.js.
  // The service worker will update automatically when a new version is detected.
  // We don't need a manual reload loop here.

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
    setIsDismissed(true);
  };

  // If nothing to show or if the user manually dismissed the offline warning, return null
  if (!offlineReady && !needRefresh && (!isOffline || isDismissed)) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-fade-in-up">
      <div className="bg-surface/90 backdrop-blur-md border border-primary/30 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-sm">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <p className="text-white font-semibold">
              {isOffline ? "Offline Mode Active" : offlineReady ? "PWA: Ready for Offline" : "Update Detected"}
            </p>
          </div>
          <button onClick={close} className="text-text-muted hover:text-white material-icons-round text-sm">
            close
          </button>
        </div>
        
        <p className="text-sm text-text-secondary leading-relaxed">
          {isOffline 
            ? "Network lost. You can continue with sales; data will sync automatically when back online."
            : offlineReady
            ? "The Gym POS is now optimized for offline use. You can load it without internet."
            : "A newer, faster version is being prepared for the background."}
        </p>

        {needRefresh && !sessionStorage.getItem('pwa-auto-reloaded') && (
          <button 
            onClick={() => updateServiceWorker(true)}
            className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-2 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <span className="material-icons-round text-sm">refresh</span>
            Update Now
          </button>
        )}
      </div>
    </div>
  );
}

export default ReloadPrompt;
