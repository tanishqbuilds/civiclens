/**
 * AuthPage — Login / Signup with role-based tabs (Citizen / Officer)
 *
 * Features:
 * ✅ Toggle between Login & Signup
 * ✅ Role selector (Citizen / Officer)
 * ✅ Glass morphism dark theme
 * ✅ Redirects post-login based on role
 * ✅ Supports ?mode=signup and ?redirect= query params
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function Icon({ name, className = '' }) {
    return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function AuthPage() {
    const { userLogin, userSignup, isUserAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
    const [role, setRole] = useState('citizen');
    const [submitting, setSubmitting] = useState(false);

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [department, setDepartment] = useState('');

    const redirectTo = searchParams.get('redirect');

    // If already authenticated, redirect
    useEffect(() => {
        if (isUserAuthenticated) {
            if (redirectTo) {
                navigate(redirectTo, { replace: true });
            } else if (user?.role === 'officer') {
                navigate('/admin/login', { replace: true });
            } else {
                navigate('/report', { replace: true });
            }
        }
    }, [isUserAuthenticated, navigate, redirectTo, user]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (mode === 'login') {
            if (!email || !password) {
                toast.error('Please fill in all fields.');
                return;
            }
        } else {
            if (!name || !email || !password) {
                toast.error('Please fill in all required fields.');
                return;
            }
            if (password.length < 6) {
                toast.error('Password must be at least 6 characters.');
                return;
            }
        }

        setSubmitting(true);
        try {
            if (mode === 'login') {
                await userLogin({ email, password });
                toast.success('Welcome back!');
            } else {
                await userSignup({ name, email, password, role, phone, department });
                toast.success('Account created successfully!');
            }

            // Redirect
            if (redirectTo) {
                navigate(redirectTo, { replace: true });
            } else {
                navigate('/report', { replace: true });
            }
        } catch (err) {
            const msg = err?.response?.data?.error || 'Something went wrong. Please try again.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center font-display bg-[#050816] text-white overflow-hidden px-4">
            {/* Background orbs */}
            <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
                <div className="absolute w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', top: '-150px', left: '-100px' }} />
                <div className="absolute w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', bottom: '-100px', right: '-100px' }} />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Back to home */}
                <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white mb-6 transition-colors">
                    <Icon name="arrow_back" className="text-lg" />
                    Back to Home
                </Link>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 sm:p-10 space-y-6 backdrop-blur-sm"
                >
                    {/* Logo */}
                    <div className="flex flex-col items-center gap-3 mb-2">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/25">
                            <Icon name={mode === 'login' ? 'login' : 'person_add'} className="text-3xl text-white" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">
                            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h1>
                        <p className="text-sm text-slate-400">
                            {mode === 'login'
                                ? 'Sign in to track your civic reports'
                                : 'Join CivicLens to report and track issues'}
                        </p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex rounded-xl bg-white/5 p-1 border border-white/5">
                        {['login', 'signup'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                    mode === m
                                        ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {m === 'login' ? 'Sign In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    {/* Role Selector (only in signup) */}
                    {mode === 'signup' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">I am a</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'citizen', icon: 'person', label: 'Citizen', desc: 'Report issues' },
                                    { value: 'officer', icon: 'badge', label: 'Officer', desc: 'Manage & resolve' },
                                ].map((r) => (
                                    <button
                                        key={r.value}
                                        type="button"
                                        onClick={() => setRole(r.value)}
                                        className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all ${
                                            role === r.value
                                                ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                                                : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10'
                                        }`}
                                    >
                                        <Icon name={r.icon} className={`text-2xl ${role === r.value ? 'text-indigo-400' : ''}`} />
                                        <span className="text-sm font-bold">{r.label}</span>
                                        <span className="text-[10px] text-slate-500">{r.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Name (signup only) */}
                    {mode === 'signup' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
                            <div className="relative">
                                <Icon name="person" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-500" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                    placeholder="John Doe"
                                    autoComplete="name"
                                />
                            </div>
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email *</label>
                        <div className="relative">
                            <Icon name="mail" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password *</label>
                        <div className="relative">
                            <Icon name="lock" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                placeholder="••••••••"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />
                        </div>
                    </div>

                    {/* Phone (signup only) */}
                    {mode === 'signup' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone <span className="text-slate-600">(optional)</span></label>
                            <div className="relative">
                                <Icon name="call" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-500" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                    placeholder="+91 12345 67890"
                                />
                            </div>
                        </div>
                    )}

                    {/* Department (officer only in signup) */}
                    {mode === 'signup' && role === 'officer' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Department</label>
                            <div className="relative">
                                <Icon name="apartment" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-500" />
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                    placeholder="Municipal Corporation"
                                />
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        id="auth-submit-btn"
                    >
                        {submitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Icon name={mode === 'login' ? 'login' : 'person_add'} className="text-xl" />
                                {mode === 'login' ? 'Sign In' : 'Create Account'}
                            </>
                        )}
                    </button>

                    {/* Switch mode text */}
                    <p className="text-center text-sm text-slate-500">
                        {mode === 'login' ? (
                            <>
                                Don't have an account?{' '}
                                <button type="button" onClick={() => setMode('signup')} className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
                                    Sign Up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button type="button" onClick={() => setMode('login')} className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
                                    Sign In
                                </button>
                            </>
                        )}
                    </p>
                </form>
            </div>
        </div>
    );
}
