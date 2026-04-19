/**
 * AuthPage — Login / Signup with role-based tabs (Citizen / Officer)
 *
 * Features:
 * ✅ Toggle between Login & Signup
 * ✅ Role selector (Citizen / Officer)
 * ✅ Officer fields: city, department, issue category, ID proof
 * ✅ Pending approval message for officers
 * ✅ Liquid glass light theme (matches Admin Dashboard)
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
    const [showPendingMsg, setShowPendingMsg] = useState(false);

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [department, setDepartment] = useState('');
    const [city, setCity] = useState('');
    const [issueCategory, setIssueCategory] = useState('');
    const [idProof, setIdProof] = useState(null);

    const redirectTo = searchParams.get('redirect');

    // If already authenticated, redirect
    useEffect(() => {
        if (isUserAuthenticated) {
            if (redirectTo) {
                navigate(redirectTo, { replace: true });
            } else if (user?.role === 'officer') {
                navigate('/officer', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
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
                if (role === 'officer') {
                    if (!city || !idProof || !issueCategory) {
                        toast.error('Working city, issue category, and ID Proof are required for officers.');
                        setSubmitting(false);
                        return;
                    }
                    const formData = new FormData();
                    formData.append('name', name);
                    formData.append('email', email);
                    formData.append('password', password);
                    formData.append('role', role);
                    formData.append('phone', phone);
                    formData.append('department', department);
                    formData.append('city', city);
                    formData.append('issueCategory', issueCategory);
                    formData.append('idProof', idProof);
                    await userSignup(formData);
                    // Officers are pending — show the pending message
                    setShowPendingMsg(true);
                    return;
                } else {
                    await userSignup({ name, email, password, role, phone, department });
                }
                toast.success('Account created successfully!');
            }
        } catch (err) {
            const msg = err?.response?.data?.error || 'Something went wrong. Please try again.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Pending approval screen
    if (showPendingMsg) {
        return (
            <div className="relative min-h-screen flex items-center justify-center font-display bg-[#f6f6f8] text-slate-900 overflow-hidden px-4">
                {/* Background decorative blurs */}
                <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
                <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

                <div className="relative z-10 w-full max-w-md text-center">
                    <div className="liquid-glass rounded-3xl p-10 space-y-6 shadow-xl">
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                            <Icon name="hourglass_top" className="text-4xl text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-800">Registration Submitted!</h1>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Your officer account has been created and is <span className="text-amber-600 font-bold">pending admin approval</span>. 
                            You will be able to log in once an admin reviews and approves your documents.
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                            <p className="text-xs font-bold text-amber-700 mb-1">What happens next?</p>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li>• Admin reviews your ID proof documents</li>
                                <li>• Once approved, you can log in with your credentials</li>
                                <li>• You'll be assigned to handle {issueCategory.replace('_', ' ')} issues in {city}</li>
                            </ul>
                        </div>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] transition-all"
                        >
                            <Icon name="home" className="text-lg" />
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const inputClass = "w-full bg-slate-100/60 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
    const selectClass = "w-full bg-slate-100/60 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none";

    return (
        <div className="relative min-h-screen flex items-center justify-center font-display bg-[#f6f6f8] text-slate-900 overflow-hidden px-4">
            {/* Background decorative blurs */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

            <div className="relative z-10 w-full max-w-md py-12">
                {/* Back to home */}
                <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-6 transition-colors">
                    <Icon name="arrow_back" className="text-lg" />
                    Back to Home
                </Link>

                <form
                    onSubmit={handleSubmit}
                    className="liquid-glass rounded-3xl p-8 sm:p-10 space-y-6 shadow-xl"
                >
                    {/* Logo */}
                    <div className="flex flex-col items-center gap-3 mb-2">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/25">
                            <Icon name={mode === 'login' ? 'login' : 'person_add'} className="text-3xl text-white" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800">
                            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {mode === 'login'
                                ? 'Sign in to track your civic reports'
                                : 'Join CivicLens to report and track issues'}
                        </p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        {['login', 'signup'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                    mode === m
                                        ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {m === 'login' ? 'Sign In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    {/* Role Selector (only in signup) */}
                    {mode === 'signup' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">I am a</label>
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
                                                ? 'border-primary bg-primary/5 text-slate-800 shadow-sm'
                                                : 'border-slate-200 bg-white/50 text-slate-500 hover:border-slate-300'
                                        }`}
                                    >
                                        <Icon name={r.icon} className={`text-2xl ${role === r.value ? 'text-primary' : ''}`} />
                                        <span className="text-sm font-bold">{r.label}</span>
                                        <span className="text-[10px] text-slate-400">{r.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Name (signup only) */}
                    {mode === 'signup' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name *</label>
                            <div className="relative">
                                <Icon name="person" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={inputClass}
                                    placeholder="John Doe"
                                    autoComplete="name"
                                />
                            </div>
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email *</label>
                        <div className="relative">
                            <Icon name="mail" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={inputClass}
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password *</label>
                        <div className="relative">
                            <Icon name="lock" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={inputClass}
                                placeholder="••••••••"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />
                        </div>
                    </div>

                    {/* Phone (signup only) */}
                    {mode === 'signup' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone <span className="text-slate-400">(optional)</span></label>
                            <div className="relative">
                                <Icon name="call" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={inputClass}
                                    placeholder="+91 12345 67890"
                                />
                            </div>
                        </div>
                    )}

                    {/* Officer-specific fields */}
                    {mode === 'signup' && role === 'officer' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
                                <div className="relative">
                                    <Icon name="apartment" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400" />
                                    <input
                                        type="text"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className={inputClass}
                                        placeholder="Municipal Corporation"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Working City *</label>
                                <div className="relative">
                                    <Icon name="location_on" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400 pointer-events-none" />
                                    <select
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">Select City</option>
                                        <option value="Mumbai">Mumbai</option>
                                        <option value="Navi Mumbai">Navi Mumbai</option>
                                        <option value="Panvel">Panvel</option>
                                        <option value="Vashi">Vashi</option>
                                        <option value="Wadala">Wadala</option>
                                        <option value="Chunabhatti">Chunabhatti</option>
                                        <option value="Thane">Thane</option>
                                        <option value="Kalyan">Kalyan</option>
                                    </select>
                                    <Icon name="expand_more" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Issue Category */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Issue Domain *</label>
                                <div className="relative">
                                    <Icon name="category" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400 pointer-events-none" />
                                    <select
                                        value={issueCategory}
                                        onChange={(e) => setIssueCategory(e.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">Select your domain</option>
                                        <option value="pothole">Potholes / Road Damage</option>
                                        <option value="garbage_dump">Garbage / Sanitation</option>
                                        <option value="waterlogging">Waterlogging / Floods</option>
                                        <option value="electrical_hazard">Electrical Hazard</option>
                                        <option value="blocked_drain">Open/Blocked Drains</option>
                                    </select>
                                    <Icon name="expand_more" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xl text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ID Proof Image *</label>
                                <div className="relative flex items-center bg-slate-100/60 border border-slate-200 rounded-xl p-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setIdProof(e.target.files[0])}
                                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                                    />
                                </div>
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
                                <button type="button" onClick={() => setMode('signup')} className="text-primary font-semibold hover:text-primary/80 transition-colors">
                                    Sign Up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button type="button" onClick={() => setMode('login')} className="text-primary font-semibold hover:text-primary/80 transition-colors">
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
