# Architecture Overview — CivicLens

```
┌─────────────────────┐     ┌─────────────────────────────────────────────┐
│   📱 Citizen PWA    │     │              ☁️  Azure Cloud                │
│   (React + Vite)    │     │                                             │
│                     │     │  ┌────────────────┐  ┌───────────────────┐  │
│  • Camera capture   │────▶│  │  Node.js API   │  │  Flask AI Service │  │
│  • GPS auto-detect  │     │  │  (App Service)  │─▶│  (App Service)    │  │
│  • Issue submission │     │  │                 │  │                   │  │
└─────────────────────┘     │  │  POST /tickets  │  │  POST /classify   │  │
                            │  │  GET  /tickets  │  │  GET  /health     │  │
┌─────────────────────┐     │  │  PATCH /tickets │  │                   │  │
│  🖥️ Admin Dashboard │     │  │  GET  /stats    │  │  • MobileNetV2    │  │
│  (React + Vite)     │     │  └───────┬────────┘  └───────────────────┘  │
│                     │     │          │                                   │
│  • Heatmap view     │────▶│  ┌───────▼────────┐  ┌───────────────────┐  │
│  • Ticket table     │     │  │  MongoDB Atlas  │  │  Azure Blob       │  │
│  • Status updates   │     │  │  (Tickets DB)   │  │  Storage + CDN    │  │
│  • Priority sorting │     │  └────────────────┘  │  (Images + SPA)   │  │
└─────────────────────┘     │                      └───────────────────┘  │
                            └─────────────────────────────────────────────┘
```

## Data Flow

1. **Citizen** opens PWA → snaps photo → auto-detects GPS → submits
2. **Node API** receives form data → uploads image to **Blob Storage** → gets CDN URL
3. **Node API** forwards image to **Flask AI** → receives `{category, confidence, severity}`
4. **Node API** creates Ticket in **MongoDB** with all data → returns `201`
5. **Admin Dashboard** polls `GET /tickets` every 15s → renders heatmap + sortable table
6. **Admin** updates ticket status via `PATCH /tickets/:id`
