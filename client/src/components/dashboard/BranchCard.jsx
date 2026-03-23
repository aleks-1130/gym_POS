import React from 'react';
import { useNavigate } from 'react-router-dom';

const BranchCard = ({ branch, onSelect, isActive }) => {
    const { name, companyId, currency, taxRate } = branch;
    const navigate = useNavigate();

    return (
        <div className={`relative bg-[#1a1d23] border-2 rounded-[2rem] p-8 flex flex-col transition-all group ${
            isActive ? 'border-primary shadow-[0_0_20px_rgba(255,140,0,0.1)]' : 'border-white/5 hover:border-white/10'
        }`}>
            {/* Header with Icon and Label */}
            <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <span className="material-icons-round text-2xl">apartment</span>
                </div>
                
                {isActive ? (
                    <span className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                        Active
                    </span>
                ) : (
                    <div 
                        onClick={async (e) => {
                            e.stopPropagation();
                            await onSelect(branch.id);
                            navigate('/branches');
                        }}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
                        title="Manage Branch Settings"
                    >
                        <span className="material-icons-round text-sm">settings</span>
                    </div>
                )}
            </div>

            {/* Branch Info */}
            <h3 className="text-2xl font-black text-white mb-1">{name}</h3>
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-8">
                ID: <span className="font-mono">{companyId}</span>
            </p>

            {/* Footer with Details and Action */}
            <div className="mt-auto flex justify-between items-end border-t border-white/5 pt-6">
                <div className="flex gap-6">
                    <div>
                        <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter mb-1">Currency</p>
                        <p className="text-white font-black text-sm">{currency}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter mb-1">Tax</p>
                        <p className="text-white font-black text-sm">{taxRate}%</p>
                    </div>
                </div>

                {!isActive && (
                    <button
                        onClick={() => onSelect(branch.id)}
                        className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase px-6 py-2.5 rounded-xl transition-all border border-white/5 hover:border-white/10"
                    >
                        Switch to Branch
                    </button>
                )}
            </div>
        </div>
    );
};

export default BranchCard;
