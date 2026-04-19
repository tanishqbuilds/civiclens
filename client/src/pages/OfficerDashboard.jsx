/**
 * OfficerDashboard — Dashboard for approved officers
 *
 * Features:
 * ✅ Shows only tickets assigned to the logged-in officer
 * ✅ Status update controls
 * ✅ Live update posting on tickets
 * ✅ Notification bell
 * ✅ Profile circle in navbar
 * ✅ Liquid glass UI
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getTickets, updateTicketStatus, postTicketUpdate, getTicketUpdates, getNotifications, markNotificationsRead } from "../services/api";
import { useAuth } from "../context/AuthContext";

function Icon({ name, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const CAT_LABEL = {
  pothole: "Pothole",
  garbage_dump: "Garbage Dump",
  garbage: "Garbage Dump",
  electrical_hazard: "Electrical Hazard",
  broken_streetlight: "Broken Streetlight",
  waterlogging: "Waterlogging",
  blocked_drain: "Blocked Drain",
  clean_street: "Clean Street",
  other: "Other Issue",
  unclassified: "Unclassified",
};

const STATUS_BADGE = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

const SEV_CONFIG = (s) => {
  if (s >= 8) return { label: "Critical", color: "text-rose-600", bg: "bg-rose-500" };
  if (s >= 6) return { label: "High", color: "text-amber-600", bg: "bg-amber-500" };
  if (s >= 4) return { label: "Medium", color: "text-blue-600", bg: "bg-blue-500" };
  return { label: "Low", color: "text-slate-500", bg: "bg-slate-300" };
};

export default function OfficerDashboard() {
  const { user, userLogout } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketUpdates, setTicketUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const officerId = user?.id || user?._id;

  const fetchTickets = useCallback(async () => {
    try {
      const res = await getTickets({});
      const all = res.data?.data ?? [];
      // Filter to only tickets assigned to this officer
      const myTickets = all.filter(t => String(t.assignedTo) === String(officerId));
      setTickets(myTickets);
    } catch (err) {
      console.error("Fetch tickets error:", err);
    } finally {
      setLoading(false);
    }
  }, [officerId]);

  async function fetchNotifications() {
    try {
      const res = await getNotifications();
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch { }
  }

  useEffect(() => {
    fetchTickets();
    fetchNotifications();
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  async function openTicketDetail(ticket) {
    setSelectedTicket(ticket);
    setUpdatesLoading(true);
    setNewUpdate("");
    try {
      const res = await getTicketUpdates(ticket._id);
      setTicketUpdates(res.data.data || []);
    } catch {
      setTicketUpdates([]);
    } finally {
      setUpdatesLoading(false);
    }
  }

  async function handleStatusChange(ticketId, newStatus) {
    try {
      await updateTicketStatus(ticketId, newStatus);
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      setTickets(prev => prev.map(t => t._id === ticketId ? { ...t, status: newStatus } : t));
      if (selectedTicket?._id === ticketId) setSelectedTicket(prev => ({ ...prev, status: newStatus }));
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handlePostUpdate() {
    if (!newUpdate.trim() || !selectedTicket) return;
    setPostingUpdate(true);
    try {
      const res = await postTicketUpdate(selectedTicket._id, newUpdate.trim());
      setTicketUpdates(res.data.data || []);
      setNewUpdate("");
      toast.success("Update posted!");
    } catch {
      toast.error("Failed to post update");
    } finally {
      setPostingUpdate(false);
    }
  }

  async function handleMarkRead() {
    try {
      await markNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { }
  }

  const handleLogout = () => {
    userLogout();
    navigate("/auth?mode=login");
    toast.success("Logged out");
  };

  // Derived
  const filteredTickets = statusFilter
    ? tickets.filter(t => t.status === statusFilter)
    : tickets;

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] font-display text-slate-900 overflow-x-hidden pb-20">
      <div className="blob blob-a opacity-30" aria-hidden="true" />
      <div className="blob blob-b opacity-20" aria-hidden="true" />

      {/* Header */}
      <header className="relative z-40 w-full glass border-b border-white/40 sticky top-0">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/officer" className="flex items-center gap-2.5">
            <div className="bg-primary text-white rounded-lg w-9 h-9 flex items-center justify-center shadow-md shadow-primary/30">
              <Icon name="shield" className="text-xl" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block leading-tight">CivicLens</span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Officer Portal</span>
            </div>
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
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 z-50">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-sm">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">No notifications</div>
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
                        <p className="text-[10px] text-slate-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
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
              {user?.name?.[0]?.toUpperCase() || 'O'}
            </Link>

            <button onClick={handleLogout} className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-50">
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-5 pt-8 space-y-8">
        {/* Welcome */}
        <section>
          <h1 className="text-2xl font-black tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.jurisdiction?.city && `Jurisdiction: ${user.jurisdiction.city}`}
            {user?.issueCategory && ` · Domain: ${CAT_LABEL[user.issueCategory] || user.issueCategory}`}
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Assigned", value: stats.total, icon: "assignment", color: "text-primary" },
            { label: "Open", value: stats.open, icon: "error", color: "text-red-500" },
            { label: "In Progress", value: stats.in_progress, icon: "engineering", color: "text-amber-500" },
            { label: "Resolved", value: stats.resolved, icon: "check_circle", color: "text-emerald-500" },
          ].map(s => (
            <div key={s.label} className="bg-white/60 backdrop-blur-sm border border-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <Icon name={s.icon} className={`text-xl ${s.color}`} />
                <span className={`text-2xl font-black ${s.color}`}>{s.value}</span>
              </div>
              <p className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-400">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Filter */}
        <section className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Icon name="filter_list" className="text-sm" />
            Filter
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </section>

        {/* Ticket Table */}
        <section className="bg-white/60 backdrop-blur-sm border border-white rounded-2xl shadow-sm overflow-hidden">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center">
              <Icon name="inbox" className="text-4xl text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No tickets assigned yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Issue</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Severity</th>
                    <th className="px-5 py-4">City</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map(t => {
                    const sev = SEV_CONFIG(t.severityScore || 5);
                    return (
                      <tr key={t._id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {t.photoUrl && (
                              <img src={t.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                            )}
                            <p className="text-sm font-medium text-slate-700 line-clamp-1 max-w-[200px]">
                              {t.description || 'No description'}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                            {CAT_LABEL[t.issueCategory || t.aiCategory] || 'Other'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-bold ${sev.color}`}>{t.severityScore}/10</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{t.city || '-'}</td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_BADGE[t.status] || ''}`}>
                            {(t.status || '').replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => openTicketDetail(t)}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <Icon name="visibility" className="text-[14px]" />
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => { setSelectedTicket(null); setTicketUpdates([]); }}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Ticket Details</h2>
                <p className="text-xs text-slate-400 mt-1">ID: {selectedTicket._id}</p>
              </div>
              <button onClick={() => { setSelectedTicket(null); setTicketUpdates([]); }} className="p-2 rounded-xl hover:bg-slate-100">
                <Icon name="close" className="text-xl text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Photo */}
              {selectedTicket.photoUrl && (
                <div className="rounded-2xl overflow-hidden aspect-video bg-slate-100 border border-slate-100">
                  <img src={selectedTicket.photoUrl} alt="Issue" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Category</p>
                  <p className="text-sm font-bold">{CAT_LABEL[selectedTicket.issueCategory || selectedTicket.aiCategory] || 'Other'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Severity</p>
                  <p className={`text-lg font-black ${SEV_CONFIG(selectedTicket.severityScore).color}`}>{selectedTicket.severityScore}/10</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">City</p>
                  <p className="text-sm font-bold">{selectedTicket.city || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Reported</p>
                  <p className="text-sm font-bold">{new Date(selectedTicket.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedTicket.description && (
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Description</p>
                  <p className="text-sm text-slate-700 italic">"{selectedTicket.description}"</p>
                </div>
              )}

              {/* Status Update */}
              <div className="bg-indigo-50 p-4 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-indigo-500 mb-2">Update Status</p>
                <div className="flex gap-2">
                  {['open', 'in_progress', 'resolved'].map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedTicket._id, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedTicket.status === s
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {s.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Updates Timeline */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="update" className="text-primary text-xl" />
                  <h3 className="font-bold text-sm">Live Updates</h3>
                </div>

                {updatesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {ticketUpdates.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">No updates posted yet</p>
                    )}
                    {ticketUpdates.map((u, i) => (
                      <div key={u._id || i} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {u.postedByName?.[0] || 'O'}
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-indigo-600">{u.postedByName || 'Officer'}</span>
                            <span className="text-[10px] text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</span>
                          </div>
                          <p className="text-sm text-slate-700">{u.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Post Update Form */}
                <div className="flex gap-2">
                  <input
                    value={newUpdate}
                    onChange={e => setNewUpdate(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostUpdate(); } }}
                    placeholder="Post an update for the citizen..."
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={handlePostUpdate}
                    disabled={postingUpdate || !newUpdate.trim()}
                    className="px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1"
                  >
                    {postingUpdate ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Icon name="send" className="text-lg" />
                        Post
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close notifications */}
      {showNotifications && (
        <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
      )}
    </div>
  );
}
