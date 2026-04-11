import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminLogin() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            toast.error('Please enter both fields');
            return;
        }
        setSubmitting(true);
        try {
            await login(username, password);
            toast.success('Welcome, Admin');
            navigate('/admin', { replace: true });
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401) {
                toast.error('Invalid credentials — check your username and password.');
            } else if (!err?.response) {
                toast.error('Cannot reach server. Check your connection.');
            } else {
                toast.error(`Login failed (${status ?? 'unknown error'})`);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center font-display bg-[#f6f6f8] text-slate-900 overflow-hidden">
            {/* Background decorative blurs */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

            <form
                onSubmit={handleSubmit}
                className="liquid-glass rounded-2xl p-10 w-full max-w-md space-y-7 shadow-xl"
            >
                {/* Logo / Header */}
                <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-white text-3xl">shield_person</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                        Admin Login
                    </h1>
                    <p className="text-sm text-slate-500">CivicLens Administrative Portal</p>
                </div>

                {/* Username */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Username</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">person</span>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-slate-100/50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-400"
                            placeholder="admin@gov"
                            autoComplete="username"
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">lock</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-100/50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-400"
                            placeholder="••••••••"
                            autoComplete="current-password"
                        />
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary text-white font-semibold py-3 rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[20px]">login</span>
                            Sign In
                        </>
                    )}
                </button>

                <p className="text-center text-xs text-slate-400">
                    <a href="/" className="hover:text-primary transition-colors">← Back to Citizen Portal</a>
                </p>
            </form>
        </div>
    );
}
