import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMessage('Invalid or missing password reset token. Please request a new link.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setStatus('error');
            setErrorMessage('Passwords do not match.');
            return;
        }

        if (newPassword.length < 6) {
            setStatus('error');
            setErrorMessage('Password must be at least 6 characters long.');
            return;
        }

        setStatus('loading');
        setErrorMessage('');

        try {
            await axios.post('/api/auth/reset-password', { token, newPassword });
            setStatus('success');
        } catch (error) {
            console.error("Reset password error:", error);
            setStatus('error');
            // Extract meaning message if available
            const msg = error.response?.data?.error || 'Failed to reset password. The link might be expired.';
            setErrorMessage(msg);
        }
    };

    return (
        <div className="min-h-screen flex bg-black">
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 relative z-10">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">FitOS</h1>
                    <p className="text-text-muted text-lg">Gym Management System</p>
                </div>

                <div className="w-full max-w-sm mx-auto">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-primary/10 rounded-full ring-1 ring-primary/20 shadow-lg shadow-primary/10">
                            <span className="material-icons-round text-3xl text-primary">lock_reset</span>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 text-center">Create New Password</h2>
                    <p className="text-text-muted text-sm mb-8 text-center">
                        Your new password must be different from previously used passwords.
                    </p>

                    {!token ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-center shadow-sm">
                            <p className="text-sm font-medium mb-4">
                                {errorMessage}
                            </p>
                            <Link to="/forgot-password" className="text-white bg-primary hover:bg-orange-600 focus:ring-4 focus:ring-orange-500/30 font-medium rounded-xl text-sm px-5 py-2.5 inline-block transition-all shadow-lg shadow-primary/20">
                                Request New Link
                            </Link>
                        </div>
                    ) : status === 'success' ? (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-5 rounded-xl text-center mb-6 shadow-sm">
                            <div className="flex justify-center mb-3">
                                <span className="material-icons-round text-4xl">check_circle</span>
                            </div>
                            <h3 className="text-lg font-bold mb-1">Password Reset!</h3>
                            <p className="text-sm font-medium mb-6">
                                Your password has been successfully reset.
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full text-white bg-primary hover:bg-orange-600 focus:ring-4 focus:ring-orange-500/30 font-medium rounded-xl text-sm px-5 py-3 text-center transition-all shadow-lg shadow-primary/20"
                            >
                                Continue to log in
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {status === 'error' && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-6 text-center shadow-sm">
                                    {errorMessage}
                                </div>
                            )}

                            <div>
                                <label className="block mb-2 text-sm font-medium text-white">New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-surface border border-white/10 text-white text-sm rounded-xl block p-3 placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm disabled:opacity-50"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={status === 'loading'}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-medium text-white">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-surface border border-white/10 text-white text-sm rounded-xl block p-3 placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm disabled:opacity-50"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={status === 'loading'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full text-white bg-primary hover:bg-orange-600 focus:ring-4 focus:ring-orange-500/30 font-medium rounded-xl text-sm px-5 py-3 text-center transition-all shadow-lg shadow-primary/20 disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
                            >
                                {status === 'loading' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Resetting...
                                    </>
                                ) : (
                                    'Reset Password'
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block w-1/2 relative">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1469&auto=format&fit=crop')" }}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
                </div>
                <div className="absolute bottom-10 left-10 text-white z-10 p-6 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 max-w-md shadow-2xl">
                    <h3 className="text-2xl font-bold mb-2">Back to the grind</h3>
                    <p className="text-gray-300 text-sm">Update your credentials and get back to managing your gym without missing a beat.</p>
                </div>
            </div>
        </div>
    );
}
