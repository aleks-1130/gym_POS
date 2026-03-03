import { create } from 'zustand';

/**
 * usePOSStore - Centralized state for the POS system.
 * Handles Cart, Filters, and Modal states to prevent React Context "lag".
 */
export const usePOSStore = create((set, get) => ({
    // --- CART STATE ---
    cart: [],
    discount: 0, // Percentage
    selectedMemberId: '',

    // --- FILTER STATE ---
    selectedCategory: 'All',
    searchQuery: '',

    // --- MODAL STATE ---
    modals: {
        payment: false,
        receiptPreview: false,
        collectCash: false,
        collectPurchase: false,
        trainerChange: false,
    },

    // --- MODAL DATA ---
    paymentDetails: {
        amountTendered: '',
        method: '',
        gcashReference: '',
        gcashDate: '',
        gcashTime: '',
    },
    lastTransaction: null,
    collectData: {
        session: null,
        purchase: null,
        tendered: '',
    },
    trainerChangeData: {
        session: null,
        resolution: { action: 'MOVE', date: '', time: '', note: '' },
    },

    // --- ACTIONS ---

    // Cart Actions
    addToCart: (item, type = 'PRODUCT') => {
        const state = get();
        const existing = state.cart.find(p => p.id === item.id && p.type === type);

        // Stock Check for Products
        if (type === 'PRODUCT') {
            const currentQty = existing ? existing.quantity : 0;
            if (item.stock !== undefined && (currentQty + 1) > item.stock) {
                return { success: false, error: `Not enough stock! Only ${item.stock} left.` };
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
            cartLineId: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        };
        set({ cart: [...state.cart, newItem] });
        return { success: true };
    },

    removeFromCart: (cartLineId) => {
        set((state) => ({
            cart: state.cart.filter(item => item.cartLineId !== cartLineId)
        }));
    },

    updateQuantity: (cartLineId, quantity, stockLimit) => {
        if (quantity < 1) return { success: false, error: null };
        if (stockLimit && quantity > stockLimit) {
            return { success: false, error: `Cannot exceed available stock (${stockLimit})` };
        }
        set((state) => ({
            cart: state.cart.map(item =>
                item.cartLineId === cartLineId ? { ...item, quantity } : item
            )
        }));
        return { success: true };
    },

    clearCart: () => set({ cart: [], discount: 0, selectedMemberId: '' }),

    // Member Selection
    setSelectedMemberId: (id) => set({ selectedMemberId: id }),

    // Discount Action
    setDiscount: (discount) => set({ discount: Number(discount) || 0 }),

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

    // Modal Actions
    openModal: (modalName, data = null) => set((state) => {
        const newState = { modals: { ...state.modals, [modalName]: true } };

        // Map data to specific store fields if provided
        if (modalName === 'payment') newState.paymentDetails = { ...state.paymentDetails, amountTendered: '', method: '' };
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
        const { cart, discount } = get();
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const discountAmount = subtotal * (discount / 100);
        return {
            subtotal,
            discountAmount,
            total: subtotal - discountAmount
        };
    }
}));
