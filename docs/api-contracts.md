# API Contracts — CivicLens

> Full API contracts are documented in the [Execution Plan](../../.gemini/antigravity/brain/2bf52a38-5665-49d2-a3b5-fc083ecf4599/hackoverflow_execution_plan.md), Section 4.

## Quick Reference

### Node.js API (`:3001`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tickets` | Submit new issue (multipart: photo + GPS) |
| `GET` | `/api/tickets` | List tickets (filters: status, category, sort) |
| `GET` | `/api/tickets/:id` | Get single ticket |
| `PATCH` | `/api/tickets/:id` | Update ticket status |
| `GET` | `/api/stats` | Dashboard aggregate statistics |

### Flask AI Service (`:5000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/classify` | Classify image → `{category, confidence, severity}` |
| `GET` | `/health` | Health check |

## Base URLs

| Environment | Node API | Flask AI | Frontend |
|-------------|----------|----------|----------|
| Local | `http://localhost:3001` | `http://localhost:5000` | `http://localhost:5173` |
| Azure | `https://hackoverflow-api.azurewebsites.net` | `https://hackoverflow-ai.azurewebsites.net` | `https://hackoverflowstorage.z29.web.core.windows.net` |
