import React from 'react';

const RecentActivityWidget = ({ activity }) => {
    return (
        <div className="bg-surface border border-white/5 rounded-2xl p-6 h-full min-h-[160px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <span className="material-icons-round text-lg">history</span>
                </div>
                <h3 className="text-lg font-bold text-white">Recent Activity</h3>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[200px] space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {activity?.length > 0 ? (
                    activity.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <div>
                                <p className="text-white font-medium">{item.action}</p>
                                <p className="text-xs text-text-muted">{item.user} • {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ml-2 ${item.type === 'PAYMENT' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                {item.type}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="text-text-muted text-sm">No recent activity</p>
                )}
            </div>
        </div>
    );
};

export default RecentActivityWidget;
