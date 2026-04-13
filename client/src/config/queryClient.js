import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 24 * 60 * 60 * 1000, // 24 hours (formerly cacheTime)
            refetchOnWindowFocus: true,
            retry: 1,
            networkMode: 'offlineFirst',
        },
        mutations: {
            networkMode: 'offlineFirst',
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
        }
    },
});

// Use IndexedDB to securely hold larger data limits and allow async queues
export const persister = createAsyncStoragePersister({
    storage: {
        getItem: async (key) => await get(key),
        setItem: async (key, value) => await set(key, value),
        removeItem: async (key) => await del(key),
    },
});
