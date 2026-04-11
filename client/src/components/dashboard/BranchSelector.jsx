import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import BranchCard from './BranchCard';
import { useAuth } from '../../context/AuthContext';

const BranchSelector = ({ onSelect }) => {
    const { activeGymId } = useAuth();
    const { data: branches, isLoading, error } = useQuery({
        queryKey: ['admin-branches'],
        queryFn: async () => {
            const res = await axios.get('/api/admin/branches');
            return res.data;
        }
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-white">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        </div>
    );

    if (error) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
            <div className="flex justify-between items-center mb-8 sm:mb-10">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                        <span className="material-icons-round text-sm sm:text-base">explore</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Active Branches</h2>
                </div>
                <span className="bg-white/5 text-text-muted text-[9px] sm:text-[10px] font-black px-3 sm:px-4 py-1.5 rounded-full uppercase">
                    {branches?.length || 0} Total
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {branches?.map(branch => (
                    <BranchCard
                        key={branch.id}
                        branch={branch}
                        onSelect={onSelect}
                        isActive={String(branch.id) === String(activeGymId)}
                    />
                ))}
            </div>
        </div>
    );
};

export default BranchSelector;
