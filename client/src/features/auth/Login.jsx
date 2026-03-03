import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const success = await login(email, password);
        if (success) {
            navigate('/dashboard');
        } else {
            setError('Invalid email or password');
        }
    };

    return (
        <div className="min-h-screen flex bg-black">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 relative z-10">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">FitOS</h1>
                    <p className="text-text-muted text-lg">Gym Management System</p>
                </div>

                <div className="w-full max-w-sm mx-auto">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-primary/10 rounded-full ring-1 ring-primary/20 shadow-lg shadow-primary/10">
                            <span className="material-icons-round text-3xl text-primary">lock_person</span>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 text-center">Sign Into Your Account</h2>
                    <p className="text-text-muted text-sm mb-8 text-center">Enter your email and password</p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-6 text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <input
                                type="email"
                                required
                                className="w-full bg-surface border border-white/10 text-white text-sm rounded-xl block p-3 placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                                placeholder="Email@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                required
                                className="w-full bg-surface border border-white/10 text-white text-sm rounded-xl block p-3 placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end -mt-2">
                            <Link to="/forgot-password" className="text-sm text-text-muted hover:text-primary transition-colors">
                                Forgot password?
                            </Link>
                        </div>

                        <button type="submit" className="w-full text-white bg-primary hover:bg-orange-600 focus:ring-4 focus:ring-orange-500/30 font-medium rounded-xl text-sm px-5 py-3 text-center transition-all shadow-lg shadow-primary/20">
                            Sign In
                        </button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink mx-4 text-text-muted text-xs uppercase">Or continue with</span>
                            <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <button type="button" className="w-full text-white bg-surface border border-white/10 hover:bg-white/5 focus:ring-4 focus:ring-white/5 font-medium rounded-xl text-sm px-5 py-3 text-center transition-colors flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.539-6.033-5.632 s2.701-5.632,6.033-5.632c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2 C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                            </svg>
                            Sign In with Google
                        </button>

                    </form>

                    <p className="mt-8 text-center text-sm text-text-muted">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-primary hover:text-white transition-colors font-medium">
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block w-1/2 relative">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')" }}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
                </div>
                <div className="absolute bottom-10 left-10 text-white z-10 p-6 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 max-w-md shadow-2xl">
                    <h3 className="text-2xl font-bold mb-2">Manage Your Gym Professionally</h3>
                    <p className="text-gray-300 text-sm">Track members, process payments, and monitor access in real-time with FitOS.</p>
                </div>
            </div>
        </div>
    );
}
