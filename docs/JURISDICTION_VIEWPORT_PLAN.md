# Feature Plan: Admin Jurisdiction + Map Viewport Filter

> Two features that solve the **"whole-India-turns-red"** problem.
> Designed for hackathon speed — minimal changes, maximum demo impact.

---

## Feature A — Admin Jurisdiction Assignment

**Goal:** Each admin only sees tickets from their assigned city/district.

### How It Works

1. Each admin account gets a `jurisdiction` object:
   ```js
   {
     id: 'admin-001',
     username: 'admin@ranchi.gov',
     role: 'admin',
     jurisdiction: {
       city: 'Ranchi',
       state: 'Jharkhand',
       center: [85.3096, 23.3441],  // [lng, lat] — map auto-centers here
       radiusKm: 30                  // only tickets within 30 km shown
     }
   }
   ```

2. On login, the JWT token includes `jurisdiction` → frontend receives it
3. Admin dashboard auto-centers map on `jurisdiction.center`
4. GET /api/tickets filters by geo-radius using the admin's jurisdiction

### Files to Change

| File | Change |
|------|--------|
| `server/src/models/adminStore.js` | Add `jurisdiction` field to admin accounts, seed 2-3 demo admins (Ranchi, Mumbai, Delhi) |
| `server/src/routes/authRoutes.js` | Include `jurisdiction` in JWT payload and login response |
| `server/src/middleware/auth.js` | Pass `jurisdiction` through on verify |
| `server/src/controllers/ticketsController.js` | `getTickets()` + `getDashboardStats()` — accept `lng`, `lat`, `radiusKm` query params and filter tickets by geo-distance |
| `server/src/models/ticketStore.js` | Add `filterByRadius(lng, lat, radiusKm)` helper using haversine formula for in-memory filtering |
| `client/src/context/AuthContext.jsx` | Store `jurisdiction` from login/verify response in context state |
| `client/src/pages/AdminDashboard.jsx` | Read `jurisdiction` from auth context → pass as query params to `getTickets()` → pass `center` to `<MapView>` |
| `client/src/pages/AdminLogin.jsx` | No changes needed (already works) |

### Demo Admin Accounts

| Username | Password | City | Center (lng, lat) | Radius |
|----------|----------|------|--------------------|--------|
| `admin@ranchi.gov` | `admin123` | Ranchi | [85.3096, 23.3441] | 30 km |
| `admin@mumbai.gov` | `admin123` | Mumbai | [72.8777, 19.0760] | 25 km |
| `admin@delhi.gov` | `admin123` | Delhi | [77.1025, 28.7041] | 25 km |

> The old `admin@gov` / `admin@gov` account becomes a **super-admin** with no jurisdiction filter (sees all tickets). Good for demo fallback.

---

## Feature B — Map Viewport Filter (Bounding Box)

**Goal:** As the admin pans/zooms the map, the ticket table updates to show only visible tickets.

### How It Works

1. MapView fires `onBoundsChange` callback whenever the admin pans or zooms
2. Callback sends `{ minLng, maxLng, minLat, maxLat }` to the dashboard
3. Dashboard passes these as query params to `GET /api/tickets`
4. Backend filters tickets whose coordinates fall within the bounding box
5. Table + stats cards update in real-time as the map moves

### Interaction Flow
```
Admin zooms into Ranchi
  → MapView fires onBoundsChange({ minLng: 85.1, maxLng: 85.5, minLat: 23.2, maxLat: 23.5 })
  → Dashboard calls GET /api/tickets?minLng=85.1&maxLng=85.5&minLat=23.2&maxLat=23.5
  → Backend returns only tickets within that box
  → Table + stat cards re-render with filtered data
```

### Files to Change

| File | Change |
|------|--------|
| `client/src/components/MapView.jsx` | Add `onBoundsChange` prop — fires on `moveend` event with current map bounds |
| `client/src/pages/AdminDashboard.jsx` | Wire `onBoundsChange` from MapView → store bounds in state → include in `getTickets()` params |
| `server/src/controllers/ticketsController.js` | Parse `minLng, maxLng, minLat, maxLat` from query → filter in-memory tickets by coordinate range |
| `client/src/services/api.js` | No changes needed (already passes params object) |

### Debounce

Map `moveend` fires frequently during panning. We'll debounce the API call by **300ms** to avoid hammering the server. A simple `setTimeout`/`clearTimeout` in the dashboard — no extra library needed.

---

## Combined Behavior

When **both features** are active together:

1. Admin logs in → jurisdiction sets the **initial map center + zoom**
2. Backend pre-filters tickets by **radius** (from jurisdiction)  
3. As admin pans/zooms the map, **viewport filter refines further** within that radius
4. If admin is super-admin (no jurisdiction), viewport filter is the only constraint

This gives two layers:
- **Jurisdiction** = "what you're authorized to see" (server-enforced)
- **Viewport** = "what you're currently looking at" (client-driven UX)

---

## Execution Order

```
Step  Task                                        Depends On
────  ──────────────────────────────────────────  ──────────
 1    Backend: Add geo bounding-box filter to       —
      getTickets() controller (minLng/maxLng/
      minLat/maxLat query params)

 2    Backend: Add jurisdiction to admin store       —
      (seed 3 demo admins + super-admin)

 3    Backend: Include jurisdiction in JWT +          Step 2
      login response + verify response

 4    Backend: Add radius-based prefilter to          Step 1
      getTickets() when lng/lat/radiusKm
      params are present

 5    Frontend: MapView onBoundsChange callback       —

 6    Frontend: AuthContext stores jurisdiction        Step 3

 7    Frontend: AdminDashboard wires viewport          Steps 5,6
      filter + jurisdiction center + debounce

 8    Seed data: Ensure tickets are spread across      —
      Ranchi, Mumbai, Delhi coordinates

 9    Test: Login as 3 different admins, verify        All
      each sees only their city's tickets
```

Steps 1, 2, 5, 8 are independent and can be done in parallel.

---

## Seed Ticket Distribution

Current seed has tickets across Indian cities. We need to ensure each demo admin sees some tickets:

| City | Existing Seed Tickets | Coords Range |
|------|----------------------|--------------|
| Ranchi | 0 (nearest: Bhubaneswar) | ~85.3, ~23.3 |
| Mumbai | 1 (garbage-park: 72.87, 19.07) | ~72.8, ~19.0 |
| Delhi | 1 (streetlight-short: 77.10, 28.70) | ~77.1, ~28.7 |

**Action:** Add 3-4 Ranchi-area tickets to seed data so the Ranchi admin has issues to see.

---

## What Judges Will See

**Demo script:**
1. Open citizen page → submit a pothole report in Ranchi
2. Log in as `admin@ranchi.gov` → map centers on Ranchi → only Ranchi area tickets visible
3. Zoom out → table stays filtered to jurisdiction radius
4. Log out → log in as `admin@mumbai.gov` → map centers on Mumbai → completely different set of issues
5. Log in as `admin@gov` (super-admin) → sees entire India → zoom into any city

**Talking point:** *"Each municipal corporation only sees their jurisdiction. The system scales from a single city to the entire country."*

---

## Approve?

Review this plan, then tell me to proceed and I'll implement everything step by step.
