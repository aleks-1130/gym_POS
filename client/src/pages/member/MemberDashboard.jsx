import React from 'react';

const MemberDashboard = ({ stats, user }) => {
    // stats.memberData contains the full member record including plan
    const member = stats?.memberData || {};
    const planName = member.plan?.name || "No Active Plan";
    const expiryDate = member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : "N/A";
    const isExpired = member.expiryDate && new Date(member.expiryDate) < new Date();

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Member specific cards */}
                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
                    <p className="text-text-muted text-sm font-medium mb-1">Current Plan</p>
                    <h3 className="text-2xl font-bold text-white">{planName}</h3>
                    <p className={`text-sm mt-2 font-medium ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isExpired ? 'Expired' : 'Active'}
                    </p>
                </div>

                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-text-muted text-sm font-medium mb-1">Expires On</p>
                            <h3 className="text-2xl font-bold text-white">{expiryDate}</h3>
                        </div>
                        <span className="material-icons-round text-primary bg-primary/10 p-2 rounded-xl">event</span>
                    </div>
                    {isExpired && (
                        <button className="mt-4 w-full py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-colors">
                            Renew Now
                        </button>
                    )}
                </div>

                <div className="bg-surface p-6 rounded-3xl border border-white/5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-text-muted text-sm font-medium mb-1">Loyalty Points</p>
                            <h3 className="text-2xl font-bold text-white">{member.points || 0} pts</h3>
                        </div>
                        <span className="material-icons-round text-yellow-500 bg-yellow-500/10 p-2 rounded-xl">star</span>
                    </div>
                    <p className="text-xs text-text-muted mt-2">Redeem for rewards</p>
                </div>
            </div>

            {/* Member Quick Actions / Info */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-surface p-8 rounded-3xl border border-white/5 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                        <span className="material-icons-round text-3xl">qr_code_2</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Digital Member Pass</h3>
                    <p className="text-text-muted text-sm mb-6">Scan this code at the front desk to check in.</p>
                    <div className="bg-white p-4 rounded-xl inline-block">
                        {/* Placeholder QR */}
                        <div className="w-32 h-32 bg-black opacity-10 flex items-center justify-center text-xs">QR Code</div>
                    </div>
                </div>

                <div className="bg-surface p-6 rounded-3xl border border-white/5 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-white mb-4">Messages</h3>
                    <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 mb-4">
                        <div className="flex gap-3">
                            <span className="material-icons-round text-primary">campaign</span>
                            <div>
                                <h4 className="font-bold text-primary text-sm">Welcome to FitOS!</h4>
                                <p className="text-xs text-white/80 mt-1">We are glad to have you. Check out our latest classes.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberDashboard;
