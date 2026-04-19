# CivicLens — Project Overview & Logic Analysis (Temporary)

This document provides a comprehensive summary of the **CivicLens** project as of current understanding, intended for onboarding and context synchronization.

---

## 1. Project Identity
- **Name:** CivicLens
- **Purpose:** Crowdsourced civic issue reporting (potholes, garbage, streetlights) with AI-powered prioritization for municipal authorities.
- **Context:** HackOverflow 2026 (SIH25031 — Govt. of Jharkhand).

## 2. System Architecture
The application follows a **Microservices-lite** architecture:

- **Frontend (Client):** React PWA built with Vite & TailwindCSS.
    - **Citizen View:** Mobile-optimized interface for reporting issues with image capture and geolocation (Mapbox).
    - **Admin Dashboard:** Web interface for municipalities to view heatmaps, filter issues, and manage resolution workflows.
- **Backend (Server):** Node.js & Express REST API.
    - Orchestrates data flow between the database, cloud storage, and AI service.
    - Handles JWT authentication (Admin login) and business logic for ticket management.
- **AI Service:** Python Flask microservice.
    - Uses YOLOv8 (or MobileNetV2 fallback) for computer vision task.
    - Classifies images into categories: `pothole`, `garbage`, `broken_streetlight`, `waterlogging`, etc.
    - Calculates a dynamic **Severity Score**.
- **Data & Storage:**
    - **Database:** MongoDB Atlas (NoSQL) for ticket and user data.
    - **Cloud Storage:** Azure Blob Storage for hosting high-resolution issue images.

---

## 3. Core Business Logic

### A. Reporting Workflow
1. **Data Capture:** Citizen captures a photo and description. Geolocation is **strictly locked** to auto-detection via `navigator.geolocation`; manual map pinning is disabled to prevent data manipulation.
2. **Submission:** Data is sent as `multipart/form-data` to the Node.js backend (`POST /api/tickets`).
3. **Storage:** Backend uploads the photo to Azure Blob Storage and receives a public URL.
4. **AI Processing:** Backend calls the Flask AI service with the image.
    - Flask service returns: `{ category, confidence, severity }`.
5. **Persistence:** Backend saves a new `Ticket` document in MongoDB with both citizen input and AI-generated metadata.

### B. Severity Scoring Logic
The system prioritizes issues using a weighted formula:
`Severity Score = ceil(Confidence × Category_Weight × 10)`

| Category | Weight |
|---|---|
| Pothole | 1.0 |
| Waterlogging | 0.9 |
| Broken Streetlight | 0.7 |
| Garbage | 0.6 |
| Other | 0.5 |

### C. Admin & Resolution Logic
- **Heatmapping:** Tickets are mapped using GeoJSON `Point` coordinates. Higher severity tickets appear with distinct visual markers (likely red/hot clusters).
- **Status Workflow:** `open` → `in_progress` → `resolved`.
- **Filtering:** Admins can filter by status, category, and sort by severity to focus on critical urban hazards.

---

## 4. Key Repository Components

- `/client`: Frontend source code. Uses `lucide-react` for icons and `axios` for API calls.
- `/server`: Express.js backend.
    - `models/`: Mongoose schemas (notably `Ticket.js`).
    - `server.js`: Main middleware and route configuration.
- `/ai-service`: Python environment.
    - `app.py`: Flask routes and model inference logic.
    - `requirements.txt`: ML dependencies (torch, ultralytics, etc.).
- `ProjectPlan.md`: The roadmap containing API contracts and deployment steps.

---

## 5. Current Scenario / Technical State
- **Phase:** Currently appears to be in the "Core Grind" or "Integration" phase.
- **Environment:** Connected to **MongoDB Atlas** and **Azure**.
- **Features Implemented:**
    - Basic reporting flow (Citizen UI).
    - Image classification (AI Service).
    - Dashboard aggregation (Admin UI).
    - Azure storage integration.

---
*Created on: 2026-04-19 (Auto-generated for context)*
