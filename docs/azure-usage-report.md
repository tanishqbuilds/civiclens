# Azure Usage Report — CivicLens

> Auto-generated documentation of how Azure services are integrated into the CivicLens project.

---

## 1. Azure Services Used

| Service | Purpose |
|---------|---------|
| **Azure Blob Storage** | Stores citizen-uploaded issue photos (images) |
| **Azure App Service** | Hosts the Node.js API (`hackoverflow-api`) and Flask AI service (`hackoverflow-ai`) |
| **Azure CDN** | CDN layer on top of Blob Storage for faster image delivery |
| **Azure Static Website** | `$web` blob container hosts the React SPA production build |

---

## 2. Files That Reference Azure

| File | Role |
|------|------|
| `server/src/utils/blobUpload.js` | **Core upload logic** — `uploadBufferToBlob()` using `@azure/storage-blob` SDK |
| `server/src/utils/blobTest.js` | **Connectivity test** — `uploadAzureConnectivityTest()` uploads a small `.txt` blob |
| `server/src/controllers/ticketsController.js` | Calls `uploadBufferToBlob()` during `POST /api/tickets` |
| `server/src/routes/azureTestRoutes.js` | Exposes `GET /api/test-azure` endpoint for connectivity testing |
| `server/server.js` | Mounts `azureTestRoutes` at `/api` |
| `server/src/config/multer.js` | Multer with **memory storage** — buffers uploaded files in RAM before forwarding to Azure |
| `server/package.json` | Declares dependency `@azure/storage-blob: ^12.31.0` |

---

## 3. Environment Variables

| Variable | Default | Used In |
|----------|---------|---------|
| `AZURE_STORAGE_CONNECTION_STRING` | *(required — no default)* | `blobUpload.js`, `blobTest.js` |
| `AZURE_STORAGE_CONTAINER_NAME` | `ticket-image` | `blobUpload.js` |
| `AZURE_CONTAINER_NAME` | *(fallback alias)* | `blobTest.js` (falls back to `AZURE_STORAGE_CONTAINER_NAME` → `ticket-image`) |

**Connection string format:**
```
DefaultEndpointsProtocol=https;AccountName=hackoverflowstorage;AccountKey=...;EndpointSuffix=core.windows.net
```

**Storage Account Name:** `hackoverflowstorage`

---

## 4. What Files Are Stored & Where

### Container: `ticket-image`

| File Type | Source | MIME Types | Max Size |
|-----------|--------|------------|----------|
| **Issue photos** (JPEG, PNG, WebP) | Citizen photo uploads via `POST /api/tickets` | `image/jpeg`, `image/png`, `image/webp` | 5 MB (Multer limit) |
| **Test blobs** (text) | `GET /api/test-azure` connectivity check | `text/plain` | ~50 bytes |

### Blob Naming Convention

**Issue photos:**
```
ticket-{unix_timestamp}-{random_hex}{extension}
```
Example: `ticket-1710268800000-a1b2c3d4.jpg`

**Test blobs:**
```
azure-test-{unix_timestamp}.txt
```

### Extension Mapping

| MIME Type | Extension |
|-----------|-----------|
| `image/jpeg` | `.jpg` |
| `image/png` | `.png` |
| `image/webp` | `.webp` |
| *(fallback)* | `.jpg` |

---

## 5. Full Upload Flow

```
CLIENT (React)                  SERVER (Express)                     AZURE BLOB STORAGE
──────────────                  ────────────────                     ──────────────────
CitizenReportPage.jsx
  │
  ├─ User fills form + picks photo
  │
  ├─ new FormData()
  │    .append('photo', file)
  │    .append('longitude', ...)
  │    .append('latitude', ...)
  │    .append('description', ...)
  │
  ├─ submitTicket(formData) ──────► POST /api/tickets
  │   (Axios, multipart/form-data)     │
  │                                    ├─ multer.memoryStorage()
  │                                    │   → req.file.buffer (in RAM, ≤5 MB)
  │                                    │
  │                                    ├─ ticketsController.postTicket()
  │                                    │   │
  │                                    │   ├─ uploadBufferToBlob({       ────────► Azure Blob Storage
  │                                    │   │     buffer,                           │
  │                                    │   │     originalName,                     ├─ BlobServiceClient
  │                                    │   │     mimeType                          │   .fromConnectionString()
  │                                    │   │   })                                  │
  │                                    │   │                                       ├─ containerClient
  │                                    │   │                                       │   .createIfNotExists()
  │                                    │   │                                       │
  │                                    │   │                                       ├─ blockBlobClient
  │                                    │   │                                       │   .uploadData(buffer)
  │                                    │   │                                       │
  │                                    │   │   ◄──── { blobName, blobUrl } ────────┘
  │                                    │   │
  │                                    │   ├─ photoUrl = blobUrl
  │                                    │   ├─ classifyImageFromUrl(photoUrl) → Flask AI /classify
  │                                    │   ├─ Save to MongoDB (if connected)
  │                                    │   ├─ Save to in-memory ticketStore
  │                                    │   │
  │   ◄──── 201 { data: ticket } ─────┤   └─ return ticket with photoUrl
  │
  ├─ Show success toast
  └─ Navigate to confirmation
```

---

## 6. Blob URL Format

URLs follow Azure's standard pattern:

```
https://<account_name>.blob.core.windows.net/<container_name>/<blob_name>
```

**Concrete example:**
```
https://hackoverflowstorage.blob.core.windows.net/ticket-image/ticket-1710268800000-a1b2c3d4.jpg
```

This `blobUrl` is stored as the ticket's `photoUrl` field in both MongoDB and the in-memory store, and is what the frontend renders as the issue image in the Admin Dashboard and Citizen Report page.

---

## 7. Azure Test Utilities

### Connectivity Test Endpoint

**`GET /api/test-azure`**

Uploads a tiny text blob to verify the full Azure Blob Storage connection works end-to-end.

**Route:** `server/src/routes/azureTestRoutes.js`
**Logic:** `server/src/utils/blobTest.js` → `uploadAzureConnectivityTest()`

**Response (success):**
```json
{
  "success": true,
  "message": "Azure Blob Storage connection successful",
  "data": {
    "blobName": "azure-test-1710268800000.txt",
    "blobUrl": "https://hackoverflowstorage.blob.core.windows.net/ticket-image/azure-test-1710268800000.txt"
  }
}
```

---

## 8. Azure Deployment URLs

| Service | URL |
|---------|-----|
| Node.js API (App Service) | `https://hackoverflow-api.azurewebsites.net` |
| Flask AI Service (App Service) | `https://hackoverflow-ai.azurewebsites.net` |
| React Frontend (Static Website) | `https://hackoverflowstorage.z29.web.core.windows.net` |
| Blob Storage Account | `hackoverflowstorage` |

---

## 9. Key Code Snippets

### `blobUpload.js` — Core Upload Function

```js
const { BlobServiceClient } = require('@azure/storage-blob');

async function uploadBufferToBlob({ buffer, originalName, mimeType }) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(
        process.env.AZURE_STORAGE_CONTAINER_NAME || 'ticket-image'
    );
    await containerClient.createIfNotExists();

    const blobName = `ticket-${Date.now()}-${randomHex()}${getBlobExtension(mimeType)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: mimeType },
    });

    return { blobName, blobUrl: blockBlobClient.url };
}
```

### `ticketsController.js` — Upload in Ticket Creation

```js
if (uploadedPhoto) {
    const { blobUrl } = await uploadBufferToBlob({
        buffer: uploadedPhoto.buffer,
        originalName: uploadedPhoto.originalname,
        mimeType: uploadedPhoto.mimetype,
    });
    photoUrl = blobUrl;
}
```

---

## 10. Security Considerations

- The `AZURE_STORAGE_CONNECTION_STRING` contains the account key and **must never be committed** to version control. It is loaded from `.env` via `dotenv`.
- Multer enforces a **5 MB file size limit** on uploads to prevent abuse.
- The container is created with default (private) access unless configured otherwise.
- Blob URLs are publicly accessible only if the container's access level is set to `blob` or `container` in Azure Portal.
