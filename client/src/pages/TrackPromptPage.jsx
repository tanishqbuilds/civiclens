/**
 * TrackPromptPage — Shown after anonymous ticket submission
 *
 * Flow:
 * 1. User submits an issue anonymously
 * 2. Redirected here with the new ticket ID
 * 3. Offered: "Want to track this complaint? Sign up / Login"
 * 4. If they choose to track → sent to /auth with redirect back
 * 5. After auth, ticket is linked to their account
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { linkTicketToUser, getTicketById } from '../services/api';
import toast from 'react-hot-toast';

function Icon({ name, className = '' }) {
    return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function TrackPromptPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isUserAuthenticated } = useAuth();
    const ticketId = searchParams.get('ticketId');
    const [ticket, setTicket] = useState(null);
    const [linking, setLinking] = useState(false);
    const [linked, setLinked] = useState(false);

    // If user is authenticated AND we have a ticket ID, auto-link the ticket
    useEffect(() => {
        if (isUserAuthenticated && ticketId && !linked) {
            setLinking(true);
            linkTicketToUser(ticketId)
                .then(() => {
                    setLinked(true);
                    toast.success('Ticket linked to your account!');
                    setTimeout(() => {
                        navigate('/dashboard', { replace: true });
                    }, 500);
                })
                .catch(() => {
                    // Might already be linked or ticket not found — non-critical
                    setTimeout(() => {
                        navigate('/dashboard', { replace: true });
                    }, 500);
                })
                .finally(() => setLinking(false));
        }
    }, [isUserAuthenticated, ticketId, linked, navigate]);

    // Fetch ticket details for display
    useEffect(() => {
        if (!ticketId) return;
        getTicketById(ticketId)
            .then((res) => setTicket(res.data.data))
            .catch(() => {});
    }, [ticketId]);

    const categoryLabels = {
        pothole: 'Pothole',
        garbage: 'Garbage Dump',
        broken_streetlight: 'Broken Streetlight',
        waterlogging: 'Waterlogging',
        other: 'Other',
        unclassified: 'Processing…',
    };

    const severityColors = {
        high: 'from-red-500 to-rose-600',
        medium: 'from-amber-500 to-orange-600',
        low: 'from-emerald-500 to-green-600',
    };

    const getSeverityLevel = (score) => {
        if (score >= 7) return 'high';
        if (score >= 4) return 'medium';
        return 'low';
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center font-display bg-[#050816] text-white overflow-hidden px-4">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
                <div className="absolute w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%)', top: '-150px', right: '-100px' }} />
                <div className="absolute w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', bottom: '-100px', left: '-100px' }} />
            </div>

            <div className="relative z-10 w-full max-w-lg">
                {/* Success Banner */}
                <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 sm:p-10 space-y-8 backdrop-blur-sm">
                    {/* Success Icon */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 animate-bounce-slow">
                                <Icon name="check" className="text-4xl text-white" />
                            </div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-3 bg-emerald-500/20 blur-lg rounded-full" />
                        </div>
                        <div className="text-center">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Issue Reported!</h1>
                            <p className="text-sm text-slate-400 mt-2">Your report has been submitted and is being processed by our AI.</p>
                        </div>
                    </div>

                    {/* Ticket Summary Card */}
                    {ticket && (
                        <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Summary</span>
                                <span className="text-[10px] font-mono text-slate-600">#{ticketId?.slice(-8)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="category" className="text-lg text-indigo-400" />
                                    <span className="text-sm font-semibold">{categoryLabels[ticket.aiCategory] || 'Analyzing…'}</span>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${severityColors[getSeverityLevel(ticket.severityScore)]} text-white`}>
                                    Severity: {ticket.severityScore}/10
                                </div>
                            </div>
                            {ticket.description && (
                                <p className="text-xs text-slate-400 line-clamp-2">{ticket.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Icon name="schedule" className="text-sm" />
                                Status: <span className="text-emerald-400 font-semibold capitalize">{ticket.status?.replace('_', ' ')}</span>
                            </div>
                        </div>
                    )}

                    {/* Linking Status */}
                    {isUserAuthenticated && linked && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <Icon name="link" className="text-xl text-emerald-400" />
                            <div>
                                <p className="text-sm font-bold text-emerald-400">Ticket Linked!</p>
                                <p className="text-xs text-slate-400">You can now track this issue from your profile.</p>
                            </div>
                        </div>
                    )}

                    {isUserAuthenticated && linking && (
                        <div className="flex items-center justify-center gap-3 p-4">
                            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-slate-400">Linking ticket to your account…</span>
                        </div>
                    )}

                    {/* Track CTA (only if NOT authenticated) */}
                    {!isUserAuthenticated && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <h2 className="text-lg font-bold">Want to Track This Complaint?</h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    Create an account to monitor the status of your report and get updates.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Link
                                    to={`/auth?mode=signup&redirect=/track?ticketId=${ticketId}`}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all"
                                    id="track-signup-btn"
                                >
                                    <Icon name="person_add" className="text-xl" />
                                    Sign Up to Track
                                </Link>
                                <Link
                                    to={`/auth?mode=login&redirect=/track?ticketId=${ticketId}`}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                                    id="track-login-btn"
                                >
                                    <Icon name="login" className="text-xl" />
                                    Already Have an Account? Sign In
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">or</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {/* Secondary actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate('/report')}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all"
                        >
                            <Icon name="add_circle" className="text-lg" />
                            Report Another Issue
                        </button>
                        <Link
                            to={isUserAuthenticated ? "/dashboard" : "/"}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all"
                        >
                            <Icon name="home" className="text-lg" />
                            Go Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
