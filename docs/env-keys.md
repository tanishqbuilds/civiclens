# Environment Keys Reference

This file lists all required environment keys for local/dev setup.

Important:
- Keep real secrets in local `.env` files or your team secret vault.
- Do not commit real key values to git.
- Use the example blocks below as the shared source of truth.

## Backend (`server/.env`)

```env
PORT=3001
NODE_ENV=development
MONGO_URI=<your_mongodb_connection_string>

# Flask AI service base URL
FLASK_API_URL=http://localhost:5000
AI_SERVICE_URL=http://localhost:5000

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=<account_name>;AccountKey=<account_key>;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=ticket-image
```

Used by:
- `server/server.js`: app startup and Mongo connectivity
- `server/src/utils/blobUpload.js`: Azure blob upload
- `server/src/utils/aiClassifier.js`: Flask AI classify endpoint

## Frontend (`client/.env`)

```env
# Frontend to backend API base
VITE_API_BASE_URL=http://localhost:3001/api

# Mapbox public token (if map components require it)
VITE_MAPBOX_TOKEN=<your_mapbox_public_token>
```

Used by:
- `client/src/services/api.js`: all API requests
- map components (Mapbox token)

## AI Service (`ai-service/.env`)

```env
# Flask app settings (adjust as needed)
FLASK_ENV=development
PORT=5000

# Optional model/config keys if your team uses them
MODEL_PATH=<path_or_model_id>
```

Used by:
- `ai-service/app.py` and related classifier modules

## Quick Setup Checklist

1. Copy values from your team secret source into local `.env` files.
2. Verify backend health: `http://localhost:3001/health`
3. Verify AI health (if enabled): `http://localhost:5000/health`
4. Verify frontend talks to backend using `VITE_API_BASE_URL`.
