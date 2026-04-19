# 🚧 CivicLens — Crowdsourced Civic Issue Reporting & Resolution

> **HackOverflow 2026** | Theme: Urban to Global | SIH25031 — Govt. of Jharkhand

[![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)](./client)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)](./server)
[![Flask](https://img.shields.io/badge/AI-Flask-000000?logo=flask)](./ai-service)
[![Azure](https://img.shields.io/badge/Cloud-Azure-0078D4?logo=microsoftazure)](https://azure.microsoft.com)

---

## Problem

Citizens lack a structured way to report urban infrastructure hazards (potholes, garbage dumps, broken streetlights), and municipal governments waste thousands of hours manually sorting these unstructured complaints.

## Solution

A **mobile-first web app** for citizens to snap photos and drop GPS pins of issues, coupled with an **AI-powered municipal dashboard** that automatically categorizes issues and assigns severity scores using computer vision.

---

## Repo Structure

```
optimum-ho-solution/
├── client/          # React PWA — Citizen & Admin views (Member 1)
├── server/          # Node.js + Express API (Member 2)
├── ai-service/      # Python Flask AI classification microservice (Member 3)
├── docs/            # API contracts & architecture docs
├── .env.example     # Environment variable template
└── README.md
```

## Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/Hey-Viswa/optimum-ho-solution.git
cd optimum-ho-solution
cp .env.example .env   # Fill in your credentials
```

### 2. Client (React)

```bash
cd client
npm install
npm run dev          # → http://localhost:5173
```

### 3. Server (Node/Express)

```bash
cd server
npm install
npm run dev          # → http://localhost:3001
```

### 4. AI Service (Flask)

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
python app.py               # → http://localhost:5000
```

---

## API Reference

Base URL: `http://localhost:3001`

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Admin login → returns JWT |
| GET | `/api/auth/verify` | Bearer | Verify existing token |

**Login:**
```
POST /api/auth/login
{ "username": "admin@gov", "password": "admin@gov" }
→ 200 { "token": "...", "admin": { "id", "username", "role" } }
```

### Tickets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/tickets` | No | Submit a new civic issue (multipart or JSON) |
| GET | `/api/tickets` | No | List tickets with filters, sort, pagination |
| GET | `/api/tickets/:id` | No | Get a single ticket by ID |
| PATCH | `/api/tickets/:id` | No | Update ticket status |
| GET | `/api/stats` | No | Dashboard aggregate statistics |

**Submit Ticket:**
```
POST /api/tickets  (multipart/form-data)
Fields: photo (file), description (string), longitude (number), latitude (number)

POST /api/tickets  (application/json)
{ "photoUrl": "...", "description": "...", "longitude": 77.59, "latitude": 12.97 }

→ 201 { "success": true, "data": { ticket object } }
```

**List Tickets:**
```
GET /api/tickets?status=open&category=pothole&sort=severity&page=1&limit=10

→ 200 { "success": true, "count": 10, "total": 45, "page": 1, "data": [...] }
```

**Update Status:**
```
PATCH /api/tickets/:id
{ "status": "in_progress" }   // open | in_progress | resolved

→ 200 { "success": true, "data": { updated ticket } }
```

**Dashboard Stats:**
```
GET /api/stats

→ 200 {
    "success": true,
    "data": {
      "total": 128,
      "byStatus": { "open": 74, "in_progress": 31, "resolved": 23 },
      "byCategory": { "pothole": 42, "garbage": 35, ... },
      "avgSeverity": 6.4
    }
  }
```

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/test-azure` | Azure Blob Storage connectivity test |

### Error Codes

| Code | Meaning |
|------|---------|
| 400 | Validation error (missing/invalid fields) |
| 401 | Unauthorized (invalid or missing JWT) |
| 404 | Ticket not found |
| 500 | Server error (DB or Azure failure) |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | Azure Blob Storage connection |
| `AZURE_STORAGE_CONTAINER_NAME` | Yes | Blob container name (default: ticket-images) |
| `FLASK_API_URL` | No | AI service URL (default: http://localhost:5000) |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `CLIENT_ORIGIN` | No | Frontend origin for CORS (default: http://localhost:5173) |
| `NODE_ENV` | No | Environment mode (development/production) |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React, Vite, TailwindCSS, Mapbox GL |
| Backend | Node.js, Express, Mongoose |
| AI Service | Python, Flask, YOLOv8 / MobileNetV2 |
| Database | MongoDB Atlas |
| Cloud | Azure Blob Storage, Azure App Service, Azure CDN |

---

## Team

| Role | Responsibility |
|------|----------------|
| **Member 1** — Frontend Lead | React citizen app, admin dashboard, map integrations |
| **Member 2** — Backend Lead | Node/Express API, MongoDB schemas, service bridge |
| **Member 3** — AI & Cloud Lead | Flask classification service, Azure deployment |

---

## License


