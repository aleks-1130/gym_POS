import React from 'react';
import { useNavigate } from 'react-router-dom';

const LowStockWidget = ({ count, items }) => {
    const navigate = useNavigate();

    return (
        <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col justify-between h-auto min-h-[160px]">
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <span className="material-icons-round text-lg">inventory_2</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">Inventory Alert</h3>
                </div>

                {items && items.length > 0 ? (
                    <div className="space-y-2 mb-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-white/80">{item.name}</span>
                                <span className="text-red-400 font-bold">{item.stock} left</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-text-muted text-sm mb-4">Stock levels are healthy.</p>
                )}
            </div>

            <div className="flex items-end justify-between border-t border-white/5 pt-4">
                <div>
                    <span className={`text-2xl font-bold ${count > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {count || 0}
                    </span>
                    <span className="text-text-muted ml-2 text-xs">total low</span>
                </div>

                <button
                    onClick={() => navigate('/inventory')}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                >
                    View Inventory
                </button>
            </div>
        </div>
    );
};

export default LowStockWidget;
