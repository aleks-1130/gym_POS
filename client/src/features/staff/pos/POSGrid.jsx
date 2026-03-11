import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { POS_VIEWS } from '../../../constants/categories';
import { usePOSStore } from '../../../stores/usePOSStore';
import { useCurrency } from '../../../context/CurrencyContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { getItemImageSrc } from './POSUtils';

/**
 * POSGrid Component - Handles catalog browsing, search, and adding items to cart.
 */
export default function POSGrid({ products, plans, trainers, classPackages }) {
    const { formatPrice } = useCurrency();
    const { alert: showAlert } = useConfirm();

    // Zustand Store
    const {
        selectedCategory, setCategory, addToCart
    } = usePOSStore(useShallow(state => ({
        selectedCategory: state.selectedCategory,
        setCategory: state.setCategory,
        addToCart: state.addToCart
    })));

    // Local UI State
    const [catalogView, setCatalogView] = useState('GRID');
    const [productSearch, setProductSearch] = useState('');
    const [barcodeQuantityModal, setBarcodeQuantityModal] = useState({ open: false, item: null, quantity: '1' });

    // Filtering Logic
    const filteredProducts = selectedCategory === 'All'
        ? products
        : products.filter((product) => product.category === selectedCategory);

    const displayItems = selectedCategory === POS_VIEWS.MEMBERSHIP
        ? plans
        : selectedCategory === POS_VIEWS.TRAINERS
            ? trainers
            : selectedCategory === POS_VIEWS.PACKAGES
                ? classPackages
                : filteredProducts;

    const safeDisplayItems = Array.isArray(displayItems) ? displayItems : [];
    const catalogQuery = String(productSearch || '').trim().toLowerCase();

    const searchedDisplayItems = safeDisplayItems.filter((item) => {
        if (!catalogQuery) return true;
        const searchFields = [
            item?.name, item?.description, item?.category,
            item?.barcode, item?.sku, item?.code, item?.type
        ];
        return searchFields.some((field) => String(field || '').toLowerCase().includes(catalogQuery));
    });

    const categoryTabs = ['All', ...Object.values(POS_VIEWS)];

    // Handlers
    const handleAddCatalogItem = async (item) => {
        const isTrainer = selectedCategory === POS_VIEWS.TRAINERS;
        const isPackage = selectedCategory === POS_VIEWS.PACKAGES;
        const isSoldOut = !isTrainer && !isPackage && selectedCategory !== POS_VIEWS.MEMBERSHIP && Number(item?.stock || 0) <= 0;

        if (isSoldOut) return;

        let result;
        if (isTrainer) {
            result = addToCart({
                ...item,
                trainerId: item.id,
                price: item.sessionPrice ?? 0,
                duration: Number(item.sessionDurations?.split(',')[0]?.trim()) || 60
            }, 'TRAINING');
        } else if (isPackage) {
            result = addToCart(item, 'CLASS_PACKAGE');
        } else {
            result = addToCart(item, selectedCategory === POS_VIEWS.MEMBERSHIP ? 'PLAN' : 'PRODUCT');
        }

        if (result && !result.success && result.error) {
            await showAlert({ title: 'Cannot Add Item', message: result.error, type: 'warning' });
        }
    };

    const confirmBarcodeQuantityAdd = () => {
        const qty = parseInt(barcodeQuantityModal.quantity) || 1;
        for (let i = 0; i < qty; i++) {
            handleAddCatalogItem(barcodeQuantityModal.item);
        }
        setBarcodeQuantityModal({ open: false, item: null, quantity: '1' });
        setProductSearch('');
    };

    return (
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {/* Search and Filters */}
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr),220px,auto]">
                <label className="relative block">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">search</span>
                    <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products by name, category, barcode, or SKU"
                        className="w-full rounded-xl border border-white/10 bg-surface px-10 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
                    />
                </label>
                <select
                    value={selectedCategory}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-surface px-3 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
                >
                    {categoryTabs.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <div className="inline-flex items-center rounded-xl border border-white/10 bg-surface p-1">
                    <button
                        onClick={() => setCatalogView('GRID')}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${catalogView === 'GRID' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                    >
                        <span className="material-icons-round text-sm">grid_view</span> Grid
                    </button>
                    <button
                        onClick={() => setCatalogView('LIST')}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${catalogView === 'LIST' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                    >
                        <span className="material-icons-round text-sm">view_list</span> List
                    </button>
                </div>
            </div>

            {/* Catalog Items */}
            <div className={catalogView === 'GRID'
                ? 'flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 auto-rows-max items-start content-start gap-4 overflow-y-auto pb-20 pr-2 scrollbar-hide'
                : 'flex-1 min-h-0 space-y-3 overflow-y-auto pb-20 pr-2 scrollbar-hide'}
            >
                {searchedDisplayItems.length === 0 && (
                    <div className="col-span-full text-center text-text-muted py-10">No items match your criteria.</div>
                )}
                {searchedDisplayItems.map((item) => {
                    const isTrainer = selectedCategory === 'TRAINERS';
                    const isPackage = selectedCategory === 'PACKAGES';
                    const isSoldOut = !isTrainer && !isPackage && selectedCategory !== 'MEMBERSHIP' && item.stock <= 0;
                    const addLabel = isSoldOut ? 'Sold Out' : 'Add';

                    if (catalogView === 'LIST') {
                        return (
                            <div key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface p-3 transition-colors ${isSoldOut ? 'border-red-500/20 opacity-70' : 'border-white/10 hover:border-primary/40'}`}>
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white/5">
                                        {getItemImageSrc(item) ? (
                                            <img src={getItemImageSrc(item)} alt={item.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                <span className="material-icons-round text-lg">inventory_2</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                                        <p className="truncate text-xs text-text-muted">{item.category || 'Item'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm font-bold text-primary">{formatPrice(isTrainer ? item.sessionPrice : item.price)}</p>
                                    <button
                                        onClick={() => handleAddCatalogItem(item)}
                                        disabled={isSoldOut}
                                        className="rounded-lg border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                                    >
                                        {addLabel}
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={item.id}
                            onClick={() => handleAddCatalogItem(item)}
                            className={`group self-start flex flex-col rounded-3xl border border-white/5 bg-surface p-3 transition-all duration-300 hover:border-primary/20 hover:bg-primary/5 active:scale-95 ${isSoldOut ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                        >
                            <div className="relative mb-3 aspect-square shrink-0 overflow-hidden rounded-2xl bg-white/5">
                                {getItemImageSrc(item) ? (
                                    <img src={getItemImageSrc(item)} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                                        <span className="material-icons-round text-4xl">inventory_2</span>
                                    </div>
                                )}
                                {isSoldOut && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">Sold Out</span>
                                    </div>
                                )}
                            </div>
                            <div className="px-1 pt-1 flex-1">
                                <h3 className="text-sm font-bold leading-tight text-white min-h-[2.25rem]">{item.name}</h3>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-primary font-bold">{formatPrice(isTrainer ? item.sessionPrice : item.price)}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Barcode Quantity Modal */}
            {barcodeQuantityModal.open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-5 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4">Add {barcodeQuantityModal.item?.name}</h3>
                        <label className="block mb-4">
                            <span className="text-xs text-text-muted font-semibold uppercase">Quantity</span>
                            <input
                                autoFocus
                                type="number"
                                min="1"
                                value={barcodeQuantityModal.quantity}
                                onChange={(e) => setBarcodeQuantityModal({ ...barcodeQuantityModal, quantity: e.target.value })}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-white outline-none focus:border-primary"
                            />
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => setBarcodeQuantityModal({ open: false, item: null, quantity: '1' })} className="flex-1 py-2.5 text-white bg-white/5 rounded-xl">Cancel</button>
                            <button onClick={confirmBarcodeQuantityAdd} className="flex-1 py-2.5 bg-primary text-background font-bold rounded-xl">Add to Cart</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
