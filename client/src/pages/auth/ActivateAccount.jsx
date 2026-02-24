import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const ActivateAccount = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('loading'); // loading, form, success, error
    const [message, setMessage] = useState('');
    const [role, setRole] = useState('MEMBER');

    useEffect(() => {
        const checkToken = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Invalid or missing activation token.');
                return;
            }

            try {
                const res = await axios.get(`/api/auth/verify-token?token=${token}`);
                if (res.data.role) {
                    setRole(res.data.role);
                }
                setStatus('form');
            } catch (err) {
                setStatus('error');
                if (err.response?.data?.code === 'ALREADY_ACTIVATED') {
                    setMessage('This account has already been activated! You can proceed to log in.');
                } else if (err.response?.data?.code === 'TOKEN_INVALID_OR_CONSUMED') {
                    setMessage('This activation link is invalid or has already been used. If you already set a password, please try logging in.');
                } else {
                    setMessage(err.response?.data?.error || 'Invalid or expired activation link.');
                }
            }
        };

        checkToken();
    }, [token]);

    const handleActivate = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setMessage('Password must be at least 8 characters');
            return;
        }

        setStatus('submitting');
        try {
            const res = await axios.post('/api/auth/activate', { token, password });
            setStatus('success');
            setMessage(res.data.message);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.error || 'Activation failed. Please try again or contact staff.');
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
                    <p className="text-gray-400 mt-2">
                        {role === 'TRAINER' ? 'Staff Portal Activation' : 'Member Portal Activation'}
                    </p>
                </div>

                {status === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                        <p className="text-gray-400">Verifying activation link...</p>
                    </div>
                )}

                {(status === 'form' || status === 'submitting') && (
                    <form onSubmit={handleActivate} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-2">New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-primary outline-none transition-all placeholder:text-gray-600"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={status === 'submitting'}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-2">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:border-primary outline-none transition-all placeholder:text-gray-600"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={status === 'submitting'}
                                />
                            </div>
                        </div>

                        {message && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm text-center">
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'submitting'}
                            className="w-full bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold text-lg mt-4 transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            {status === 'submitting' ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                    Activating...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons-round">verified_user</span>
                                    Activate Account
                                </>
                            )}
                        </button>
                    </form>
                )}

                {status === 'success' && (
                    <div className="text-center py-8 space-y-6">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-emerald-500/20">
                            <span className="material-icons-round text-5xl text-emerald-500">check_circle</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-white">Success!</h3>
                            <p className="text-gray-400">{message}</p>
                        </div>
                        <p className="text-sm text-primary animate-pulse italic">Redirecting to login...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-8 space-y-6">
                        <div className={`w-20 h-20 ${message.includes('already been activated') ? 'bg-orange-500/10 ring-orange-500/20 text-orange-500' : 'bg-red-500/10 ring-red-500/20 text-red-500'} rounded-full flex items-center justify-center mx-auto ring-1`}>
                            <span className="material-icons-round text-5xl">
                                {message.includes('already been activated') ? 'info' : 'error_outline'}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-white">
                                {message.includes('already been activated') ? 'Already Activated' : 'Activation Failed'}
                            </h3>
                            <p className="text-gray-400">{message}</p>
                        </div>
                        <div className="pt-4 flex flex-col gap-3">
                            <Link to="/login" className="inline-block w-full py-4 px-6 bg-primary hover:bg-orange-600 text-white rounded-xl font-bold transition-all shadow-lg text-center">
                                Go to Login
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivateAccount;
