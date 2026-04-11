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
import { getTickets, updateTicketStatus, getStats } from "../services/api";
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
  const [bounds, setBounds] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const debounceRef = useRef(null);
  const wsRef = useRef(null);
  const wsRetryRef = useRef(null);

  // Jurisdiction-derived map props
  const jurisdiction = admin?.jurisdiction ?? null;
  const mapCenter = jurisdiction ? jurisdiction.center : [78.9629, 20.5937];
  const mapZoom = jurisdiction ? 11 : 4;

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
      </main>

      {/* ── Ticket Detail Modal ── */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={handleStatusChange}
          isUpdating={updatingStatus}
        />
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

function TicketModal({ ticket, onClose, onStatusChange, isUpdating }) {
  const [status, setStatus] = useState(ticket.status);

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
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {((ticket.aiConfidence ?? 0) * 100).toFixed(0)}%
                      confidence
                    </span>
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

export default AdminDashboard;
