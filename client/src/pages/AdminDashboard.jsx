/**
 * AdminDashboard — Liquid Glass Design
 *
 * Features:
 * ✅ Stats cards (total / open / in-progress / resolved)
 * ✅ Sortable & filterable ticket table (severity, status, category, date)
 * ✅ Heatmap map — markers colour-coded by severity score
 * ✅ Ticket detail modal — image, mini-map, status update dropdown
 * ✅ Real-time updates via WebSocket (falls back to 30 s poll on disconnect)
 * ✅ Liquid glass UI design
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import MapView, { severityColor } from "../components/MapView";
import { getTickets, updateTicketStatus, getStats, getAllUsers, approveUser, rejectUser, getNotifications, markNotificationsRead, assignOfficer } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { debugLog } from "../utils/debug";

// ─── Constants ───────────────────────────────────────────────────────────────

const CAT_LABEL = {
  pothole: "Pothole",
  garbage: "Garbage Dump",
  broken_streetlight: "Broken Streetlight",
  waterlogging: "Waterlogging",
  other: "Other Issue",
  unclassified: "Unclassified",
};

const CAT_ICON = {
  pothole: "pothole",
  garbage: "delete",
  broken_streetlight: "lightbulb",
  waterlogging: "water_drop",
  other: "warning",
  unclassified: "help",
};

const SEV_CONFIG = (s) => {
  if (s >= 8)
    return {
      label: "Critical",
      color: "bg-rose-500",
      ring: "ring-rose-500/20",
      text: "text-rose-600",
    };
  if (s >= 6)
    return {
      label: "High",
      color: "bg-amber-500",
      ring: "ring-amber-500/20",
      text: "text-amber-600",
    };
  if (s >= 4)
    return {
      label: "Medium",
      color: "bg-blue-500",
      ring: "ring-blue-500/20",
      text: "text-blue-600",
    };
  return {
    label: "Low",
    color: "bg-slate-300",
    ring: "ring-slate-400/10",
    text: "text-slate-500",
  };
};

const STATUS_BADGE = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

const REFRESH_MS = 30_000; // fallback poll when WS is disconnected

const PROD_API_BASE = "https://d3coujrx9zr1yv.cloudfront.net";

// Build WebSocket URL with a direct backend target for local dev.
function getWsUrl() {
  // Bypass Vite's ws proxy in local dev to avoid ECONNABORTED proxy noise.
  if (import.meta.env.DEV) {
    return "ws://localhost:3001/ws";
  }

  const apiBase = import.meta.env.VITE_API_BASE || PROD_API_BASE;
  const apiUrl = new URL(apiBase);
  const wsProto = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${apiUrl.host}/ws`;
}

// ─── Icon helper ─────────────────────────────────────────────────────────────

function Icon({ name, className = "" }) {
  return (
    <span className={`material-symbols-outlined ${className}`}>{name}</span>
  );
}

// ─── AdminDashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const { logout, admin } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [wsState, setWsState] = useState('connecting'); // 'connecting'|'open'|'closed'
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    sort: "-severityScore",
  });
  const [activeTab, setActiveTab] = useState('tickets');
  const [users, setUsers] = useState([]);
  const [userFilters, setUserFilters] = useState({ role: '', city: '' });
  const [bounds, setBounds] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const debounceRef = useRef(null);
  const wsRef = useRef(null);
  const wsRetryRef = useRef(null);

  // Admin notifications
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [adminUnread, setAdminUnread] = useState(0);
  const [showAdminNotifs, setShowAdminNotifs] = useState(false);

  // Jurisdiction-derived map props
  const jurisdiction = admin?.jurisdiction ?? null;
  const mapCenter = jurisdiction ? jurisdiction.center : [72.8777, 19.076];
  const mapZoom = jurisdiction ? 11 : 8;

  // Debounced bounds change handler
  const handleBoundsChange = useCallback((newBounds) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBounds(newBounds), 300);
  }, []);

  // ── Data fetching ──
  const fetchAll = useCallback(async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.sort) params.sort = filters.sort;

      // Jurisdiction radius filter (server-side)
      if (jurisdiction) {
        params.lng = jurisdiction.center[0];
        params.lat = jurisdiction.center[1];
        params.radiusKm = jurisdiction.radiusKm;
      }

      // Viewport bounding box (refine within jurisdiction)
      if (bounds) {
        params.minLng = bounds.minLng;
        params.maxLng = bounds.maxLng;
        params.minLat = bounds.minLat;
        params.maxLat = bounds.maxLat;
      }

      const ticketsRes = await getTickets(params);
      const data = ticketsRes.data?.data ?? [];
      setTickets(data);
      
      try {
        const usRes = await getAllUsers();
        setUsers(usRes.data.data || []);
      } catch (err) {
        debugLog('fetchAllUsers:error', err?.message);
      }

      // Fetch real stats from server (not affected by pagination)
      try {
        const statsRes = await getStats();
        const s = statsRes.data?.data ?? statsRes.data;
        setStats({ total: s.total, byStatus: s.byStatus });
      } catch {
        // Fallback to counting from current page
        setStats({
          total: data.length,
          byStatus: {
            open: data.filter((t) => t.status === "open").length,
            in_progress: data.filter((t) => t.status === "in_progress").length,
            resolved: data.filter((t) => t.status === "resolved").length,
          },
        });
      }
      debugLog('fetchAll', { count: data.length, params });
    } catch (err) {
      debugLog('fetchAll:error', err?.message);
    } finally {
      setLoading(false);
    }
  }, [filters, jurisdiction, bounds]);

  // ── Build admin notifications from data ──
  useEffect(() => {
    const notifs = [];
    // Pending officer registrations
    const pending = users.filter(u => u.role === 'officer' && u.status === 'pending');
    pending.forEach(u => {
      notifs.push({
        _id: `pending-${u._id}`,
        message: `New officer registration: ${u.name} (${u.jurisdiction?.city || 'unknown city'})`,
        type: 'pending_officer',
        userId: u._id,
        createdAt: u.createdAt,
        read: false,
      });
    });
    // Recent tickets (last 20)
    const recent = [...tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
    recent.forEach(t => {
      notifs.push({
        _id: `ticket-${t._id}`,
        message: `New ${(t.issueCategory || t.aiCategory || 'issue').replace('_', ' ')} reported in ${t.city || 'unknown area'}`,
        type: 'new_ticket',
        ticketId: t._id,
        createdAt: t.createdAt,
        read: false,
      });
    });
    notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setAdminNotifications(notifs.slice(0, 30));
    setAdminUnread(pending.length + Math.min(recent.length, 5));
  }, [tickets, users]);

  // ── WebSocket real-time updates ─────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;

    let retries = 0;

    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      setWsState('connecting');

      ws.onopen = () => {
        retries = 0;
        setWsState('open');
        debugLog('ws:open', getWsUrl());
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          debugLog('ws:message', msg); // visible in DevTools with ?debug=1
          if (msg.type === 'new_ticket') {
            // Prepend new ticket to state without a full fetch
            setTickets((prev) => {
              if (prev.some((t) => t.id === msg.payload.id || t._id === msg.payload._id)) return prev;
              return [msg.payload, ...prev];
            });
            setStats((prev) => prev ? {
              ...prev,
              total: prev.total + 1,
              byStatus: { ...prev.byStatus, open: (prev.byStatus.open || 0) + 1 },
            } : prev);
            toast('New issue reported', { icon: '📍', duration: 3000 });
          } else if (msg.type === 'ticket_updated') {
            const { id, status } = msg.payload;
            setTickets((prev) =>
              prev.map((t) => (t._id === id || t.id === id) ? { ...t, status } : t)
            );
            setSelectedTicket((prev) => prev && (prev._id === id || prev.id === id) ? { ...prev, status } : prev);
          }
          // 'ping' messages are intentionally ignored
        } catch {}
      };

      ws.onclose = () => {
        if (destroyed) return;
        setWsState('closed');
        const delay = Math.min(1000 * 2 ** retries, 30000);
        retries++;
        debugLog('ws:closed — reconnecting in', delay, 'ms');
        wsRetryRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        debugLog('ws:error');
        ws.close();
      };
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(wsRetryRef.current);
      wsRef.current?.close();
    };
  }, []); // Only connect once on mount

  // ── Initial data fetch + fallback poll when WS disconnected ──────────
  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // Fallback poll: only active while WebSocket is disconnected
  useEffect(() => {
    if (wsState === 'open') return; // WS connected — no need to poll
    const timer = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchAll, wsState]);

  // ── Status update ──
  const handleStatusChange = async (id, newStatus) => {
    setUpdatingStatus(true);
    try {
      await updateTicketStatus(id, newStatus);
      setTickets((prev) =>
        prev.map((t) => (t._id === id || t.id === id) ? { ...t, status: newStatus } : t),
      );
      if (selectedTicket?._id === id || selectedTicket?.id === id) {
        setSelectedTicket((prev) => ({ ...prev, status: newStatus }));
      }
      toast.success("Status updated!");
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Assign Officer ──
  const handleAssignOfficer = async (ticketId, officerId) => {
    try {
      const res = await assignOfficer(ticketId, officerId);
      const updatedTicket = res.data.data;
      setTickets((prev) =>
        prev.map((t) => (t._id === ticketId || t.id === ticketId) ? updatedTicket : t),
      );
      if (selectedTicket?._id === ticketId || selectedTicket?.id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
      toast.success("Officer assigned successfully!");
    } catch {
      toast.error("Failed to assign officer.");
    }
  };

  // ── Map markers ──
  const mapMarkers = useMemo(
    () =>
      tickets
        .filter((t) => t.location?.coordinates?.length === 2)
        .filter((t) => showResolved || t.status !== 'resolved')
        .map((t) => ({
          lng: t.location.coordinates[0],
          lat: t.location.coordinates[1],
          severity: t.severityScore,
          popup: `
                        <div style="font-size:12px;line-height:1.5">
                            <strong>${(t.aiCategory ?? "").replace("_", " ")}</strong><br/>
                            Severity: <strong>${t.severityScore}/10</strong><br/>
                            Status: ${(t.status ?? "").replace("_", " ")}
                        </div>`,
          onClick: () => setSelectedTicket(t),
        })),
    [tickets, showResolved],
  );

  const totalTickets = stats?.total ?? 0;
  const openCount = stats?.byStatus?.open ?? 0;
  const inProgressCount = stats?.byStatus?.in_progress ?? 0;
  const resolvedCount = stats?.byStatus?.resolved ?? 0;

  // ─── Render ───
  return (
    <div className="relative min-h-screen font-display bg-[#f6f6f8] text-slate-900">
      {/* Background decorative blurs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between liquid-glass rounded-xl px-6 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg shadow-lg shadow-primary/20">
                <Icon name="account_balance" className="text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                Civic Admin Portal
                {jurisdiction && (
                  <span className="ml-2 text-sm font-medium text-primary">
                    — {jurisdiction.city}
                  </span>
                )}
              </h1>
            </div>
                
          </div>
          <div className="flex items-center gap-4">
            {/* Admin Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowAdminNotifs(!showAdminNotifs); if (!showAdminNotifs) setAdminUnread(0); }}
                className="liquid-glass p-2 rounded-lg hover:bg-white/60 transition-colors flex items-center justify-center relative"
                title="Notifications"
              >
                <Icon name="notifications" className="text-primary" />
                {adminUnread > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {adminUnread > 9 ? '9+' : adminUnread}
                  </span>
                )}
              </button>
              {showAdminNotifs && (
                <div className="absolute right-0 top-12 w-96 max-h-[500px] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 z-50">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-sm">Admin Notifications</h3>
                    <span className="text-[10px] text-slate-400">{adminNotifications.length} total</span>
                  </div>
                  {adminNotifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">No notifications</div>
                  ) : (
                    adminNotifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => {
                          setShowAdminNotifs(false);
                          if (n.type === 'pending_officer') {
                            setActiveTab('users');
                          } else if (n.type === 'new_ticket' && n.ticketId) {
                            setActiveTab('tickets');
                            const t = tickets.find(t => String(t._id) === String(n.ticketId));
                            if (t) setSelectedTicket(t);
                          }
                        }}
                        className="px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <Icon
                            name={n.type === 'pending_officer' ? 'person_add' : 'report'}
                            className={`text-lg flex-shrink-0 mt-0.5 ${n.type === 'pending_officer' ? 'text-amber-500' : 'text-primary'}`}
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{n.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              onClick={fetchAll}
              className="liquid-glass p-2 rounded-lg hover:bg-white/60 transition-colors flex items-center justify-center"
              title="Refresh now"
            >
              <Icon name="refresh" className="text-primary" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold">Admin Panel</p>
                <p className="text-[10px] text-slate-500">
                  {wsState === 'open' ? '● Live' : `Auto-refresh ${Math.round(REFRESH_MS / 1000)}s`}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-white flex items-center justify-center">
                <Icon
                  name="shield_person"
                  className="text-primary text-[20px]"
                />
              </div>
              <button
                onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}
                className="liquid-glass p-2 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center"
                title="Logout"
              >
                <Icon name="logout" className="text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-6 pb-12 space-y-6">
        {/* ── Tabs ── */}
        <div className="flex gap-6 border-b border-slate-200">
           <button onClick={() => setActiveTab('tickets')} className={`pb-3 font-bold text-sm transition-colors ${activeTab === 'tickets' ? 'border-b-2 border-primary text-primary' : 'text-slate-400 hover:text-slate-600'}`}>Tickets Dashboard</button>
           <button onClick={() => setActiveTab('users')} className={`pb-3 font-bold text-sm transition-colors ${activeTab === 'users' ? 'border-b-2 border-primary text-primary' : 'text-slate-400 hover:text-slate-600'}`}>User Management</button>
           <button onClick={() => setActiveTab('analytics')} className={`pb-3 font-bold text-sm transition-colors flex items-center gap-1.5 ${activeTab === 'analytics' ? 'border-b-2 border-primary text-primary' : 'text-slate-400 hover:text-slate-600'}`}><Icon name="analytics" className="text-[18px]" />Analytics</button>
        </div>

        {activeTab === 'tickets' && (
          <div className="space-y-6">
        {/* ── Metrics Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Issues"
            value={totalTickets}
            icon="description"
            iconBg="bg-slate-100 text-slate-600"
            accent="hover:border-primary/30"
            barColor="bg-primary"
            barPct={100}
          />
          <StatCard
            label="Open"
            value={openCount}
            icon="pending_actions"
            iconBg="bg-amber-50 text-amber-600"
            accent="hover:border-amber-400/30"
            barColor="bg-amber-400"
            barPct={
              totalTickets ? Math.round((openCount / totalTickets) * 100) : 0
            }
          />
          <StatCard
            label="In Progress"
            value={inProgressCount}
            icon="engineering"
            iconBg="bg-blue-50 text-blue-600"
            accent="hover:border-blue-400/30"
            barColor="bg-blue-400"
            barPct={
              totalTickets
                ? Math.round((inProgressCount / totalTickets) * 100)
                : 0
            }
          />
          <StatCard
            label="Resolved"
            value={resolvedCount}
            icon="check_circle"
            iconBg="bg-emerald-50 text-emerald-600"
            accent="hover:border-emerald-400/30"
            barColor="bg-emerald-400"
            barPct={
              totalTickets
                ? Math.round((resolvedCount / totalTickets) * 100)
                : 0
            }
          />
        </div>

        {/* ── Split Layout: Table + Map ── */}
        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* Left: Filter & Table (70%) */}
          <div className="lg:w-[70%] space-y-0">
            <div className="liquid-glass rounded-xl overflow-hidden flex flex-col h-full">
              {/* Filter Bar */}
              <div className="p-4 border-b border-slate-200/50 flex flex-wrap gap-4 items-center justify-between bg-white/10">
                <div className="flex gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                    <Icon name="filter_list" className="text-sm" />
                    Filter
                  </div>
                  <FilterSelect
                    value={filters.status}
                    onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                  >
                    <option value="">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </FilterSelect>
                  <FilterSelect
                    value={filters.category}
                    onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
                  >
                    <option value="">All Categories</option>
                    <option value="pothole">Pothole</option>
                    <option value="garbage">Garbage</option>
                    <option value="broken_streetlight">Streetlight</option>
                    <option value="waterlogging">Waterlogging</option>
                    <option value="other">Other</option>
                  </FilterSelect>
                  <FilterSelect
                    value={filters.sort}
                    onChange={(v) => setFilters((f) => ({ ...f, sort: v }))}
                  >
                    <option value="-severityScore">
                      Severity (High first)
                    </option>
                    <option value="severityScore">Severity (Low first)</option>
                    <option value="-createdAt">Newest first</option>
                    <option value="createdAt">Oldest first</option>
                  </FilterSelect>
                  {(filters.status || filters.category) && (
                    <button
                      onClick={() =>
                        setFilters({
                          status: "",
                          category: "",
                          sort: "-severityScore",
                        })
                      }
                      className="text-xs text-slate-400 hover:text-primary underline ml-1"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="text-slate-400 text-sm">
                  Showing{" "}
                  <span className="text-slate-900 font-bold">
                    {tickets.length}
                  </span>{" "}
                  report{tickets.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Data Table */}
              {loading ? (
                <TableSkeleton />
              ) : tickets.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Issue ID</th>
                        <th className="px-6 py-4">Title & Location</th>
                        <th className="px-6 py-4">Severity</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tickets.map((t) => (
                        <tr
                          key={t._id}
                          onClick={() => setSelectedTicket(t)}
                          className="hover:bg-primary/5 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4 font-mono text-sm text-slate-400">
                            #{t._id?.slice(-6).toUpperCase() ?? "------"}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-sm">
                              {CAT_LABEL[t.aiCategory] ?? "Unknown Issue"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {t.description
                                ? t.description.length > 50
                                  ? t.description.slice(0, 50) + "…"
                                  : t.description
                                : t.location?.coordinates
                                  ? `${t.location.coordinates[1]?.toFixed(4)}, ${t.location.coordinates[0]?.toFixed(4)}`
                                  : "No location"}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <SeverityDot score={t.severityScore} />
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {(t.status ?? "")
                                .replace("_", " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                              <Icon
                                name="visibility"
                                className="text-slate-400 group-hover:text-primary text-[20px]"
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right: Issue Heatmap (30%) */}
          <div className="lg:w-[30%] space-y-6">
            <div className="liquid-glass rounded-xl overflow-hidden h-full flex flex-col">
              <div className="p-5 flex items-center justify-between border-b border-slate-200/50 bg-white/10">
                <h3 className="font-bold">Live Heatmap</h3>
                <div className="flex gap-3 items-center">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-[10px] font-medium text-slate-500">Resolved</span>
                    <button
                      role="switch"
                      aria-checked={showResolved}
                      onClick={() => setShowResolved((v) => !v)}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                        showResolved ? 'bg-emerald-400' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                          showResolved ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Live
                  </span>
                </div>
              </div>
              <div className="flex-1 relative min-h-[400px]">
                <MapView
                  center={mapCenter}
                  zoom={mapZoom}
                  markers={mapMarkers}
                  onBoundsChange={handleBoundsChange}
                  interactive
                />
                {/* Heatmap Legend Overlay */}
                <div className="absolute bottom-4 left-4 right-4 liquid-glass p-4 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      Incident Density
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-2 rounded-l-full bg-emerald-400" />
                    <div className="flex-1 h-2 bg-blue-400" />
                    <div className="flex-1 h-2 bg-amber-400" />
                    <div className="flex-1 h-2 rounded-r-full bg-rose-500" />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Low</span>
                    <span>Critical</span>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-3 border-t border-slate-200/50">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Severity Breakdown
                </h4>
                <HotspotRow
                  color="bg-rose-500"
                  label="Critical Issues"
                  detail={`${tickets.filter((t) => t.severityScore >= 8).length} active`}
                  iconName="trending_up"
                  iconColor="text-rose-400"
                  bg="bg-rose-50"
                />
                <HotspotRow
                  color="bg-emerald-400"
                  label="Resolved Today"
                  detail={`${tickets.filter((t) => t.status === "resolved").length} total`}
                  iconName="check"
                  iconColor="text-emerald-400"
                  bg="bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>
        </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Pending Officers Section */}
            {(() => {
              const pendingOfficers = users.filter(u => u.role === 'officer' && u.status === 'pending');
              if (pendingOfficers.length === 0) return null;
              return (
                <div className="liquid-glass rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-amber-200/50 bg-amber-50/50 flex items-center gap-3">
                    <Icon name="pending_actions" className="text-amber-600 text-xl" />
                    <h3 className="font-bold text-sm text-amber-800">Pending Officer Approvals ({pendingOfficers.length})</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {pendingOfficers.map(u => (
                      <div key={u._id} className="p-5 flex flex-col sm:flex-row items-start gap-4 hover:bg-amber-50/30 transition-colors">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800">{u.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">PENDING</span>
                          </div>
                          <p className="text-xs text-slate-500">{u.email}</p>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                            <span className="flex items-center gap-1"><Icon name="location_city" className="text-[14px] text-primary" />{u.jurisdiction?.city || '-'}</span>
                            <span className="flex items-center gap-1"><Icon name="category" className="text-[14px] text-primary" />{u.issueCategory?.replace('_', ' ') || '-'}</span>
                            <span className="flex items-center gap-1"><Icon name="apartment" className="text-[14px] text-primary" />{u.department || '-'}</span>
                          </div>
                          {u.idProofUrl && (
                            <a href={u.idProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline mt-1">
                              <Icon name="description" className="text-[14px]" /> View ID Proof Document
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={async () => {
                              try {
                                await approveUser(u._id);
                                toast.success(`${u.name} approved`);
                                const usRes = await getAllUsers();
                                setUsers(usRes.data.data || []);
                              } catch { toast.error('Failed to approve'); }
                            }}
                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1"
                          >
                            <Icon name="check" className="text-[16px]" /> Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await rejectUser(u._id);
                                toast.success(`${u.name} rejected`);
                                const usRes = await getAllUsers();
                                setUsers(usRes.data.data || []);
                              } catch { toast.error('Failed to reject'); }
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-1"
                          >
                            <Icon name="close" className="text-[16px]" /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* All Users Table */}
            <div className="liquid-glass rounded-xl overflow-hidden shadow-sm flex flex-col" style={{ maxHeight: '700px' }}>
             <div className="p-4 border-b border-slate-200/50 flex flex-wrap gap-4 items-center justify-between bg-white/10">
                <div className="flex gap-3 flex-wrap">
                   <div className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                     <Icon name="filter_list" className="text-sm" />
                     Filter Users
                   </div>
                   <FilterSelect value={userFilters.role} onChange={(v) => setUserFilters((f) => ({ ...f, role: v }))}>
                      <option value="">All Roles</option>
                      <option value="citizen">Citizen</option>
                      <option value="officer">Officer</option>
                   </FilterSelect>
                   <FilterSelect value={userFilters.city} onChange={(v) => setUserFilters((f) => ({ ...f, city: v }))}>
                      <option value="">All Cities</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Navi Mumbai">Navi Mumbai</option>
                      <option value="Panvel">Panvel</option>
                      <option value="Vashi">Vashi</option>
                      <option value="Wadala">Wadala</option>
                      <option value="Chunabhatti">Chunabhatti</option>
                      <option value="Thane">Thane</option>
                      <option value="Kalyan">Kalyan</option>
                   </FilterSelect>
                </div>
             </div>
             <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">City</th>
                        <th className="px-6 py-4">Domain</th>
                        <th className="px-6 py-4">Contact</th>
                        <th className="px-6 py-4">ID Proof</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users
                         .filter((u) => (userFilters.role ? u.role === userFilters.role : true) && (userFilters.city ? (u.jurisdiction?.city === userFilters.city) : true))
                         .map((u) => (
                        <tr key={u._id} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-sm">
                            {u.name}
                            <div className="text-xs text-slate-500 font-normal">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'officer' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                               {(u.role || 'citizen').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              u.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              u.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              u.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                               {(u.status || 'approved').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">{u.jurisdiction?.city || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{u.issueCategory?.replace('_', ' ') || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{u.phone || '-'}</td>
                          <td className="px-6 py-4">
                            {u.idProofUrl ? (
                               <a href={u.idProofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1 font-semibold">
                                 <Icon name="visibility" className="text-[14px]" /> View ID
                               </a>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                </table>
             </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPanel tickets={tickets} users={users} />
        )}
      </main>

      {/* ── Ticket Detail Modal ── */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={handleStatusChange}
          isUpdating={updatingStatus}
          users={users}
          onAssignOfficer={handleAssignOfficer}
        />
      )}

      {/* Click outside to close admin notifications */}
      {showAdminNotifs && (
        <div className="fixed inset-0 z-30" onClick={() => setShowAdminNotifs(false)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, iconBg, accent, barColor, barPct }) {
  return (
    <div
      className={`liquid-glass p-5 rounded-xl group transition-all ${accent}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon name={icon} />
        </div>
      </div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <h2 className="text-3xl font-bold mt-1">{value}</h2>
      <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: barPct != null ? `${barPct}%` : "100%" }}
        />
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer border-none focus:ring-2 focus:ring-primary"
    >
      {children}
    </select>
  );
}

function SeverityDot({ score }) {
  const cfg = SEV_CONFIG(score);
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${cfg.color} ring-4 ${cfg.ring}`} />
      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}

function HotspotRow({ color, label, detail, iconName, iconColor, bg }) {
  return (
    <div className={`flex items-center gap-4 p-3 ${bg} rounded-lg`}>
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <div className="flex-1">
        <p className="text-xs font-bold">{label}</p>
        <p className="text-[10px] text-slate-500">{detail}</p>
      </div>
      <Icon name={iconName} className={iconColor} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center text-slate-500">
      <Icon name="inbox" className="text-5xl text-slate-300 mb-3" />
      <p className="font-medium">No reports match your filters</p>
      <p className="text-xs mt-1">Try clearing the filters or refreshing</p>
    </div>
  );
}

// ─── TicketModal ──────────────────────────────────────────────────────────────

function TicketModal({ ticket, onClose, onStatusChange, isUpdating, users, onAssignOfficer }) {
  const [status, setStatus] = useState(ticket.status);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const availableOfficers = users?.filter(
    (u) =>
      u.role === "officer" &&
      u.status === "approved" &&
      (!ticket.city || u.jurisdiction?.city === ticket.city)
  ) || [];

  const hasCoords = ticket.location?.coordinates?.length === 2;
  const [lng, lat] = hasCoords ? ticket.location.coordinates : [null, null];

  const miniMarkers = hasCoords
    ? [{ lng, lat, severity: ticket.severityScore }]
    : [];

  const handleSave = () => {
    if (status !== ticket.status) onStatusChange(ticket._id, status);
  };

  const sevCfg = SEV_CONFIG(ticket.severityScore);
  const ticketId = ticket._id?.slice(-4).toUpperCase() ?? "----";
  const catLabel = CAT_LABEL[ticket.aiCategory] ?? "Unknown Issue";
  const reportedAt = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        month: "short",
        day: "numeric",
      })
    : "Unknown";

  const STATUS_SELECT_STYLE = {
    open: "bg-amber-100 text-amber-700",
    in_progress: "bg-blue-100 text-blue-700",
    resolved: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-slate-900/20 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Main Modal Container */}
      <div
        className="liquid-glass w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200/50 bg-white/10">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase">
                {catLabel}
              </span>
              <span className="text-slate-400 font-mono text-xs">
                #{ticketId}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {catLabel}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-200/50 transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto bg-white/5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* Left Column: Photo & Report */}
            <div className="lg:col-span-7 p-8 border-r border-slate-200/50">
              <div className="space-y-8">
                {/* Photo */}
                <div className="group relative overflow-hidden rounded-xl bg-slate-100 aspect-video shadow-inner border border-slate-200/50">
                  {ticket.photoUrl ? (
                    <img
                      alt="Reported issue"
                      className="w-full h-full object-cover"
                      src={ticket.photoUrl}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-medium text-slate-500">
                      No Azure image URL for this ticket.
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <span className="text-white text-xs font-medium flex items-center gap-1">
                      <Icon name="zoom_in" className="text-sm" /> Click to
                      enlarge
                    </span>
                  </div>
                </div>

                {/* Citizen Report */}
                {ticket.description && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Citizen Report
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-sm bg-white/40 p-5 rounded-xl border border-white/50 italic shadow-sm">
                      "{ticket.description}"
                    </p>
                  </div>
                )}

                {/* AI Classification badge */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    AI Classification
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                      {catLabel}
                    </span>
                    {(ticket.aiConfidence ?? 0) > 0 ? (
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {((ticket.aiConfidence ?? 0) * 100).toFixed(0)}%
                        confidence
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Human Fallback
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Map & Metadata */}
            <div className="lg:col-span-5 p-8 flex flex-col gap-8">
              {/* Mini Map */}
              {hasCoords && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Incident Location
                    </h3>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Icon name="location_on" className="text-xs" />
                      {lat.toFixed(4)}, {lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="rounded-xl overflow-hidden h-48 border border-slate-200/60 relative shadow-sm">
                    <MapView
                      center={[lng, lat]}
                      zoom={14}
                      markers={miniMarkers}
                      interactive={false}
                    />
                  </div>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Time Reported
                  </p>
                  <div className="flex items-center gap-2">
                    <Icon
                      name="schedule"
                      className="text-base text-slate-400"
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      {reportedAt}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Category
                  </p>
                  <div className="flex items-center gap-2">
                    <Icon
                      name={CAT_ICON[ticket.aiCategory] ?? "warning"}
                      className="text-base text-primary"
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      {catLabel}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Severity
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${sevCfg.color} ring-4 ${sevCfg.ring}`}
                    />
                    <span className={`text-xs font-bold ${sevCfg.text}`}>
                      {sevCfg.label} ({ticket.severityScore}/10)
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Current Status
                  </p>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[ticket.status] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {(ticket.status ?? "")
                      .replace("_", " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-8 py-5 border-t border-slate-200/50 bg-white/20 flex flex-wrap items-center justify-between gap-4">
          {/* Dropdown Selects */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status
              </label>
              <div className={`relative rounded-full px-1 ${STATUS_SELECT_STYLE[status]}`}>
  <select
    value={status}
    onChange={(e) => setStatus(e.target.value)}
    className="appearance-none bg-transparent w-full pl-3 pr-8 py-2 text-xs font-bold border-none focus:outline-none"
  >
     <option value="open" className="text-amber-800 font-semibold">
    Open
  </option>

  <option value="in_progress" className="text-blue-800 font-semibold">
    In Progress
  </option>

  <option value="resolved" className="text-emerald-800 font-semibold">
    Resolved
  </option>
  </select>
 <Icon
                  name="expand_more"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                /></div>
            </div>

            {/* Officer Assignment Dropdown */}
            <div className="flex flex-col gap-1.5 border-l border-slate-200/50 pl-6">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {ticket.assignedTo ? "Assigned Officer" : "Assign Officer"}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative rounded-full px-1 bg-slate-100 text-slate-700 min-w-[160px]">
                  <select
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    className="appearance-none bg-transparent w-full pl-3 pr-8 py-2 text-xs font-bold border-none focus:outline-none"
                  >
                    <option value="" disabled>
                      {ticket.assignedOfficerName || "Select Officer..."}
                    </option>
                    {availableOfficers.map((o) => (
                      <option key={o._id} value={o._id} className="text-slate-800 font-semibold">
                        {o.name} ({o.issueCategory?.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="expand_more"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                  />
                </div>
                {selectedOfficerId && (
                  <button
                    onClick={() => {
                      onAssignOfficer(ticket._id, selectedOfficerId);
                      setSelectedOfficerId("");
                    }}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors"
                  >
                    Assign
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white/50 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-all"
            >
              <Icon name="close" className="text-lg" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isUpdating || status === ticket.status}
              className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary/90 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="save" className="text-lg" />
              {isUpdating ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AnalyticsPanel ──────────────────────────────────────────────────────────

const ANALYTICS_CAT_COLORS = {
  pothole: { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50', hex: '#f97316' },
  garbage_dump: { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50', hex: '#10b981' },
  electrical_hazard: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50', hex: '#eab308' },
  waterlogging: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', hex: '#3b82f6' },
  blocked_drain: { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-50', hex: '#a855f7' },
  clean_street: { bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50', hex: '#14b8a6' },
  unclassified: { bg: 'bg-slate-400', text: 'text-slate-500', light: 'bg-slate-50', hex: '#94a3b8' },
};

const ANALYTICS_CAT_LABEL = {
  pothole: 'Pothole',
  garbage_dump: 'Garbage Dump',
  electrical_hazard: 'Electrical Hazard',
  waterlogging: 'Waterlogging',
  blocked_drain: 'Blocked Drain',
  clean_street: 'Clean Street',
  unclassified: 'Unclassified',
};

function AnalyticsPanel({ tickets, users }) {
  // ── City-wise Complaints ──
  const cityData = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const city = t.city || 'Unknown';
      map[city] = (map[city] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [tickets]);

  const maxCityCount = cityData.length > 0 ? cityData[0][1] : 1;

  // ── Category Breakdown ──
  const categoryData = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const cat = t.aiCategory || 'unclassified';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  // ── Officer Leaderboard ──
  const officerLeaderboard = useMemo(() => {
    const resolvedByOfficer = {};
    const assignedByOfficer = {};
    tickets.forEach((t) => {
      if (t.assignedTo) {
        const name = t.assignedOfficerName || t.assignedTo;
        assignedByOfficer[name] = (assignedByOfficer[name] || 0) + 1;
        if (t.status === 'resolved') {
          resolvedByOfficer[name] = (resolvedByOfficer[name] || 0) + 1;
        }
      }
    });
    return Object.entries(assignedByOfficer)
      .map(([name, assigned]) => ({
        name,
        assigned,
        resolved: resolvedByOfficer[name] || 0,
        rate: assigned > 0 ? Math.round(((resolvedByOfficer[name] || 0) / assigned) * 100) : 0,
      }))
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 8);
  }, [tickets]);

  // ── Severity Distribution across cities ──
  const citySeverity = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const city = t.city || 'Unknown';
      if (!map[city]) map[city] = { sum: 0, count: 0, critical: 0 };
      map[city].sum += t.severityScore || 0;
      map[city].count++;
      if (t.severityScore >= 8) map[city].critical++;
    });
    return Object.entries(map)
      .map(([city, d]) => ({
        city,
        avg: d.count > 0 ? Math.round((d.sum / d.count) * 10) / 10 : 0,
        critical: d.critical,
        total: d.count,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [tickets]);

  // ── Overall Resolution Stats ──
  const resolutionStats = useMemo(() => {
    const total = tickets.length;
    const resolved = tickets.filter((t) => t.status === 'resolved').length;
    const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
    const open = tickets.filter((t) => t.status === 'open').length;
    const avgSeverity = total > 0
      ? Math.round((tickets.reduce((s, t) => s + (t.severityScore || 0), 0) / total) * 10) / 10
      : 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const citizenCount = users.filter((u) => u.role === 'citizen').length;
    const officerCount = users.filter((u) => u.role === 'officer' && u.status === 'approved').length;
    return { total, resolved, inProgress, open, avgSeverity, resolutionRate, citizenCount, officerCount };
  }, [tickets, users]);

  // ── 7-Day Trend ──
  const weeklyTrend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const count = tickets.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= day && created < next;
      }).length;
      return {
        label: day.toLocaleDateString(undefined, { weekday: 'short' }),
        date: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count,
      };
    });
  }, [tickets]);

  const maxTrendCount = Math.max(1, ...weeklyTrend.map((d) => d.count));

  // ── City-wise Status Breakdown ──
  const cityStatusBreakdown = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const city = t.city || 'Unknown';
      if (!map[city]) map[city] = { open: 0, in_progress: 0, resolved: 0, total: 0 };
      map[city].total++;
      if (t.status in map[city]) map[city][t.status]++;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6);
  }, [tickets]);

  // Donut chart styles for category breakdown
  const totalForDonut = tickets.length || 1;
  const donutSegments = useMemo(() => {
    let accum = 0;
    return categoryData.map(([cat, count]) => {
      const pct = (count / totalForDonut) * 100;
      const start = accum;
      accum += pct;
      return { cat, count, pct, start, color: ANALYTICS_CAT_COLORS[cat]?.hex || '#94a3b8' };
    });
  }, [categoryData, totalForDonut]);

  const conicGradient = donutSegments.length > 0
    ? donutSegments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ')
    : '#e2e8f0 0% 100%';

  return (
    <div className="space-y-6">
      {/* ── Row 1: Key Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniMetricCard icon="description" label="Total Complaints" value={resolutionStats.total} color="bg-primary/10 text-primary" />
        <MiniMetricCard icon="check_circle" label="Resolution Rate" value={`${resolutionStats.resolutionRate}%`} color="bg-emerald-50 text-emerald-600" />
        <MiniMetricCard icon="groups" label="Active Citizens" value={resolutionStats.citizenCount} color="bg-blue-50 text-blue-600" />
        <MiniMetricCard icon="shield_person" label="Active Officers" value={resolutionStats.officerCount} color="bg-indigo-50 text-indigo-600" />
      </div>

      {/* ── Row 2: City-wise Complaints + Category Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* City-wise Complaints */}
        <div className="lg:col-span-7 liquid-glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 bg-white/10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon name="location_city" className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm">City-wise Complaints</h3>
              <p className="text-[10px] text-slate-400">Complaint volume by city</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {cityData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No data available</p>
            ) : (
              cityData.map(([city, count], i) => (
                <div key={city} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                      <span className="text-sm font-semibold text-slate-700">{city}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{count}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.round((count / maxCityCount) * 100)}%`,
                        background: `linear-gradient(90deg, #6366f1 0%, #818cf8 ${Math.round((count / maxCityCount) * 100)}%)`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Donut */}
        <div className="lg:col-span-5 liquid-glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 bg-white/10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <Icon name="donut_large" className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Category Breakdown</h3>
              <p className="text-[10px] text-slate-400">Issue types distribution</p>
            </div>
          </div>
          <div className="p-5 flex flex-col items-center gap-5">
            {/* CSS Donut */}
            <div className="relative w-44 h-44">
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(${conicGradient})`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-[#f6f6f8] flex flex-col items-center justify-center shadow-inner">
                  <span className="text-2xl font-bold text-slate-800">{tickets.length}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Total</span>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2">
              {donutSegments.map((s) => (
                <div key={s.cat} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-slate-600 truncate">{ANALYTICS_CAT_LABEL[s.cat] || s.cat}</span>
                  <span className="text-xs font-bold text-slate-800 ml-auto">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Weekly Trend + Resolution Gauge ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Trend */}
        <div className="lg:col-span-8 liquid-glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 bg-white/10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Icon name="trending_up" className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm">7-Day Trend</h3>
              <p className="text-[10px] text-slate-400">New complaints over the last week</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-end justify-between gap-2 h-44">
              {weeklyTrend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-bold text-slate-700">{d.count}</span>
                  <div className="w-full max-w-[48px] relative group">
                    <div
                      className="w-full rounded-t-lg transition-all duration-500 ease-out relative"
                      style={{
                        height: `${Math.max(8, (d.count / maxTrendCount) * 120)}px`,
                        background: i === weeklyTrend.length - 1
                          ? 'linear-gradient(180deg, #6366f1 0%, #818cf8 100%)'
                          : 'linear-gradient(180deg, #c7d2fe 0%, #e0e7ff 100%)',
                      }}
                    >
                      <div className="absolute inset-0 rounded-t-lg bg-white/0 group-hover:bg-white/20 transition-colors" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-500">{d.label}</p>
                    <p className="text-[9px] text-slate-400">{d.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resolution & Severity Gauge */}
        <div className="lg:col-span-4 liquid-glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 bg-white/10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Icon name="speed" className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Performance</h3>
              <p className="text-[10px] text-slate-400">Resolution & severity metrics</p>
            </div>
          </div>
          <div className="p-5 space-y-6">
            {/* Resolution Rate Gauge */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-32 h-16 overflow-hidden">
                <div className="absolute inset-0 rounded-t-full border-[10px] border-slate-100" style={{ borderBottom: 'none' }} />
                <div
                  className="absolute inset-0 rounded-t-full border-[10px] border-transparent transition-all duration-700"
                  style={{
                    borderTopColor: resolutionStats.resolutionRate >= 70 ? '#10b981' : resolutionStats.resolutionRate >= 40 ? '#f59e0b' : '#ef4444',
                    borderLeftColor: resolutionStats.resolutionRate >= 50 ? (resolutionStats.resolutionRate >= 70 ? '#10b981' : '#f59e0b') : 'transparent',
                    borderRightColor: resolutionStats.resolutionRate >= 50 ? (resolutionStats.resolutionRate >= 70 ? '#10b981' : '#f59e0b') : (resolutionStats.resolutionRate >= 25 ? (resolutionStats.resolutionRate >= 70 ? '#10b981' : '#f59e0b') : 'transparent'),
                    borderBottom: 'none',
                    transform: `rotate(${Math.min(180, resolutionStats.resolutionRate * 1.8)}deg)`,
                    transformOrigin: 'bottom center',
                  }}
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                  <span className="text-xl font-bold text-slate-800">{resolutionStats.resolutionRate}%</span>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resolution Rate</span>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-slate-800">{resolutionStats.avgSeverity}</p>
                <p className="text-[10px] text-slate-500 font-medium">Avg Severity</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{resolutionStats.open}</p>
                <p className="text-[10px] text-slate-500 font-medium">Open Issues</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-600">{resolutionStats.inProgress}</p>
                <p className="text-[10px] text-slate-500 font-medium">In Progress</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-600">{resolutionStats.resolved}</p>
                <p className="text-[10px] text-slate-500 font-medium">Resolved</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Officer Leaderboard + City Severity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Officer Leaderboard */}
        <div className="lg:col-span-7 liquid-glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 bg-white/10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <Icon name="military_tech" className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Officer Contribution</h3>
              <p className="text-[10px] text-slate-400">Top officers by resolved complaints</p>
            </div>
          </div>
          {officerLeaderboard.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              <Icon name="person_off" className="text-4xl text-slate-300 mb-2" />
              <p>No officer assignments yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {officerLeaderboard.map((officer, i) => (
                <div key={officer.name} className="flex items-center gap-4 px-5 py-4 hover:bg-primary/5 transition-colors">
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-200 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {i <= 2 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{officer.name}</p>
                    <p className="text-[10px] text-slate-400">{officer.assigned} assigned • {officer.resolved} resolved</p>
                  </div>
                  {/* Resolution Rate Bar */}
                  <div className="w-24 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500">{officer.rate}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${officer.rate}%`,
                          background: officer.rate >= 70 ? '#10b981' : officer.rate >= 40 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                  {/* Resolved Count */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <span className="text-sm font-bold text-emerald-600">{officer.resolved}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* City Severity Heatmap */}
        <div className="lg:col-span-5 liquid-glass rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200/50 bg-white/10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-50">
              <Icon name="local_fire_department" className="text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm">City Severity Index</h3>
              <p className="text-[10px] text-slate-400">Average severity & critical issues by city</p>
            </div>
          </div>
          {citySeverity.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No data available</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {citySeverity.map((item) => (
                <div key={item.city} className="px-5 py-4 flex items-center gap-4 hover:bg-rose-50/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{item.city}</p>
                    <p className="text-[10px] text-slate-400">{item.total} complaints</p>
                  </div>
                  {/* Severity Indicator */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.critical > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                        <Icon name="warning" className="text-[12px]" />{item.critical} critical
                      </span>
                    )}
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      item.avg >= 7 ? 'bg-rose-100 text-rose-700' :
                      item.avg >= 5 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.avg}/10
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 5: City Status Breakdown ── */}
      <div className="liquid-glass rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200/50 bg-white/10 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-50">
            <Icon name="stacked_bar_chart" className="text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm">City-wise Status Breakdown</h3>
            <p className="text-[10px] text-slate-400">Open, In-progress, and Resolved distribution per city</p>
          </div>
        </div>
        <div className="p-5">
          {cityStatusBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No data available</p>
          ) : (
            <div className="space-y-4">
              {cityStatusBreakdown.map(([city, data]) => (
                <div key={city}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">{city}</span>
                    <span className="text-xs text-slate-400">{data.total} total</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                    {data.resolved > 0 && (
                      <div
                        className="bg-emerald-400 transition-all duration-500"
                        style={{ width: `${(data.resolved / data.total) * 100}%` }}
                        title={`Resolved: ${data.resolved}`}
                      />
                    )}
                    {data.in_progress > 0 && (
                      <div
                        className="bg-blue-400 transition-all duration-500"
                        style={{ width: `${(data.in_progress / data.total) * 100}%` }}
                        title={`In Progress: ${data.in_progress}`}
                      />
                    )}
                    {data.open > 0 && (
                      <div
                        className="bg-amber-400 transition-all duration-500"
                        style={{ width: `${(data.open / data.total) * 100}%` }}
                        title={`Open: ${data.open}`}
                      />
                    )}
                  </div>
                  <div className="flex gap-4 mt-1.5">
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{data.resolved} resolved</span>
                    <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{data.in_progress} in progress</span>
                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{data.open} open</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniMetricCard({ icon, label, value, color }) {
  return (
    <div className="liquid-glass rounded-xl p-4 flex items-center gap-4 hover:shadow-lg transition-shadow">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export default AdminDashboard;
