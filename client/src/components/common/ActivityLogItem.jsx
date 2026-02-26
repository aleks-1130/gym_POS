import React from 'react';

/**
 * Reusable ActivityLogItem component for displaying access log entries
 * @param {Object} log - Log object with status, checkIn, etc.
 */
export default function ActivityLogItem({ log }) {
    const isAllowed = log.status === 'ALLOWED';

    return (
        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/20 transition-all group">
            <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAllowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    <span className="material-icons-round text-lg">
                        {isAllowed ? 'check_circle' : 'cancel'}
                    </span>
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">
                    {isAllowed ? 'Successful Check-in' : 'Access Denied'}
                </p>
                <p className="text-text-muted text-xs mt-0.5">
                    {new Date(log.checkIn).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </p>
            </div>
            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${isAllowed
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                {log.status}
            </span>
        </div>
    );
}
