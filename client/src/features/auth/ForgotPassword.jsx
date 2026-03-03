import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            // Using standard axios logic as handled by the Vite proxy or API base URL
            await axios.post('/api/auth/forgot-password', { email });
            setStatus('success');
        } catch (error) {
            console.error("Forgot password error:", error);
            setStatus('error');
            setErrorMessage('Something went wrong. Please try again later.');
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
                            <span className="material-icons-round text-3xl text-primary">mark_email_read</span>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 text-center">Reset your password</h2>
                    <p className="text-text-muted text-sm mb-8 text-center">
                        Enter your email address and we'll send you a link to get back into your account.
                    </p>

                    {status === 'success' ? (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl text-center mb-6 space-y-4 shadow-sm">
                            <div className="flex justify-center">
                                <span className="material-icons-round text-4xl">check_circle</span>
                            </div>
                            <p className="text-sm font-medium">
                                If an account with that email exists, a password reset link has been sent.
                            </p>
                            <p className="text-xs text-green-500/80">
                                Please check your inbox and spam folder.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {status === 'error' && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-6 text-center shadow-sm">
                                    {errorMessage}
                                </div>
                            )}

                            <div>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-surface border border-white/10 text-white text-sm rounded-xl block p-3 placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm disabled:opacity-50"
                                    placeholder="Email@domain.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={status === 'loading'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full text-white bg-primary hover:bg-orange-600 focus:ring-4 focus:ring-orange-500/30 font-medium rounded-xl text-sm px-5 py-3 text-center transition-all shadow-lg shadow-primary/20 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {status === 'loading' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Sending...
                                    </>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center">
                        <Link to="/login" className="text-sm text-text-muted hover:text-white transition-colors flex items-center justify-center gap-1 group">
                            <span className="material-icons-round text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
                            Back to log in
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block w-1/2 relative">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1470&auto=format&fit=crop')" }}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
                </div>
                <div className="absolute bottom-10 left-10 text-white z-10 p-6 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 max-w-md shadow-2xl">
                    <h3 className="text-2xl font-bold mb-2">Secure access, simplified</h3>
                    <p className="text-gray-300 text-sm">We ensure your gym's data is safely protected with our enterprise-grade security architecture.</p>
                </div>
            </div>
        </div>
    );
}
