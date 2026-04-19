# CivicLens — Complete Project Workflow

This document explains the end-to-end functionality of CivicLens, from the moment a user submits a complaint on the frontend until it successfully registers on the admin dashboard.

## 1. User Input (The Frontend)
When a citizen encounters a civic issue (e.g., a pothole or garbage dump):
1. **Photo Capture**: They use the React-based mobile dashboard to snap or upload a photo of the issue.
2. **GPS Pinning**: The app requests their location. Once accepted, their exact Longitude and Latitude are pinned to the map alongside their photo. Optionally, they can add an audio/text description.
3. **Data Submission**: The frontend packages everything into a `multipart/form-data` payload and POSTs it securely to the Node.js backend.

## 2. Server Processing (Node.js & Express)
Upon receiving the payload, the backend acts as the central orchestrator:
1. **Memory Storage**: The `multer` middleware catches the `.jpg` image and stores it instantly in RAM (a memory buffer) rather than saving it to the disk.
2. **Parallel Operations**: The backend fires off two simultaneous tasks using that single memory buffer:
   * **Cloud Storage**: It streams the buffer directly to **Cloudinary** and retrieves a permanent, public `https://...` image URL.
   * **AI Analysis**: It sends a duplicate of the buffer over to the Python Flask AI Microservice for processing to extract data context from the pixels.

## 3. How the AI Works (Classification & Confidence)
Our AI service receives the raw image and runs it through a sophisticated pipeline:

### Category Classification
Rather than just guessing randomly, the Flask server loads up a massive Pre-trained Vision Transformer model. It asks the AI to look at the image and score how closely it matches these exact six descriptions:
* "a severe pothole, broken tarmac, or heavily damaged road surface" (maps to **Pothole**)
* "an overflowing garbage bin, litter..." (maps to **Garbage Dump**)
* "a flooded street, stagnant water..." (maps to **Waterlogging**)
* "dangerous hanging electrical wires..." (maps to **Electrical Hazard**)
* "overflowing sewage..." (maps to **Blocked Drain**)
* "a clean, normal, and well-maintained street..." (maps to **Clean Street/Other**)

The AI compares the image against all six sentences. Whichever sentence mathematically represents the image best gets chosen as the `Category`. 
The mathematical probability (e.g., 92%) is returned as the **Confidence Score**.

### Severity Calculation
Immediately after classifying the category, the AI runs a second inspection purely for severity. It compares the image against:
1. "minor or small issue, low impact" (Assigned **Score 3**)
2. "moderate damage or noticeable issue" (Assigned **Score 6**)
3. "severe, dangerous, or high-risk issue" (Assigned **Score 8**)
4. "extreme emergency or life-threatening" (Assigned **Score 10**)

The highest match determines the `severityScore`.

## 4. Database & Real-Time Sync
1. **Database Save**: The Node.js server receives the AI's `category`, `confidence`, and `severity`, and combines it with the `photoUrl` from Cloudinary and the `GPS coordinates` from the user. It saves this complete document to MongoDB.
2. **WebSocket Push**: The server immediately pushes a real-time WebSocket notification out to the Municipal Admin Dashboard.
3. **Admin Dashboard**: The government officials see the ticket instantly pop up on their screen, pre-categorized by AI and sorted by highest severity, allowing them to dispatch crews efficiently without manual sorting.
