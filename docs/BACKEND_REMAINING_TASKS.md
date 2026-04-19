# Member 2 (Backend) — Remaining Tasks & Execution Plan

> Generated from audit against [ProjectPlan.md](ProjectPlan.md) § Member 2 checklist & § API Contracts

---

## Incomplete Tasks Overview

### From CORE GRIND (Hours 6–20)

| # | Task | Current State | Gap |
|---|------|---------------|-----|
| 1 | **GET /api/stats — full aggregate stats** | Returns `{total, open, in_progress, resolved}` only | Missing `byCategory` breakdown, missing `avgSeverity` — API contract requires both |
| 2 | **GET /api/tickets — pagination** | Returns all matching tickets in one array | Missing `page` & `limit` query params, missing `total` count in response — contract specifies `{count, total, page, data}` |

### From INTEGRATION & TESTING (Hours 20–28)

| # | Task | Current State | Gap |
|---|------|---------------|-----|
| 3 | **End-to-end test with real images + production Flask URL** | Flask URL still `http://localhost:5000` | Need to verify flow with deployed AI service URL once available |
| 4 | **Create Postman collection / .http file** | Does not exist | Need collection covering all 5 routes with example payloads |
| 5 | **Stress test — 20+ tickets in 5 min** | Not done | Need a script or manual plan to bulk-submit tickets and verify DB consistency |

### From POLISH (Hours 28–36)

| # | Task | Current State | Gap |
|---|------|---------------|-----|
| 6 | **README with API documentation** | README has Quick Start only, no endpoint docs | Add full API reference section |
| 7 | **Clean up dead code** | `server/routes/tickets.js` has old stubs (POST/GET/:id/PATCH/stats all return 501); `server/services/aiService.js` & `server/services/blobStorage.js` are empty exports | Unused files — can confuse reviewers/judges |

---

## Execution Plan

### Task 1 — Fix GET /api/stats (byCategory + avgSeverity)

**File:** `server/src/controllers/ticketsController.js` → `getDashboardStats()`

**Current response:**
```json
{ "total": 128, "open": 74, "in_progress": 31, "resolved": 23 }
```

**Target response (per API contract):**
```json
{
  "success": true,
  "data": {
    "total": 128,
    "byStatus": { "open": 74, "in_progress": 31, "resolved": 23 },
    "byCategory": {
      "pothole": 42, "garbage": 35, "broken_streetlight": 22,
      "waterlogging": 18, "other": 11
    },
    "avgSeverity": 6.4
  }
}
```

**Changes needed:**
- MongoDB path: use aggregation pipeline `$group` for category counts + `$avg` for severity
- In-memory path: compute category counts & average from the tickets array
- Wrap response in `{ success: true, data: { ... } }`

---

### Task 2 — Add Pagination to GET /api/tickets

**File:** `server/src/controllers/ticketsController.js` → `getTickets()`

**Changes needed:**
- Parse `page` (default 1) and `limit` (default 50) from `req.query`
- After filtering & sorting, slice the array: `tickets.slice((page-1)*limit, page*limit)`
- Return `{ success, count, total, page, data }` where `total` = pre-slice length, `count` = sliced length

---

### Task 3 — End-to-End Test with Production Flask URL

**Prerequisite:** Member 3 deploys Flask AI service to Azure App Service.

**Steps:**
1. Update `FLASK_API_URL` in `server/.env` to the deployed Azure URL
2. Start server → submit a real photo via POST /api/tickets from Postman or frontend
3. Verify AI classification fields (`aiCategory`, `aiConfidence`, `severityScore`) are populated correctly
4. Verify the image URL in `photoUrl` is accessible via Azure Blob CDN
5. Verify the ticket appears in GET /api/tickets and GET /api/tickets/:id

---

### Task 4 — Create Postman Collection

**File to create:** `server/CivicLens.postman_collection.json` (or `server/api-tests.http`)

**Routes to cover:**

| # | Method | URL | Body / Params |
|---|--------|-----|---------------|
| 1 | POST | `/api/tickets` | multipart: photo file + longitude + latitude + description |
| 2 | GET | `/api/tickets` | query: `?status=open&category=pothole&sort=severity&page=1&limit=10` |
| 3 | GET | `/api/tickets/:id` | path param: valid ticket id |
| 4 | PATCH | `/api/tickets/:id` | JSON: `{ "status": "in_progress" }` |
| 5 | GET | `/api/stats` | no params |
| 6 | POST | `/api/auth/login` | JSON: `{ "username": "admin@gov", "password": "admin@gov" }` |
| 7 | GET | `/api/auth/verify` | Header: `Authorization: Bearer <token>` |
| 8 | GET | `/health` | no params |

---

### Task 5 — Stress Test Script

**File to create:** `server/stress-test.js`

**Plan:**
- Use a simple Node.js script with `axios` or `fetch`
- Loop 20–25 times, each iteration POSTs a ticket with a sample image URL + random coords
- After all submissions, GET /api/tickets and verify count matches
- GET /api/stats and verify totals are consistent
- Report pass/fail + timing

---

### Task 6 — README API Documentation

**File:** Root `README.md`

**Add section after "Quick Start":**
- Table of all endpoints (method, path, auth required, description)
- Example request/response for each
- Error codes reference
- Environment variables table

---

### Task 7 — Clean Up Dead Code

**Files to remove or gut:**
| File | Action |
|------|--------|
| `server/routes/tickets.js` | Delete — replaced by `server/src/routes/ticketsRoutes.js` |
| `server/services/aiService.js` | Delete — replaced by `server/src/utils/aiClassifier.js` |
| `server/services/blobStorage.js` | Delete — replaced by `server/src/utils/blobUpload.js` |
| `server/config/.gitkeep` | Keep or remove — empty dir |
| `server/middleware/.gitkeep` | Keep or remove — empty dir |

---

## Suggested Execution Order

```
Priority  Task                              Est. Complexity
───────── ─────────────────────────────────  ───────────────
  1       Task 1 — Fix /api/stats            Small
  2       Task 2 — Pagination on /tickets    Small
  3       Task 7 — Clean up dead code        Trivial
  4       Task 4 — Postman collection        Medium
  5       Task 5 — Stress test script        Medium
  6       Task 6 — README API docs           Medium
  7       Task 3 — E2E with prod Flask URL   Blocked on Member 3
```

Tasks 1, 2, and 7 can be done immediately with no dependencies.  
Tasks 4, 5, and 6 are documentation/testing — do after code changes.  
Task 3 is blocked until the Flask AI service is deployed to Azure.

---

## Current Backend Architecture (for reference)

```
server/
├── server.js                          # Express entry point (ACTIVE)
├── models/Ticket.js                   # Mongoose schema (ACTIVE)
├── seed.js                            # Standalone DB seeder
├── src/
│   ├── config/multer.js               # Multer memory storage config
│   ├── controllers/ticketsController.js  # All 5 route handlers (ACTIVE)
│   ├── middleware/
│   │   ├── auth.js                    # JWT verifyToken
│   │   └── validate.js               # Joi schemas
│   ├── models/
│   │   ├── adminStore.js              # In-memory admin account
│   │   └── ticketStore.js             # In-memory ticket store + seeds
│   ├── routes/
│   │   ├── authRoutes.js              # POST /login, GET /verify
│   │   ├── azureTestRoutes.js         # GET /test-azure
│   │   └── ticketsRoutes.js           # All ticket CRUD routes (ACTIVE)
│   └── utils/
│       ├── aiClassifier.js            # Flask /classify caller (ACTIVE)
│       ├── blobTest.js                # Azure connectivity test
│       └── blobUpload.js              # Azure Blob upload (ACTIVE)
│
├── routes/tickets.js                  # ⚠️  OLD stubs — DEAD CODE
├── services/aiService.js              # ⚠️  Empty export — DEAD CODE
└── services/blobStorage.js            # ⚠️  Empty export — DEAD CODE
```
