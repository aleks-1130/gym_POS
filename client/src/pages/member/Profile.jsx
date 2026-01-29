import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'react-qr-code';

export default function Profile() {
    const { user, logout } = useAuth();
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        // Fetch bookings/orders if needed
        // For now just basic info
    }, []);

    return (
        <div className="space-y-6 pb-20">
            <header className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">My Profile</h1>
                <button onClick={logout} className="text-red-400 font-bold text-sm">Sign Out</button>
            </header>

            {/* Digital Card */}
            <div className="bg-gradient-to-br from-primary to-orange-600 rounded-3xl p-8 text-background shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-start">
                    <div>
                        <div className="text-sm font-bold opacity-80 mb-1">MEMBER CARD</div>
                        <h2 className="text-3xl font-black uppercase tracking-wide">{user?.name || "Member"}</h2>
                        <div className="mt-8 font-mono opacity-90">ID: {user?.id?.toString().padStart(6, '0')}</div>
                    </div>
                    <div className="bg-white p-2 rounded-xl">
                        <QRCode value={`MEMBER:${user?.id}`} size={80} />
                    </div>
                </div>
                {/* Decorative circles */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
            </div>

            {/* Quick Stats or Settings */}
            <div className="bg-surface rounded-2xl p-6 border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Account Details</h3>
                <div className="space-y-4">
                    <div className="flex justify-between p-4 bg-white/5 rounded-xl">
                        <span className="text-text-muted">Email</span>
                        <span className="text-white">{user?.email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between p-4 bg-white/5 rounded-xl">
                        <span className="text-text-muted">Role</span>
                        <span className="text-primary font-bold">{user?.role}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
