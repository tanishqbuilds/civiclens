/**
 * LandingPage — Premium Hero Landing for CivicLens
 *
 * Features:
 * ✅ Animated hero section with floating city elements
 * ✅ CTA for "Report Issue" (camera/upload)
 * ✅ Login / Signup navigation
 * ✅ Features showcase with icons
 * ✅ Live stats counter (animated on scroll)
 * ✅ Liquid glass light theme (matches all pages)
 * ✅ Responsive & mobile-first
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HERO_WORDS = ['Potholes', 'Garbage', 'Streetlights', 'Waterlogging', 'Hazards'];

const FEATURES = [
    {
        icon: 'photo_camera',
        title: 'Snap & Report',
        desc: 'Take a photo of any civic issue — AI identifies and categorizes it instantly.',
        gradient: 'from-blue-500 to-indigo-600',
    },
    {
        icon: 'psychology',
        title: 'AI-Powered Triage',
        desc: 'Computer vision analyzes severity and routes complaints to the right department.',
        gradient: 'from-violet-500 to-purple-600',
    },
    {
        icon: 'map',
        title: 'Live Heatmap',
        desc: 'Authorities see real-time severity heatmaps for data-driven resource allocation.',
        gradient: 'from-emerald-500 to-teal-600',
    },
    {
        icon: 'track_changes',
        title: 'Track Progress',
        desc: 'Follow your complaint from submission to resolution — complete transparency.',
        gradient: 'from-amber-500 to-orange-600',
    },
];

const STATS = [
    { label: 'Issues Reported', value: 2450, suffix: '+' },
    { label: 'Resolved', value: 1820, suffix: '+' },
    { label: 'Cities Active', value: 12, suffix: '' },
    { label: 'Avg Resolution', value: 48, suffix: 'hrs' },
];

function AnimatedCounter({ target, suffix, inView }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const duration = 2000;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [inView, target]);

    return (
        <span className="tabular-nums">
            {count.toLocaleString()}{suffix}
        </span>
    );
}

function Icon({ name, className = '' }) {
    return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function LandingPage() {
    const navigate = useNavigate();
    const { isUserAuthenticated, user } = useAuth();
    const [heroIdx, setHeroIdx] = useState(0);
    const [statsInView, setStatsInView] = useState(false);
    const statsRef = useRef(null);
    const [scrollY, setScrollY] = useState(0);

    // Cycle hero words
    useEffect(() => {
        const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_WORDS.length), 2400);
        return () => clearInterval(t);
    }, []);

    // Parallax scroll tracking
    useEffect(() => {
        const handler = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    // Intersection observer for stats
    useEffect(() => {
        const el = statsRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) setStatsInView(true); },
            { threshold: 0.3 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-[#f6f6f8] font-display text-slate-900 overflow-x-hidden">

            {/* ── Ambient Gradient Orbs ── */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
                <div
                    className="absolute w-[600px] h-[600px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                        top: '-200px',
                        left: '-150px',
                        transform: `translateY(${scrollY * 0.08}px)`,
                    }}
                />
                <div
                    className="absolute w-[500px] h-[500px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
                        top: '30%',
                        right: '-200px',
                        transform: `translateY(${scrollY * -0.05}px)`,
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
                        bottom: '100px',
                        left: '10%',
                        transform: `translateY(${scrollY * 0.06}px)`,
                    }}
                />
            </div>

            {/* ── Navigation ── */}
            <nav className="relative z-50 w-full border-b border-slate-200/60">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
                    <div className="liquid-glass rounded-xl px-4 py-2 flex items-center gap-6">
                        <Link to={isUserAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
                            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl w-9 h-9 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/40 transition-shadow">
                                <Icon name="location_city" className="text-xl" />
                            </div>
                            <span className="text-xl font-black tracking-tight">
                                Civic<span className="text-indigo-600">Lens</span>
                            </span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {isUserAuthenticated ? (
                            <Link
                                to="/dashboard"
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-primary hover:bg-primary/5 transition-all"
                            >
                                <Icon name="dashboard" className="text-lg" />
                                My Dashboard
                            </Link>
                        ) : (
                            <Link
                                to="/auth"
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-primary hover:bg-primary/5 transition-all"
                                id="nav-login-btn"
                            >
                                <Icon name="login" className="text-lg" />
                                <span className="hidden sm:inline">Login</span>
                            </Link>
                        )}
                        <Link
                            to="/auth?mode=signup"
                            className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            id="nav-signup-btn"
                        >
                            Sign Up
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero Section ── */}
            <section className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-20 sm:pt-28 pb-20">
                <div className="max-w-3xl mx-auto text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 mb-8 landing-fade-up" style={{ animationDelay: '0s' }}>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-semibold text-indigo-700 tracking-wider uppercase">AI-Powered Civic Platform</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] landing-fade-up" style={{ animationDelay: '0.1s' }}>
                        Report{' '}
                        <span className="relative inline-block">
                            <span
                                key={heroIdx}
                                className="bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent animate-hero-fade"
                            >
                                {HERO_WORDS[heroIdx]}
                            </span>
                            <div className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500/60 to-cyan-500/60 rounded-full" />
                        </span>
                        <br />
                        <span className="text-slate-800">Fix Your City</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg sm:text-xl text-slate-500 mt-6 max-w-xl mx-auto leading-relaxed landing-fade-up" style={{ animationDelay: '0.2s' }}>
                        Snap a photo. Drop a pin. AI handles the rest —
                        categorizing, prioritizing, and routing civic issues to the right authorities.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 landing-fade-up" style={{ animationDelay: '0.35s' }}>
                        <button
                            onClick={() => navigate('/report')}
                            className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.97] transition-all"
                            id="hero-report-btn"
                        >
                            <div className="bg-white/20 rounded-lg p-1.5 group-hover:bg-white/30 transition-colors">
                                <Icon name="photo_camera" className="text-xl" />
                            </div>
                            Report an Issue
                            <Icon name="arrow_forward" className="text-lg group-hover:translate-x-1 transition-transform" />
                        </button>
                        <Link
                            to="/auth"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold text-slate-700 liquid-glass shadow-sm hover:shadow-md hover:text-primary transition-all"
                            id="hero-login-btn"
                        >
                            <Icon name="shield_person" className="text-xl" />
                            Officer Login
                        </Link>
                    </div>
                </div>

                {/* Hero visual — Floating glass card mockup */}
                <div className="relative mt-16 sm:mt-20 max-w-4xl mx-auto landing-fade-up" style={{ animationDelay: '0.55s' }}>
                    <div className="relative rounded-3xl overflow-hidden liquid-glass shadow-xl p-1">
                        <div className="rounded-[20px] bg-white/60 pb-6 pt-6 pl-10 pr-10 border border-slate-100/50 p-6 sm:p-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                <span className="ml-3 text-xs text-slate-500 font-mono">CivicLens Dashboard</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                    { label: 'Open Issues', val: '74', color: 'text-red-500', icon: 'error' },
                                    { label: 'In Progress', val: '31', color: 'text-amber-500', icon: 'pending' },
                                    { label: 'Resolved', val: '23', color: 'text-emerald-500', icon: 'check_circle' },
                                    { label: 'Avg Severity', val: '6.4', color: 'text-blue-500', icon: 'speed' },
                                ].map((s) => (
                                    <div key={s.label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon name={s.icon} className={`text-lg ${s.color}`} />
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{s.label}</span>
                                        </div>
                                        <span className={`text-2xl font-black ${s.color}`}>{s.val}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Fake heatmap bar */}
                            <div className="mt-6 h-3 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400" style={{ width: '72%' }} />
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                                <span>Low Severity</span>
                                <span>High Severity</span>
                            </div>
                        </div>
                    </div>
                    {/* Glow below card */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-24 bg-indigo-500/8 blur-3xl rounded-full" aria-hidden="true" />
                </div>
            </section>

            {/* ── How It Works ── */}
            <section className="relative z-10 py-24 border-t border-slate-200/60">
                <div className="max-w-7xl mx-auto px-5 sm:px-8">
                    <div className="text-center mb-16">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-primary mb-3">How It Works</p>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                            Three Steps to a <span className="bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent">Safer City</span>
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        {[
                            { step: '01', icon: 'photo_camera', title: 'Capture', desc: 'Snap a photo of the civic issue with your phone camera' },
                            { step: '02', icon: 'smart_toy', title: 'AI Analysis', desc: 'Computer vision classifies the issue and scores severity' },
                            { step: '03', icon: 'engineering', title: 'Resolution', desc: 'Officers are dispatched based on priority heatmaps' },
                        ].map((s, i) => (
                            <div key={s.step} className="relative group">
                                <div className="liquid-glass rounded-2xl p-8 hover:shadow-lg transition-all duration-300">
                                    <div className="text-[60px] font-black text-slate-100 absolute top-4 right-6 select-none">{s.step}</div>
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                        <Icon name={s.icon} className="text-2xl text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 text-slate-800">{s.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                                </div>
                                {i < 2 && (
                                    <div className="hidden sm:block absolute top-1/2 -right-4 z-10">
                                        <Icon name="arrow_forward" className="text-xl text-slate-300" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ── */}
            <section className="relative z-10 py-24">
                <div className="max-w-7xl mx-auto px-5 sm:px-8">
                    <div className="text-center mb-16">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-primary mb-3">Platform Features</p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {FEATURES.map((f) => (
                            <div
                                key={f.title}
                                className="group liquid-glass rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                                    <Icon name={f.icon} className="text-xl text-white" />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-slate-800">{f.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section ref={statsRef} className="relative z-10 py-20 border-t border-b border-slate-200/60">
                <div className="max-w-5xl mx-auto px-5 sm:px-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                        {STATS.map((s) => (
                            <div key={s.label}>
                                <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent">
                                    <AnimatedCounter target={s.value} suffix={s.suffix} inView={statsInView} />
                                </div>
                                <p className="text-sm text-slate-500 mt-2 font-medium">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="relative z-10 py-24">
                <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-6">
                        Ready to Make Your City <br />
                        <span className="bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">Safer & Smarter?</span>
                    </h2>
                    <p className="text-lg text-slate-500 mb-10 max-w-lg mx-auto">
                        No account needed. Just snap, report, and let AI do the heavy lifting.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate('/report')}
                            className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.97] transition-all"
                            id="cta-report-btn"
                        >
                            <Icon name="photo_camera" className="text-xl" />
                            Report an Issue Now
                            <Icon name="arrow_forward" className="text-lg group-hover:translate-x-1 transition-transform" />
                        </button>
                        <Link
                            to="/auth?mode=signup"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold text-slate-700 liquid-glass shadow-sm hover:shadow-md hover:text-primary transition-all"
                            id="cta-signup-btn"
                        >
                            Create Account
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="relative z-10 border-t border-slate-200/60 py-10">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-lg w-7 h-7 flex items-center justify-center">
                            <Icon name="location_city" className="text-sm" />
                        </div>
                        <span className="text-sm font-bold text-slate-500">CivicLens</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <Link to="/auth" className="hover:text-primary transition-colors">Login</Link>
                        <Link to="/auth?mode=signup" className="hover:text-primary transition-colors">Sign Up</Link>
                        <Link to="/admin/login" className="hover:text-primary transition-colors">Admin</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
