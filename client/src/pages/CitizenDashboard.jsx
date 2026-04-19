/**
 * CitizenDashboard — User dashboard for citizens to track their reports.
 * 
 * Features:
 * ✅ List of user-submitted tickets
 * ✅ Ticket detail modal with live updates timeline
 * ✅ Notification bell with unread count
 * ✅ Profile circle in navbar
 * ✅ Enhanced navbar sizing
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyTickets, getMyReputation, getTicketUpdates, getNotifications, markNotificationsRead } from '../services/api';
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

const CAT_LABEL = {
    pothole: 'Pothole',
    garbage: 'Garbage Dump',
    broken_streetlight: 'Broken Streetlight',
    waterlogging: 'Waterlogging',
    other: 'Other Issue',
    unclassified: 'Unclassified',
};

export default function CitizenDashboard() {
    const { user, userLogout, isUserAuthenticated, userLoading } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
    const [reputation, setReputation] = useState(null);
    const [repLoading, setRepLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketUpdates, setTicketUpdates] = useState([]);
    const [updatesLoading, setUpdatesLoading] = useState(false);

    // Notifications
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        if (!userLoading && !isUserAuthenticated) {
            navigate('/auth?redirect=/dashboard');
            return;
        }

        if (isUserAuthenticated) {
            fetchTickets();
            fetchReputation();
            fetchNotifications();

            // Poll for new notifications every 30s so live updates appear
            const notifInterval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(notifInterval);
        }
    }, [isUserAuthenticated, userLoading, navigate]);

    async function fetchTickets() {
        try {
            const res = await getMyTickets();
            const data = res.data.data;
            setTickets(data);
            
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
            // Reputation is optional
        } finally {
            setRepLoading(false);
        }
    }

    async function fetchNotifications() {
        try {
            const res = await getNotifications();
            setNotifications(res.data.data || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch { }
    }

    async function handleMarkRead() {
        try {
            await markNotificationsRead();
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch { }
    }

    async function openTicketDetail(ticket) {
        setSelectedTicket(ticket);
        setUpdatesLoading(true);
        try {
            const res = await getTicketUpdates(ticket._id);
            setTicketUpdates(res.data.data || []);
        } catch {
            setTicketUpdates([]);
        } finally {
            setUpdatesLoading(false);
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

            {/* Header — Enhanced Size */}
            <header className="relative z-40 w-full glass border-b border-white/40 sticky top-0">
                <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
                    <Link to="/dashboard" className="flex items-center gap-2.5">
                        <div className="bg-primary text-white rounded-lg w-9 h-9 flex items-center justify-center shadow-md shadow-primary/30">
                            <Icon name="location_city" className="text-xl" />
                        </div>
                        <span className="text-lg font-black tracking-tight">CivicLens</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) handleMarkRead(); }}
                                className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                <Icon name="notifications" className="text-2xl text-slate-600" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 z-50">
                                    <div className="p-4 border-b border-slate-100">
                                        <h3 className="font-bold text-sm">Notifications</h3>
                                    </div>
                                    {notifications.length === 0 ? (
                                        <div className="p-6 text-center text-sm text-slate-400">No notifications yet</div>
                                    ) : (
                                        notifications.map((n, i) => (
                                            <div
                                                key={n._id || i}
                                                onClick={() => {
                                                    setShowNotifications(false);
                                                    if (n.ticketId) {
                                                        const t = tickets.find(t => String(t._id) === String(n.ticketId));
                                                        if (t) openTicketDetail(t);
                                                    }
                                                }}
                                                className={`px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                                            >
                                                <p className="text-sm font-medium text-slate-700">{n.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Profile Circle */}
                        <Link
                            to="/profile"
                            className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md hover:scale-105 transition-transform"
                            title="My Profile"
                        >
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </Link>

                        <button 
                            onClick={handleLogout}
                            className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50"
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-5xl mx-auto px-5 pt-8 space-y-8">
                {/* Dashboard Header */}
                <section>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">
                        My Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Welcome back, {user?.name}</p>
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
                                                    <Icon name={CATEGORY_ICONS[t.issueCategory || t.aiCategory] || 'interests'} className="text-[12px] text-primary" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight text-slate-600">
                                                        {CAT_LABEL[t.issueCategory || t.aiCategory] || (t.issueCategory || t.aiCategory || '').replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CONFIG[t.status]?.color || ''}`}>
                                                    {STATUS_CONFIG[t.status]?.label || t.status}
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
                                                {t.assignedOfficerName && (
                                                    <span className="flex items-center gap-1 text-primary">
                                                        <Icon name="badge" className="text-[12px]" />
                                                        {t.assignedOfficerName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => openTicketDetail(t)}
                                            className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1 mt-2 group-hover:gap-2 transition-all"
                                        >
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

            {/* ── Ticket Detail Modal ── */}
            {selectedTicket && (
                <TicketDetailModal
                    ticket={selectedTicket}
                    updates={ticketUpdates}
                    updatesLoading={updatesLoading}
                    onClose={() => { setSelectedTicket(null); setTicketUpdates([]); }}
                />
            )}

            {/* Click outside to close notifications */}
            {showNotifications && (
                <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
            )}

            {/* Floating Report Issue Button */}
            <Link
                to="/report"
                className="fixed bottom-8 right-8 z-40 flex items-center gap-2.5 px-6 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 hover:shadow-primary/40 active:scale-95 transition-all group"
                id="fab-report-issue"
            >
                <Icon name="add_circle" className="text-2xl group-hover:rotate-90 transition-transform duration-300" />
                <span className="text-sm">Report Issue</span>
            </Link>
        </div>
    );
}

// ─── Ticket Detail Modal ───
function TicketDetailModal({ ticket, updates, updatesLoading, onClose }) {
    const sevColor = ticket.severityScore >= 8 ? 'text-rose-600' : ticket.severityScore >= 6 ? 'text-amber-600' : ticket.severityScore >= 4 ? 'text-blue-600' : 'text-slate-500';
    const catLabel = CAT_LABEL[ticket.issueCategory || ticket.aiCategory] || 'Unknown';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                                {catLabel}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_CONFIG[ticket.status]?.color || ''}`}>
                                {STATUS_CONFIG[ticket.status]?.label || ticket.status}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Issue Details</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                        <Icon name="close" className="text-xl text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Photo */}
                    {ticket.photoUrl && (
                        <div className="rounded-2xl overflow-hidden aspect-video bg-slate-100 shadow-inner border border-slate-100">
                            <img src={ticket.photoUrl} alt="Issue" className="w-full h-full object-cover" />
                        </div>
                    )}

                    {/* Description */}
                    {ticket.description && (
                        <div className="bg-slate-50 p-4 rounded-xl">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Description</p>
                            <p className="text-sm text-slate-700 leading-relaxed italic">"{ticket.description}"</p>
                        </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Severity</p>
                            <p className={`text-lg font-black ${sevColor}`}>{ticket.severityScore}/10</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Reported</p>
                            <p className="text-sm font-bold text-slate-700">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">City</p>
                            <p className="text-sm font-bold text-slate-700">{ticket.city || 'N/A'}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl col-span-2 sm:col-span-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Assigned Officer</p>
                            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                {ticket.assignedOfficerName ? (
                                    <>
                                        <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                                            {ticket.assignedOfficerName[0]}
                                        </span>
                                        {ticket.assignedOfficerName}
                                    </>
                                ) : (
                                    <span className="text-slate-400">Not yet assigned</span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Live Updates Timeline */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Icon name="update" className="text-primary text-xl" />
                            <h3 className="font-bold text-sm text-slate-800">Live Updates</h3>
                            {updates.length > 0 && (
                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{updates.length}</span>
                            )}
                        </div>

                        {updatesLoading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : updates.length === 0 ? (
                            <div className="bg-slate-50 rounded-2xl p-6 text-center">
                                <Icon name="hourglass_empty" className="text-3xl text-slate-300 mb-2" />
                                <p className="text-sm text-slate-400">No updates yet. The assigned officer will post updates here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {updates.map((u, i) => (
                                    <div key={u._id || i} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                {u.postedByName?.[0] || 'O'}
                                            </div>
                                            {i < updates.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                                        </div>
                                        <div className="bg-white border border-slate-100 rounded-2xl p-4 flex-1 shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-indigo-600">{u.postedByName || 'Officer'}</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700">{u.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
