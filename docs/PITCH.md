# CivicLens — Judge Pitch Summary

> **Hackathon:** HackOverflow 2026 | Theme: Urban to Global | Challenge: SIH25031 (Government of Jharkhand)
> **Team Size:** 3 | **Timeframe:** 36-hour build

---

## The Problem

Municipal governments receive thousands of unstructured civic complaints daily — potholes, garbage dumps, broken streetlights, waterlogging. There is no standardised channel for citizens to report these, and officials must manually read, sort, and prioritise every complaint. Critical hazards get buried; resolution is slow and opaque.

---

## The Solution — CivicLens

A mobile-first Progressive Web App (PWA) that lets any citizen report a civic issue in under 60 seconds, and gives government admins an AI-powered dashboard to instantly triage, prioritise, and manage those reports.

**Core loop:**
```
Citizen snaps photo → GPS auto-tagged → AI classifies & scores severity
→ Admin sees live dashboard → Status updated → Issue resolved
```

---

## Full Workflow

### 1. Citizen Submits a Report (No account required)

| Step | Action | Technology |
|---|---|---|
| Open app | Visits root `/` URL on any smartphone | React PWA (Vite + Tailwind) |
| Capture photo | Taps "Tap to capture" — camera launches natively | `<input capture="environment">` |
| Auto-locate | Taps "Auto-detect GPS" — coordinates fill in instantly | `navigator.geolocation` API |
| Describe | Types description **or uses voice input** (hands-free) | Web Speech API (`en-IN`) |
| Submit | Taps "Submit Issue" — done | Axios `multipart/form-data` POST |

> Citizens need zero technical knowledge. The form rejects submission if photo or GPS is missing, preventing garbage data.

---

### 2. Backend Ingestion Pipeline (Node.js / Express)

```
POST /api/tickets (multipart)
        │
        ├─ Multer → extracts photo buffer from request
        │
        ├─ Joi validation → checks required fields
        │
        ├─ Azure Blob Storage → uploads image, returns CDN URL
        │       └─ Fallback: placeholder URL if Azure unreachable
        │
        ├─ Flask AI Service → POST /classify (image URL)
        │       └─ Returns: { category, confidence, severity }
        │       └─ Fallback: category="unclassified", severity=5
        │
        └─ MongoDB Atlas → ticket document saved (GeoJSON coordinates)
                └─ Response: 201 with full ticket object
```

Every step has a graceful fallback so the citizen flow never breaks even if a dependency is down.

---

### 3. AI Classification Engine (Flask / Python)

The Flask microservice receives the image and runs it through a pre-trained **MobileNetV2** (or **YOLOv8-cls**) model to classify it.

**Categories:**

| Category | Severity Weight |
|---|---|
| Pothole | 1.0 (Highest) |
| Waterlogging | 0.9 |
| Broken Streetlight | 0.7 |
| Garbage Dump | 0.6 |
| Other | 0.5 |

**Severity formula:**
```
severity = ceil(confidence × category_weight × 10)   [clamped 1–10]
```

A pothole detected with 90% confidence gets a severity score of **9** and jumps to the top of the admin queue automatically — no human triage needed.

---

### 4. Admin Dashboard (Protected, JWT-auth)

Admins log in at `/admin/login` with username + password. A JWT token (40-minute expiry, bcrypt-verified) gates the dashboard.

**Dashboard capabilities:**

| Feature | Description |
|---|---|
| **Live Stats Cards** | Total, Open, In-Progress, Resolved counts — auto-refreshes every 15 seconds |
| **Severity Heatmap** | Mapbox GL JS map with colour-coded pins (red = critical, amber = high, blue = medium) |
| **Sortable Issue Table** | Filter by status/category; sort by severity or date |
| **Ticket Detail Modal** | Full photo, mini-map, description, AI confidence score |
| **Status Management** | Dropdown: `open → in_progress → resolved` — updates MongoDB instantly |
| **Jurisdiction Filtering** | Each admin only sees tickets within their city radius (Haversine distance) |

---

## Architecture Overview

```
[Citizen Browser / Mobile]
         │  HTTPS (multipart/form-data)
         ▼
[Express API — Azure App Service]
         │
         ├──── Azure Blob Storage (images + static frontend CDN)
         │
         ├──── Flask AI Service — Azure App Service (MobileNetV2 / YOLOv8)
         │
         └──── MongoDB Atlas (GeoJSON-indexed ticket documents)

[Admin Browser]
         │  HTTPS (JWT in Authorization header)
         ▼
[Express API] ──── Mapbox GL JS (heatmap tiles)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Mapbox GL JS |
| **Backend** | Node.js, Express.js, Mongoose, Multer, Joi |
| **AI Service** | Python, Flask, TensorFlow/Keras (MobileNetV2) or YOLOv8 |
| **Database** | MongoDB Atlas (GeoJSON + geospatial indexing) |
| **Cloud** | Azure Blob Storage, Azure CDN, Azure App Service (×2) |
| **Auth** | JWT + bcrypt |
| **Voice Input** | Web Speech API |

---

## Key Technical Differentiators

1. **Zero-friction citizen UX** — photo + GPS + optionally voice, no account needed, works on any smartphone browser.
2. **Automatic AI triage** — severity scores surface critical issues to the top without any admin manual reading.
3. **Jurisdiction-scoped dashboards** — scalable to multiple cities; each admin sees only their area using Haversine radius filtering.
4. **Resilient pipeline** — every external dependency (Azure, AI service, MongoDB) has a fallback so no single failure breaks the citizen submission flow.
5. **Real-time spatial awareness** — Mapbox heatmap instantly shows which neighbourhoods have the highest density of unresolved issues.

---

## Impact Potential

- Reduces issue triage time from days → seconds (automated severity scoring)
- Provides geospatial insight municipalities currently lack entirely
- Scalable: jurisdiction model supports state-wide or national deployment
- Inclusive: voice input supports low-literacy users; no app install required (PWA)
- Directly addresses the Government of Jharkhand's SIH25031 challenge mandate
