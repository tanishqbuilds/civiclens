# CivicLens — Recent Changes & Setup Guide

> **Date:** 2026-04-19  
> **Session:** Landing Page, Auth System, Reputation Scoring  
> **Purpose:** This document summarizes all recent changes so any team member can pull and run the project immediately.

---

## 🚀 Quick Start (All 3 Services)

```bash
# Terminal 1 — Node.js Backend
cd server
npm install
npm run dev
# → http://localhost:3001

# Terminal 2 — Flask AI Service
cd ai-service
pip install -r requirements.txt
python app.py
# → http://localhost:5000

# Terminal 3 — React Frontend
cd client
npm install
npm run dev
# → http://localhost:5173 (or 5174 if port is busy)
```

> **Important:** Start the Flask AI service BEFORE the Node server to avoid `ECONNREFUSED` errors on the reputation endpoint.

---

## 🔐 Environment Variables

### `server/.env`

```env
# --- MongoDB ---
MONGO_URI=mongodb://<user>:<pass>@<host>/hackoverflow?ssl=true&replicaSet=...&authSource=admin

# --- Azure Blob Storage ---
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
AZURE_CONTAINER_NAME=ticket-images
AZURE_STORAGE_CONTAINER_NAME=ticket-images

# --- Flask AI Microservice (Node calls this) ---
FLASK_API_URL=http://localhost:5000

# --- Node Server ---
PORT=3001
NODE_ENV=development

# --- React Client ---
VITE_API_BASE=http://localhost:3001
VITE_MAPBOX_TOKEN=<your_mapbox_token>

# --- JWT (User Auth) ---
JWT_SECRET=<your_secret_key>
```

### `ai-service/.env`  ← **NEW**

```env
FLASK_ENV=development
PORT=5000

# Required for Neuro-Fuzzy Reputation Scoring
# Must be the SAME MongoDB URI as the server
MONGO_URI=mongodb://<user>:<pass>@<host>/hackoverflow?ssl=true&replicaSet=...&authSource=admin
```

### `client/.env`

```env
VITE_API_BASE=http://localhost:3001
VITE_MAPBOX_TOKEN=<your_mapbox_token>
```

---

## 📁 New Files Created

| File | Description |
|---|---|
| `ai-service/reputation.py` | Neuro-Fuzzy (ANFIS) reputation scoring engine |
| `ai-service/test_reputation.py` | Smoke test for reputation module |
| `client/src/pages/LandingPage.jsx` | Premium dark-themed landing page |
| `client/src/pages/AuthPage.jsx` | Login/Signup with role selection (Citizen/Officer) |
| `client/src/pages/TrackPromptPage.jsx` | Post-submission tracking prompt |
| `client/src/pages/CitizenDashboard.jsx` | Citizen dashboard with reputation gauge |
| `client/src/context/AuthContext.jsx` | Dual-auth context (Admin + User) |
| `server/models/User.js` | Mongoose User model (citizen/officer roles) |
| `server/src/routes/userAuthRoutes.js` | User signup, login, profile, reputation routes |

---

## ✏️ Modified Files

| File | What Changed |
|---|---|
| `ai-service/app.py` | Added `POST /reputation` endpoint + `update_user_reputation()` utility |
| `ai-service/.env` | Added `MONGO_URI` for reputation scoring |
| `ai-service/.env.example` | Should be updated to include `MONGO_URI` |
| `server/server.js` | Mounted `/api/users` routes, expanded CORS origins |
| `server/models/Ticket.js` | Added optional `reportedBy` field (ref → User) |
| `server/src/middleware/auth.js` | Added `verifyUserToken` + `optionalUserToken` middleware |
| `server/src/routes/ticketsRoutes.js` | Added `/tickets/my` route, optional auth on POST |
| `server/src/controllers/ticketsController.js` | Added `getMyTickets()`, links tickets to authenticated users |
| `client/src/App.jsx` | Added routes: `/`, `/auth`, `/track`, `/dashboard` |
| `client/src/services/api.js` | Added `userSignup`, `userLogin`, `getMyTickets`, `getMyReputation`, etc. |
| `client/src/pages/CitizenReportPage.jsx` | GPS-locked location (no manual map pinning), dashboard link in header |
| `client/index.html` | Added Inter font weights 800, 900 |
| `client/src/index.css` | Added landing page animations, morph success overlay |

---

## 🗺️ Route Map

### Frontend Routes

| Path | Component | Auth Required |
|---|---|---|
| `/` | `LandingPage` | No |
| `/report` | `CitizenReportPage` | No (anonymous allowed) |
| `/auth` | `AuthPage` | No |
| `/track` | `TrackPromptPage` | No |
| `/dashboard` | `CitizenDashboard` | Yes (citizen) |
| `/admin/login` | `AdminLogin` | No |
| `/admin` | `AdminDashboard` | Yes (admin) |

### Backend API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/users/signup` | — | Register citizen/officer |
| `POST` | `/api/users/login` | — | Authenticate user |
| `GET` | `/api/users/me` | User | Get profile |
| `PATCH` | `/api/users/link-ticket` | User | Link anonymous ticket to user |
| `GET` | `/api/users/reputation` | User | Get neuro-fuzzy reputation score |
| `GET` | `/api/tickets/my` | User | Get user's own tickets |
| `POST` | `/api/tickets` | Optional | Submit a new ticket |
| `GET` | `/api/tickets` | Admin | List all tickets |
| `PATCH` | `/api/tickets/:id` | Admin | Update ticket status |

### Flask AI Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/classify` | Image classification (CLIP) |
| `POST` | `/reputation` | Neuro-Fuzzy reputation score |

---

## 🧠 Neuro-Fuzzy Reputation Scoring

### Architecture

```
CitizenDashboard
    → GET /api/users/reputation (Node.js proxy)
        → POST /reputation (Flask AI service)
            → MongoDB: fetch user's tickets
            → compute_reputation() — ANFIS inference
            → Return score 0–100
```

### Inputs (computed from user's ticket history)

| Metric | Formula |
|---|---|
| `resolution_rate` | resolved_reports / total_reports |
| `false_rate` | false_reports / total_reports |
| `avg_confidence` | mean(AI confidence scores) |
| `consistency` | 1 - std_dev(confidence scores) |

### Scoring Tiers

| Score Range | Tier | Dashboard Color |
|---|---|---|
| 70–100 | Trusted | 🟢 Green |
| 40–69 | Moderate | 🟡 Amber |
| 0–39 | Low | 🔴 Red |

### Test the module independently

```bash
cd ai-service
python test_reputation.py
```

---

## ⚠️ Known Issues & Notes

1. **CORS:** If the Vite dev server starts on port `5174` instead of `5173`, CORS is already configured for both ports in `server.js`.

2. **Flask `.env` loading:** Flask shows a tip to install `python-dotenv`. The reputation module already handles this gracefully with a try/except fallback. If `python-dotenv` isn't installed, set `MONGO_URI` as a system environment variable instead.

3. **Mongoose Duplicate Index Warning:** The warning about duplicate schema index on `{"email":1}` is cosmetic. It's caused by having both `unique: true` in the schema field and a separate `schema.index()` call. It does not affect functionality.

4. **Azure Upload Errors:** The `Invalid AccountKey` warnings mean the Azure Blob Storage connection string needs a valid `AccountKey`. Image uploads will fail silently until this is configured.

5. **Start Order:** Always start Flask AI service first → then Node server → then React client. The Node server calls Flask for reputation, and the client calls Node for everything.

---

*Generated for team onboarding — CivicLens HackOverflow 2026*
