/**
 * CitizenDashboard — User dashboard for citizens to track their reports.
 * 
 * Aesthetic: Liquid Glass (Consistent with Landing Page & Report Page)
 * Features:
 * ✅ List of user-submitted tickets
 * ✅ Ticket status tracking (Open, In Progress, Resolved)
 * ✅ AI insights (Category, Severity)
 * ✅ Statistics summary
 * ✅ Mobile-responsive layouts
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyTickets, getMyReputation } from '../services/api';
import toast from 'react-hot-toast';

function Icon({ name, className = '' }) {
    return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const STATUS_CONFIG = {
    open: { label: 'Open', color: 'bg-red-500/10 text-red-500', icon: 'error' },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-500', icon: 'pending' },
    resolved: { label: 'Resolved', color: 'bg-emerald-500/10 text-emerald-500', icon: 'check_circle' },
};

const CATEGORY_ICONS = {
    pothole: 'paved_road',
    garbage: 'delete',
    broken_streetlight: 'lightbulb_circle',
    waterlogging: 'water_drop',
    other: 'more_horiz',
};

export default function CitizenDashboard() {
    const { user, userLogout, isUserAuthenticated, userLoading } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
    const [reputation, setReputation] = useState(null);
    const [repLoading, setRepLoading] = useState(true);

    useEffect(() => {
        if (!userLoading && !isUserAuthenticated) {
            navigate('/auth?redirect=/dashboard');
            return;
        }

        if (isUserAuthenticated) {
            fetchTickets();
            fetchReputation();
        }
    }, [isUserAuthenticated, userLoading, navigate]);

    async function fetchTickets() {
        try {
            const res = await getMyTickets();
            const data = res.data.data;
            setTickets(data);
            
            // Calculate stats
            const s = data.reduce((acc, t) => {
                acc.total++;
                if (t.status === 'resolved') acc.resolved++;
                else acc.pending++;
                return acc;
            }, { total: 0, pending: 0, resolved: 0 });
            setStats(s);

        } catch (err) {
            toast.error('Failed to load your reports.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchReputation() {
        try {
            const res = await getMyReputation();
            if (res.data?.reputation_score != null) {
                setReputation(res.data);
            }
        } catch {
            // Reputation is optional — silently degrade
        } finally {
            setRepLoading(false);
        }
    }

    const handleLogout = () => {
        userLogout();
        navigate('/');
        toast.success('Logged out successfully');
    };

    if (userLoading || (loading && !tickets.length)) {
        return (
            <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f6f8] font-display text-slate-900 overflow-x-hidden pb-20">
            {/* Ambient Background Blobs */}
            <div className="blob blob-a opacity-30" aria-hidden="true" />
            <div className="blob blob-b opacity-20" aria-hidden="true" />

            {/* Header */}
            <header className="relative z-40 w-full glass border-b border-white/40 sticky top-0">
                <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="bg-primary text-white rounded-lg w-7 h-7 flex items-center justify-center shadow-md shadow-primary/30">
                            <Icon name="location_city" className="text-[16px]" />
                        </div>
                        <span className="text-base font-black tracking-tight">CivicLens</span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <Link 
                            to="/report"
                            className="text-xs font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-all"
                        >
                            Report New
                        </Link>
                        <button 
                            onClick={handleLogout}
                            className="text-xs font-bold text-slate-500 hover:text-red-500 transition-colors"
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-5xl mx-auto px-5 pt-8 space-y-8">
                {/* Profile Section */}
                <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">
                            My Dashboard
                        </h1>
                        <p className="text-sm text-slate-500">Welcome back, {user?.name}</p>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white p-2 rounded-2xl shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-black">
                            {user?.name?.[0]}
                        </div>
                        <div className="pr-4">
                            <p className="text-sm font-bold text-slate-800">{user?.role?.toUpperCase()}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{user?.email}</p>
                        </div>
                    </div>
                </section>

                {/* Reputation + Stats Row */}
                <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Reputation Gauge */}
                    <div className="sm:row-span-1 bg-white/60 backdrop-blur-sm border border-white rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center gap-2">
                        {repLoading ? (
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : reputation?.reputation_score != null ? (
                            <>
                                <div className="relative w-20 h-20">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                        <circle
                                            cx="50" cy="50" r="42" fill="none"
                                            stroke={reputation.reputation_score >= 70 ? '#22c55e' : reputation.reputation_score >= 40 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={`${(reputation.reputation_score / 100) * 264} 264`}
                                            className="transition-all duration-1000"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xl font-black text-slate-800">{Math.round(reputation.reputation_score)}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] uppercase font-black tracking-[0.15em] text-slate-400">Trust Score</p>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    reputation.reputation_score >= 70
                                        ? 'bg-emerald-500/10 text-emerald-600'
                                        : reputation.reputation_score >= 40
                                            ? 'bg-amber-500/10 text-amber-600'
                                            : 'bg-red-500/10 text-red-600'
                                }`}>
                                    {reputation.reputation_score >= 70 ? 'Trusted' : reputation.reputation_score >= 40 ? 'Moderate' : 'Low'}
                                </span>
                            </>
                        ) : (
                            <>
                                <Icon name="psychology" className="text-3xl text-slate-300" />
                                <p className="text-[10px] text-slate-400 font-medium text-center">Score pending</p>
                            </>
                        )}
                    </div>

                    {/* Stats Cards */}
                    {[
                        { label: 'Total Reports', value: stats.total, color: 'text-primary', icon: 'folder' },
                        { label: 'Unresolved', value: stats.pending, color: 'text-amber-500', icon: 'pending_actions' },
                        { label: 'Resolved', value: stats.resolved, color: 'text-emerald-500', icon: 'verified' },
                    ].map((s) => (
                        <div key={s.label} className="bg-white/60 backdrop-blur-sm border border-white rounded-2xl p-4 shadow-sm border-b-4 border-b-transparent hover:border-b-primary transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <Icon name={s.icon} className={`text-xl ${s.color}`} />
                                <span className={`text-lg font-black ${s.color}`}>{s.value}</span>
                            </div>
                            <p className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-400">{s.label}</p>
                        </div>
                    ))}
                </section>

                {/* Ticket List */}
                <section className="space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Recent Submissions</h2>
                    
                    {tickets.length === 0 ? (
                        <div className="bg-white/40 border border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                <Icon name="history" className="text-3xl" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-600">No reports found</h3>
                                <p className="text-sm text-slate-400">You haven't submitted any civic issues yet.</p>
                            </div>
                            <Link 
                                to="/report" 
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                <Icon name="add_a_photo" className="text-lg" />
                                File My First Report
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tickets.map((t) => (
                                <div key={t._id} className="group glass-card bg-white/70 backdrop-blur-md border border-white rounded-3xl p-4 flex gap-4 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5">
                                    {/* Thumbnail */}
                                    <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100 shadow-inner">
                                        <img 
                                            src={t.photoUrl || '/placeholder.jpg'} 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                            alt="Issue" 
                                        />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    <Icon name={CATEGORY_ICONS[t.aiCategory] || 'interests'} className="text-[12px] text-primary" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight text-slate-600">
                                                        {t.aiCategory?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CONFIG[t.status].color}`}>
                                                    {STATUS_CONFIG[t.status].label}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700 line-clamp-1 mb-1">
                                                {t.description || 'No description provided'}
                                            </p>
                                            <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Icon name="calendar_today" className="text-[12px]" />
                                                    {new Date(t.createdAt).toLocaleDateString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Icon name="bolt" className="text-[12px] text-amber-500" />
                                                    Severity: {t.severityScore}/10
                                                </span>
                                            </div>
                                        </div>

                                        <button className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1 mt-2 group-hover:gap-2 transition-all">
                                            View Details
                                            <Icon name="arrow_forward" className="text-[14px]" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
