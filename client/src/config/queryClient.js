import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 24 * 60 * 60 * 1000, // 24 hours (formerly cacheTime)
            refetchOnWindowFocus: true,
            retry: 1,
        },
    },
});

// For larger storage in offline mode we could use IndexedDB (via idb-keyval), 
// but localStorage works perfectly for initial high-speed config caching.
export const persister = createSyncStoragePersister({
    storage: window.localStorage,
});
