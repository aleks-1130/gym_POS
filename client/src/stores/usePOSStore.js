import { create } from 'zustand';
import axios from 'axios';
import { withApiBase } from '../config/api';

const authHeaders = () => {
    
    return undefined;
};

/**
 * usePOSStore - Centralized state for the POS system.
 * Handles Cart, Filters, and Modal states to prevent React Context "lag".
 */
export const usePOSStore = create((set, get) => ({
    // --- CART STATE ---
    cart: [],
    discount: 0, // Percentage
    selectedMemberId: '',
    sessionId: null,
    appliedCoupon: null, // { code, type, value, discountAmount, discountPercent, label }

    // --- SESSION MGMT ---
    getSessionId: () => {
        let sid = get().sessionId;
        if (!sid) {
            sid = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            set({ sessionId: sid });
        }
        return sid;
    },

    // --- FILTER STATE ---
    selectedCategory: 'All',
    searchQuery: '',

    // --- MODAL STATE ---
    modals: {
        payment: false,
        receiptPreview: false,
        collectCash: false,
        collectPurchase: false,
        trainerChange: false },

    // --- MODAL DATA ---
    paymentDetails: {
        amountTendered: '',
        method: '',
        gcashReference: '',
        gcashDate: '',
        gcashTime: '',
        isSplit: false,
        collections: [] // Array of { method, amount, reference, date, time }
    },
    lastTransaction: null,
    collectData: {
        session: null,
        purchase: null,
        tendered: '' },
    trainerChangeData: {
        session: null,
        resolution: { action: 'MOVE', date: '', time: '', note: '' } },

    // --- ACTIONS ---

    // Cart Actions
    addToCart: async (item, type = 'PRODUCT') => {
        const state = get();
        const existing = state.cart.find(p => p.id === item.id && p.type === type);
        const sid = state.getSessionId();

        let newQty = 1;
        if (existing) {
             newQty = existing.quantity + 1;
        }

        // Stock Check for Products via API (allocates Redis memory)
        if (type === 'PRODUCT') {
             try {
                 await axios.post(withApiBase('/api/pos/reserve'), {
                     sessionId: sid,
                     productId: item.id,
                     quantity: newQty
                 }, { headers: authHeaders() });
             } catch (err) {
                 const currentQty = existing ? existing.quantity : 0;
                 if (item.availableStock !== undefined && (currentQty + 1) > item.availableStock) {
                     return { success: false, error: `Not enough stock! Only ${item.availableStock} left.` };
                 }
                 const msg = err.response?.data?.error || 'Failed to reserve stock';
                 return { success: false, error: msg };
             }
        }

        if (existing) {
            if (type === 'TRAINING' || type === 'PLAN') {
                return { success: false, error: `This ${type.toLowerCase()} is already in your cart.` };
            }
            set({
                cart: state.cart.map(p =>
                    (p.id === item.id && p.type === type)
                        ? { ...p, quantity: p.quantity + 1 }
                        : p
                )
            });
            return { success: true };
        }

        const newItem = {
            ...item,
            type,
            quantity: 1,
            productId: item.id,
            cartLineId: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        };
        set({ cart: [...state.cart, newItem] });
        return { success: true };
    },

    removeFromCart: async (cartLineId) => {
        const item = get().cart.find(i => i.cartLineId === cartLineId);
        if (item && item.type === 'PRODUCT') {
            try {
                await axios.delete(withApiBase(`/api/pos/reserve/${get().sessionId}/${item.productId}`), { headers: authHeaders() });
            } catch (e) {
                console.error('Failed to unreserve stock', e);
            }
        }
        set((state) => ({
            cart: state.cart.filter(item => item.cartLineId !== cartLineId)
        }));
    },

    updateQuantity: async (cartLineId, quantity, stockLimit) => {
        if (quantity < 1) return { success: false, error: null };
        const item = get().cart.find(i => i.cartLineId === cartLineId);
        
        if (item && item.type === 'PRODUCT') {
            try {
                await axios.post(withApiBase('/api/pos/reserve'), {
                    sessionId: get().sessionId,
                    productId: item.productId,
                    quantity
                }, { headers: authHeaders() });
            } catch (err) {
                 if (stockLimit && quantity > stockLimit) {
                     return { success: false, error: `Cannot exceed available stock (${stockLimit})` };
                 }
                return { success: false, error: err.response?.data?.error || 'Failed to reserve stock' };
            }
        }

        set((state) => ({
            cart: state.cart.map(item =>
                item.cartLineId === cartLineId ? { ...item, quantity } : item
            )
        }));
        return { success: true };
    },

    clearCart: async () => {
        const sid = get().sessionId;
        if (sid) {
            try {
                await axios.delete(withApiBase(`/api/pos/reserve/${sid}`), { headers: authHeaders() });
            } catch (e) {
                console.error('failed to clear cart reservations', e);
            }
        }
        set({ cart: [], discount: 0, selectedMemberId: '', sessionId: null, appliedCoupon: null });
    },

    // Member Selection
    setSelectedMemberId: (id) => set({ selectedMemberId: id }),

    // Discount Action
    setDiscount: (discount) => set({ discount: Number(discount) || 0 }),

    // Coupon Action
    setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),

    // Filter Actions
    setCategory: (category) => set({ selectedCategory: category }),
    setSearchQuery: (query) => set({ searchQuery: query }),

    updateTrainingDetails: (cartLineId, field, value) => {
        set((state) => ({
            cart: state.cart.map(item =>
                (item.cartLineId === cartLineId)
                    ? { ...item, [field]: value }
                    : item
            )
        }));
    },

    setSelectedBundleItems: (cartLineId, bucketIndex, selectedItems) => {
        set((state) => ({
            cart: state.cart.map(item =>
                (item.cartLineId === cartLineId)
                    ? { 
                        ...item, 
                        buckets: item.buckets.map((b, idx) => 
                            idx === bucketIndex ? { ...b, selectedItems } : b
                        )
                    }
                    : item
            )
        }));
    },

    // Modal Actions
    openModal: (modalName, data = null) => set((state) => {
        const newState = { modals: { ...state.modals, [modalName]: true } };

        // Map data to specific store fields if provided
        if (modalName === 'payment') {
            newState.paymentDetails = { 
                ...state.paymentDetails, 
                amountTendered: '', 
                method: '', 
                isSplit: false, 
                collections: [] 
            };
        }
        if (modalName === 'receiptPreview') newState.lastTransaction = data;
        if (modalName === 'collectCash') newState.collectData = { ...state.collectData, session: data, tendered: '' };
        if (modalName === 'collectPurchase') newState.collectData = { ...state.collectData, purchase: data, tendered: '' };
        if (modalName === 'trainerChange') newState.trainerChangeData = { ...state.trainerChangeData, session: data };

        return newState;
    }),

    closeModal: (modalName) => set((state) => ({
        modals: { ...state.modals, [modalName]: false }
    })),

    // Data Setters
    setPaymentField: (field, value) => set((state) => ({
        paymentDetails: { ...state.paymentDetails, [field]: value }
    })),
    
    setSplitPayment: (isSplit) => set((state) => ({
        paymentDetails: { ...state.paymentDetails, isSplit, collections: isSplit ? [] : state.paymentDetails.collections }
    })),

    addCollection: (method, amount) => set((state) => ({
        paymentDetails: {
            ...state.paymentDetails,
            collections: [
                ...state.paymentDetails.collections,
                { 
                    method, 
                    amount: Number(amount), 
                    reference: '', 
                    date: new Date().toISOString().split('T')[0], 
                    time: new Date().toTimeString().slice(0, 5) 
                }
            ]
        }
    })),

    removeCollection: (index) => set((state) => ({
        paymentDetails: {
            ...state.paymentDetails,
            collections: state.paymentDetails.collections.filter((_, i) => i !== index)
        }
    })),

    updateCollection: (index, field, value) => set((state) => ({
        paymentDetails: {
            ...state.paymentDetails,
            collections: state.paymentDetails.collections.map((c, i) => 
                i === index ? { ...c, [field]: value } : c
            )
        }
    })),

    setCollectField: (field, value) => set((state) => ({
        collectData: { ...state.collectData, [field]: value }
    })),

    setTrainerChangeField: (field, value) => set((state) => ({
        trainerChangeData: {
            ...state.trainerChangeData,
            resolution: { ...state.trainerChangeData.resolution, [field]: value }
        }
    })),

    // --- COMPUTED VALUES (using get()) ---
    getTotals: () => {
        const { cart, discount, appliedCoupon } = get();
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const discountAmount = subtotal * (discount / 100);
        const couponDiscount = appliedCoupon ? (appliedCoupon.discountAmount || 0) : 0;
        return {
            subtotal,
            discountAmount,
            couponDiscount,
            total: Math.max(0, subtotal - discountAmount - couponDiscount)
        };
    }
}));
