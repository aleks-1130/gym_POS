import { create } from 'zustand';

const useCartStore = create((set, get) => ({
    cart: [],
    // selectedMemberId: null, // REVERTED

    // Actions
    addToCart: (item, type = 'PRODUCT') => {
        set((state) => {
            const existing = state.cart.find(p => p.id === item.id && p.type === type);

            // Stock Check for Products
            if (type === 'PRODUCT') {
                const currentQty = existing ? existing.quantity : 0;
                // Assuming item.stock is available. If not, we skip check.
                if (item.stock !== undefined && (currentQty + 1) > item.stock) {
                    return { cart: state.cart };
                }
            }

            if (existing) {
                return {
                    cart: state.cart.map(p =>
                        p.id === item.id && p.type === type
                            ? { ...p, quantity: p.quantity + 1 }
                            : p
                    )
                };
            }

            // Training Session Logic
            if (type === 'TRAINING') {
                const durations = (item.sessionDurations || '60')
                    .split(',')
                    .map((d) => Number(String(d).trim()))
                    .filter((d) => Number.isFinite(d) && d > 0);

                const newItem = {
                    id: item.id, // This is the Trainer ID
                    name: item.name,
                    price: item.sessionPrice ?? item.price ?? 0,
                    type: 'TRAINING',
                    quantity: 1,
                    trainerId: item.id,
                    date: '',
                    time: '',
                    duration: durations[0] || 60,
                    notes: '',
                    originalItem: item
                };
                return { cart: [...state.cart, newItem] };
            }

            return { cart: [...state.cart, { ...item, type, quantity: 1 }] };
        });
    },

    removeFromCart: (itemId) => {
        set((state) => ({
            cart: state.cart.filter(item => item.id !== itemId)
        }));
    },

    updateQuantity: (itemId, type, quantity) => {
        set((state) => {
            if (quantity <= 0) {
                return { cart: state.cart.filter(i => !(i.id === itemId && i.type === type)) };
            }
            return {
                cart: state.cart.map(i =>
                    (i.id === itemId && i.type === type) ? { ...i, quantity } : i
                )
            };
        });
    },

    updateTrainingDetails: (trainerId, field, value) => {
        set((state) => ({
            cart: state.cart.map(item =>
                (item.type === 'TRAINING' && item.trainerId === trainerId)
                    ? { ...item, [field]: value }
                    : item
            )
        }));
    },

    // setMember: (memberId) => set({ selectedMemberId: memberId }), // REVERTED

    clearCart: () => set({ cart: [] }),

    // Computed Wrappers
    getCartTotal: () => {
        const state = get();
        return state.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    },

    getCartCount: () => {
        const state = get();
        return state.cart.reduce((acc, item) => acc + item.quantity, 0);
    }
}));

export default useCartStore;
