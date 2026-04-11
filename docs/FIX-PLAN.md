# Admin Dashboard — Fix Plan

Each fix is isolated. I'll implement them in this order after your approval.

---

## Fix 1 — Add auth to PATCH `/tickets/:id` (CRITICAL)

**File:** `server/src/routes/ticketsRoutes.js`

**Change:** Import `verifyToken` and add it before `validatePatchTicket` on the PATCH route.

```diff
+ const { verifyToken } = require('../middleware/auth');
  
- router.patch('/tickets/:id', validatePatchTicket, patchTicketStatus);
+ router.patch('/tickets/:id', verifyToken, validatePatchTicket, patchTicketStatus);
```

---

## Fix 2 — Fix sort parameter mismatch (HIGH)

**File:** `server/src/controllers/ticketsController.js`

**Change:** Parse the `-` prefix from the client's Mongoose-style sort values (`-severityScore`, `-createdAt`, etc.) to determine field name and sort direction.

```diff
- const sortMap = { severity: 'severityScore' };
- const resolvedField = sort ? (sortMap[sort] || sort) : 'createdAt';
- const sortableFields = new Set(['severityScore', 'createdAt']);
- if (sortableFields.has(resolvedField)) {
-     tickets.sort((a, b) => {
-         if (resolvedField === 'createdAt') {
-             return (new Date(b.createdAt) - new Date(a.createdAt));
-         }
-         return (b[resolvedField] - a[resolvedField]);
-     });
- }
+ // Parse Mongoose-style sort: "-severityScore" → field="severityScore", desc=true
+ const sortableFields = new Set(['severityScore', 'createdAt']);
+ let sortField = 'createdAt';
+ let sortDesc = true;
+ if (sort) {
+     const desc = sort.startsWith('-');
+     const raw = desc ? sort.slice(1) : sort;
+     const sortMap = { severity: 'severityScore' };
+     const mapped = sortMap[raw] || raw;
+     if (sortableFields.has(mapped)) {
+         sortField = mapped;
+         sortDesc = desc;
+     }
+ }
+ tickets.sort((a, b) => {
+     let cmp;
+     if (sortField === 'createdAt') {
+         cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
+     } else {
+         cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
+     }
+     return sortDesc ? -cmp : cmp;
+ });
```

---

## Fix 3 — Use server `/stats` endpoint instead of client-side counting (MEDIUM)

**File:** `client/src/pages/AdminDashboard.jsx`

**Change:** Call `getStats()` from the API and use its response for the stats cards, so pagination doesn't break the counts.

```diff
  // In fetchAll():
  const ticketsRes = await getTickets(params);
  const data = ticketsRes.data?.data ?? [];
  setTickets(data);
- setStats({
-     total: data.length,
-     byStatus: {
-         open: data.filter((t) => t.status === "open").length,
-         ...
-     },
- });
+ // Fetch real stats from server (not affected by pagination)
+ try {
+     const statsRes = await getStats();
+     const s = statsRes.data?.data ?? statsRes.data;
+     setStats({ total: s.total, byStatus: s.byStatus });
+ } catch {
+     // Fallback to counting from current page
+     setStats({
+         total: data.length,
+         byStatus: {
+             open: data.filter((t) => t.status === "open").length,
+             in_progress: data.filter((t) => t.status === "in_progress").length,
+             resolved: data.filter((t) => t.status === "resolved").length,
+         },
+     });
+ }
```

Also add `getStats` to the import at the top of the file.

---

## Fix 4 — Fix `handleStatusChange` id comparison (MEDIUM)

**File:** `client/src/pages/AdminDashboard.jsx`

**Change:** Check both `_id` and `id` fields, matching the WS handler pattern.

```diff
- setTickets((prev) =>
-     prev.map((t) => (t._id === id ? { ...t, status: newStatus } : t)),
- );
- if (selectedTicket?._id === id) {
+ setTickets((prev) =>
+     prev.map((t) => (t._id === id || t.id === id) ? { ...t, status: newStatus } : t),
+ );
+ if (selectedTicket?._id === id || selectedTicket?.id === id) {
```

---

## Fix 5 — Remove dead `barWidth` prop, keep working `barPct` (MEDIUM)

**File:** `client/src/pages/AdminDashboard.jsx`

**Change:** Remove the `barWidth` prop from all `StatCard` usages (it uses dynamic Tailwind classes that get purged). The `barPct` prop with inline `style` already works correctly — no visual change.

---

## Fix 6 — Fix "Auto-refresh 30s" label when WS is live (LOW)

**File:** `client/src/pages/AdminDashboard.jsx`

**Change:** Show "Live" with a green dot when WS is connected, show "Auto-refresh 30s" only when polling.

```diff
- <p className="text-[10px] text-slate-500">
-     Auto-refresh {Math.round(REFRESH_MS / 1000)}s
- </p>
+ <p className="text-[10px] text-slate-500">
+     {wsState === 'open' ? '● Live' : `Auto-refresh ${Math.round(REFRESH_MS / 1000)}s`}
+ </p>
```

---

## Fix 7 — Reload MongoDB tickets into memory on startup (LOW)

**File:** `server/server.js` + `server/src/models/ticketStore.js`

**Change:** After MongoDB connects, load existing tickets into the in-memory store so `getTickets` returns all persisted data after a restart.

In `ticketStore.js` — add a `loadFromMongo(docs)` function that bulk-inserts docs into the in-memory array.

In `server.js` — after `mongoose.connect()`, query all tickets and call `loadFromMongo()`.

---

## Fix 8 — Implement actual exponential back-off for WebSocket (LOW)

**File:** `client/src/pages/AdminDashboard.jsx`

**Change:** Track retry count and increase delay: 1s → 2s → 4s → 8s → max 30s.

```diff
+ let retries = 0;
  function connect() {
      ...
      ws.onclose = () => {
-         wsRetryRef.current = setTimeout(connect, 5000);
+         const delay = Math.min(1000 * 2 ** retries, 30000);
+         retries++;
+         wsRetryRef.current = setTimeout(connect, delay);
      };
      ws.onopen = () => {
+         retries = 0;
          ...
      };
  }
```

---

## Items NOT being changed (acknowledged, deferred)

| # | Issue | Reason |
|---|-------|--------|
| 2 | Hardcoded fallback JWT secret | Env-config concern — just ensure `JWT_SECRET` is always set in `.env`. No code change needed if your `.env` has it. |
| 3 | Seed passwords in source | These are dev/demo seeds. Move to env vars only if deploying publicly. |
| 9 | `GET /tickets` is public | Likely intentional for citizen transparency. Flag if you want auth added. |
| 12 | ESLint dep warnings in MapView | Suppressed intentionally, no functional issue. |
| 14 | Complex login retry logic | Works as-is for ngrok tunneling. Refactor only if causing problems. |

---

## Execution order

1. Fix 1 (auth — critical security)  
2. Fix 2 (sort — broken feature)  
3. Fix 3 (stats — incorrect data)  
4. Fix 4 (id comparison — status update bug)  
5. Fix 5 (dead barWidth prop — cleanup)  
6. Fix 6 (WS status label — UX)  
7. Fix 7 (reload from Mongo — restart resilience)  
8. Fix 8 (exponential back-off — robustness)

---

**Approve all, or tell me which ones to skip/modify.**
