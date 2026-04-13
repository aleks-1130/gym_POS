import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { withApiBase } from '../config/api';

export function usePaymentData(paymentId) {
    return useQuery({
        queryKey: ['payments', paymentId],
        queryFn: async () => {
            if (!paymentId) return null;
            const res = await axios.get(withApiBase(`/api/payments/${paymentId}`));
            return res.data;
        },
        enabled: Boolean(paymentId) && !String(paymentId).startsWith('pending-'),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
        networkMode: 'offlineFirst'
    });
}

export function useReceiptSettings() {
    return useQuery({
        queryKey: ['receipt-settings'],
        queryFn: async () => {
            const res = await axios.get(withApiBase('/api/payments/receipt-settings'));
            return res.data || null;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        networkMode: 'offlineFirst'
    });
}
