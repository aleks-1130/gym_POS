import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        setError('');
        try {
            const success = await login(email, password);
            if (success) {
                navigate('/dashboard');
            } else {
                setError('Invalid email or password');
            }
        } catch {
            setError('Unable to sign in right now. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderLoginForm = (idPrefix) => (
        <>
            {error && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div className="space-y-2.5">
                    <label htmlFor={`${idPrefix}-email`} className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
                        Email
                    </label>
                    <input
                        id={`${idPrefix}-email`}
                        type="email"
                        required
                        className="w-full rounded-xl border border-white/10 bg-background/80 px-4 py-3.5 text-sm text-white placeholder-text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-2.5">
                    <label htmlFor={`${idPrefix}-password`} className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            id={`${idPrefix}-password`}
                            type={showPassword ? 'text' : 'password'}
                            required
                            className="w-full rounded-xl border border-white/10 bg-background/80 px-4 py-3.5 pr-12 text-sm text-white placeholder-text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-text-muted transition-colors hover:text-white"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            title={showPassword ? 'Hide password' : 'Show password'}
                        >
                            <span className="material-icons-round text-[20px]">
                                {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                        </button>
                    </div>
                    <div className="flex justify-end">
                        <Link to="/forgot-password" className="text-xs font-medium text-primary hover:text-orange-400 transition-colors">
                            Forgot password?
                        </Link>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-500/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                </button>

                <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface px-5 py-3.5 text-sm font-medium text-white transition hover:bg-white/5 focus:outline-none focus:ring-4 focus:ring-white/10"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.539-6.033-5.632s2.701-5.632,6.033-5.632c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                    </svg>
                    Sign in with Google
                </button>
            </form>

            <p className="mt-7 text-center text-sm text-text-muted">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="font-semibold text-primary transition-colors hover:text-orange-400">
                    Sign Up
                </Link>
            </p>
        </>
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="lg:hidden">
                <div className="relative h-[50vh] min-h-[300px] overflow-hidden">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')" }}
                    >
                        <div className="absolute inset-0 bg-black/55"></div>
                    </div>
                    <div className="relative z-10 flex h-full flex-col justify-between px-5 pb-8 pt-6">
                        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                            <span className="material-icons-round text-sm text-primary">fitness_center</span>
                            FitOS
                        </span>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Welcome back</h1>
                            <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/80">
                                Track your gym operations with one secure login.
                            </p>
                        </div>
                    </div>
                </div>

                <section className="relative -mt-6 min-h-[calc(50vh+1.5rem)] rounded-t-3xl bg-background px-5 pb-8 pt-6">
                    <div className="mx-auto w-full max-w-sm">
                        {renderLoginForm('mobile-login')}
                    </div>
                </section>
            </div>

            <div className="relative hidden min-h-screen overflow-hidden lg:block">
                <div className="pointer-events-none absolute -top-32 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"></div>
                <div className="pointer-events-none absolute -bottom-44 right-[-6rem] h-[20rem] w-[20rem] rounded-full bg-sky-500/10 blur-3xl"></div>

                <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-10 py-8">
                    <div className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-surface/80 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-2">
                        <section className="p-12">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                                <span className="material-icons-round text-sm text-primary">fitness_center</span>
                                FitOS
                            </span>
                            <h1 className="mt-4 text-4xl font-bold text-white">Welcome back</h1>
                            <p className="mt-2 text-base leading-relaxed text-text-muted">
                                Sign in to continue managing members, billing, and gym operations.
                            </p>

                            <div className="mt-8">
                                {renderLoginForm('desktop-login')}
                            </div>
                        </section>

                        <section className="relative">
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')" }}
                            >
                                <div className="absolute inset-0 bg-black/65"></div>
                            </div>
                            <div className="relative flex h-full w-full items-end p-10">
                                <div className="rounded-2xl border border-white/15 bg-black/45 p-6 backdrop-blur-md">
                                    <h2 className="text-2xl font-bold leading-tight text-white">
                                        Manage your gym with a faster and clearer workflow
                                    </h2>
                                    <p className="mt-3 text-sm text-gray-200">
                                        Track attendance, payments, and performance insights in one connected dashboard.
                                    </p>
                                    <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                                        <div className="rounded-xl bg-white/10 px-3 py-3">
                                            <p className="text-xl font-bold text-white">24/7</p>
                                            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-300">Access</p>
                                        </div>
                                        <div className="rounded-xl bg-white/10 px-3 py-3">
                                            <p className="text-xl font-bold text-white">Live</p>
                                            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-300">Monitoring</p>
                                        </div>
                                        <div className="rounded-xl bg-white/10 px-3 py-3">
                                            <p className="text-xl font-bold text-white">Safe</p>
                                            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-300">Sessions</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
