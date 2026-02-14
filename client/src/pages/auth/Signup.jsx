import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { withApiBase } from '../../config/api';

export default function Signup() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(withApiBase('/api/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Redirect to login after successful registration
                navigate('/login');
            } else {
                setError(data.error || 'Signup failed. Please try again.');
            }
        } catch (err) {
            setError('Could not connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Glow Detail */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full"></div>

            <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase">
                        Fit<span className="text-primary">OS</span>
                    </h1>
                    <p className="text-gray-400 mt-2">Create your account to start training</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-2">Full Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-primary outline-none transition-all placeholder:text-gray-600"
                            placeholder="John Doe"
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-2">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-primary outline-none transition-all placeholder:text-gray-600"
                            placeholder="name@example.com"
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-2">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-primary outline-none transition-all placeholder:text-gray-600"
                            placeholder="••••••••"
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button
                        disabled={loading}
                        className="w-full bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold text-lg mt-4 transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        {loading ? 'Creating Account...' : 'Become Fit'}
                    </button>
                </form>

                <p className="text-center mt-8 text-gray-400 text-sm">
                    Already a member?
                    <Link to="/login" className="text-primary font-bold hover:underline ml-1">
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}
