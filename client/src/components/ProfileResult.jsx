import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ProfileResult() {
    const { logId } = useParams();
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLogDetails();
    }, [logId]);

    const fetchLogDetails = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/access/logs/${logId}`);
            setLog(res.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load scan details');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-text-muted">Loading scan result...</p>
                </div>
            </div>
        );
    }

    if (error || !log) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-surface rounded-3xl border border-white/5 p-8 max-w-md w-full text-center">
                    <span className="material-icons-round text-6xl text-red-400 mb-4">error_outline</span>
                    <h2 className="text-2xl font-bold text-white mb-2">Error Loading Scan</h2>
                    <p className="text-text-muted mb-6">{error || 'Scan result not found'}</p>
                    <button 
                        onClick={() => navigate('/scanner')}
                        className="bg-primary hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
                    >
                        Back to Scanner
                    </button>
                </div>
            </div>
        );
    }

    const { member, status, checkIn } = log;
    const isAllowed = status === 'ALLOWED';

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button 
                        onClick={() => navigate('/scanner')}
                        className="w-10 h-10 rounded-xl bg-surface border border-white/5 flex items-center justify-center hover:bg-surfaceHighlight transition-colors"
                    >
                        <span className="material-icons-round text-text-secondary">arrow_back</span>
                    </button>
                    <h1 className="text-2xl font-bold text-white">Scan Result</h1>
                </div>

                {/* Status Banner */}
                <div className={`rounded-2xl p-6 mb-6 border-2 ${
                    isAllowed 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                                isAllowed ? 'bg-emerald-500' : 'bg-red-500'
                            }`}>
                                <span className="material-icons-round text-4xl text-white">
                                    {isAllowed ? 'check_circle' : 'cancel'}
                                </span>
                            </div>
                            <div>
                                <h2 className={`text-2xl font-bold ${
                                    isAllowed ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                    Access {status}
                                </h2>
                                <p className="text-text-muted text-sm">
                                    Scanned at {new Date(checkIn).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Member Profile Card */}
                {member ? (
                    <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                        {/* Profile Header */}
                        <div className="bg-gradient-to-br from-primary/20 to-purple-500/20 p-8 relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
                            <div className="relative flex items-center gap-6">
                                {member.imageUrl ? (
                                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/10 shadow-xl">
                                        <img 
                                            src={member.imageUrl} 
                                            alt={`${member.firstName} ${member.lastName}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 rounded-2xl bg-primary/20 border-4 border-white/10 flex items-center justify-center shadow-xl">
                                        <span className="text-4xl font-bold text-primary">
                                            {member.firstName[0]}{member.lastName[0]}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-3xl font-bold text-white mb-1">
                                        {member.firstName} {member.lastName}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            member.membershipStatus === 'ACTIVE' 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        }`}>
                                            {member.membershipStatus}
                                        </span>
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-text-secondary border border-white/10">
                                            ID: {member.id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Member Details */}
                        <div className="p-8 space-y-6">
                            {/* Contact Information */}
                            <div>
                                <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Contact Information</h4>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons-round text-primary">email</span>
                                            <div>
                                                <p className="text-xs text-text-muted mb-1">Email</p>
                                                <p className="text-white font-medium">{member.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons-round text-primary">phone</span>
                                            <div>
                                                <p className="text-xs text-text-muted mb-1">Phone</p>
                                                <p className="text-white font-medium">{member.phone || 'Not provided'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Membership Details */}
                            <div>
                                <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Membership Details</h4>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-icons-round text-primary text-sm">calendar_today</span>
                                            <p className="text-xs text-text-muted">Join Date</p>
                                        </div>
                                        <p className="text-white font-bold">
                                            {new Date(member.joinDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {member.expiryDate && (
                                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-icons-round text-primary text-sm">event</span>
                                                <p className="text-xs text-text-muted">Expiry Date</p>
                                            </div>
                                            <p className="text-white font-bold">
                                                {new Date(member.expiryDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-icons-round text-primary text-sm">fitness_center</span>
                                            <p className="text-xs text-text-muted">Membership Type</p>
                                        </div>
                                        <p className="text-white font-bold">
                                            {member.membershipType || 'Standard'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Info */}
                            {member.emergencyContact && (
                                <div>
                                    <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Emergency Contact</h4>
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <p className="text-white font-medium">{member.emergencyContact}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-surface rounded-3xl border border-white/5 p-8 text-center">
                        <span className="material-icons-round text-6xl text-text-muted mb-4">person_off</span>
                        <h3 className="text-xl font-bold text-white mb-2">Unknown Member</h3>
                        <p className="text-text-muted">This QR code is not registered in the system</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 mt-6">
                    <button 
                        onClick={() => navigate('/scanner')}
                        className="flex-1 bg-primary hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round">qr_code_scanner</span>
                        Scan Next
                    </button>
                    {member && (
                        <button 
                            onClick={() => navigate(`/members/${member.id}`)}
                            className="flex-1 bg-surface hover:bg-surfaceHighlight text-white px-6 py-4 rounded-2xl font-bold border border-white/10 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-icons-round">person</span>
                            View Full Profile
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}