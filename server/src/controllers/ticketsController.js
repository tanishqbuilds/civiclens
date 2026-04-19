const { getAllTickets, createTicket, updateTicketStatus, getStats } = require('../models/ticketStore');
const { classifyImage, classifyImageFromUrl } = require('../utils/aiClassifier');
const { broadcast } = require('../utils/wsServer');
const TicketModel = require('../../models/Ticket');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { uploadToCloudinary } = require('../utils/cloudinary');

const ALLOWED_STATUS = ['open', 'in_progress', 'resolved'];
const AZURE_BLOB_PREFIX = 'https://optimumhackoverflow.blob.core.windows.net/ticket-images/';
const ALLOWED_AI_CATEGORIES = new Set([
    'pothole',
    'garbage',
    'broken_streetlight',
    'waterlogging',
    'other',
    'unclassified',
]);

// Local persistence logic replaced by Cloudinary 


function normalizeTicketPhotoForDisplay(photoUrl) {
    if (!photoUrl || typeof photoUrl !== 'string') return null;

    const trimmed = photoUrl.trim();
    if (!trimmed) return null;

    const stripQuery = (url) => url.split('?')[0];

    // Normalize legacy container typo to active Azure container name.
    if (trimmed.includes('.blob.core.windows.net/ticket-image/')) {
        const normalized = trimmed.replace('/ticket-image/', '/ticket-images/');
        return normalized.startsWith(AZURE_BLOB_PREFIX) ? stripQuery(normalized) : null;
    }

    if (trimmed.startsWith(AZURE_BLOB_PREFIX)) {
        return stripQuery(trimmed);
    }

    if (trimmed.startsWith('/uploads/')) {
        return stripQuery(trimmed);
    }

    if (/^https?:\/\/[^/]+\/uploads\//i.test(trimmed)) {
        return stripQuery(trimmed);
    }

    if (/^data:image\//i.test(trimmed)) {
        return trimmed;
    }

    return /^https?:\/\//i.test(trimmed) ? stripQuery(trimmed) : null;
}

function withDisplayPhoto(ticket) {
    return {
        ...ticket,
        photoUrl: normalizeTicketPhotoForDisplay(ticket?.photoUrl),
    };
}

function normalizeAiCategory(rawCategory) {
    if (!rawCategory || typeof rawCategory !== 'string') return 'unclassified';

    const normalized = rawCategory.trim().toLowerCase();
    const directMap = {
        pothole: 'pothole',
        'garbage dump': 'garbage',
        garbage: 'garbage',
        waterlogging: 'waterlogging',
        'broken streetlight': 'broken_streetlight',
        'electrical hazard': 'broken_streetlight',
        'open/blocked drain': 'other',
        'clean street': 'other',
        other: 'other',
        unclassified: 'unclassified',
    };

    if (directMap[normalized]) return directMap[normalized];
    if (normalized.includes('pothole')) return 'pothole';
    if (normalized.includes('garbage') || normalized.includes('trash')) return 'garbage';
    if (normalized.includes('water')) return 'waterlogging';
    if (normalized.includes('light') || normalized.includes('electric')) return 'broken_streetlight';

    return 'other';
}

/** Haversine distance in km between two [lng, lat] points */
function haversineKm(lng1, lat1, lng2, lat2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Apply bounding-box and/or radius geo-filter to a ticket array (mutates nothing). */
function applyGeoFilter(tickets, query) {
    let result = tickets;

    // Bounding box: minLng, maxLng, minLat, maxLat
    const minLng = parseFloat(query.minLng);
    const maxLng = parseFloat(query.maxLng);
    const minLat = parseFloat(query.minLat);
    const maxLat = parseFloat(query.maxLat);
    if ([minLng, maxLng, minLat, maxLat].every((v) => !Number.isNaN(v))) {
        result = result.filter((t) => {
            const [lng, lat] = t.location?.coordinates ?? [];
            return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
        });
    }

    // Radius: lng, lat, radiusKm
    const cLng = parseFloat(query.lng);
    const cLat = parseFloat(query.lat);
    const radiusKm = parseFloat(query.radiusKm);
    if (!Number.isNaN(cLng) && !Number.isNaN(cLat) && !Number.isNaN(radiusKm) && radiusKm > 0) {
        result = result.filter((t) => {
            const [tLng, tLat] = t.location?.coordinates ?? [];
            return haversineKm(cLng, cLat, tLng, tLat) <= radiusKm;
        });
    }

    return result;
}

async function getTickets(req, res) {
    const { status, category, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    let tickets = [];

    if (mongoose.connection.readyState === 1) {
        try {
            tickets = await TicketModel.find().lean();
        } catch (err) {
            console.error('MongoDB ticket query failed, falling back to memory:', err.message);
            tickets = [...getAllTickets()];
        }
    } else {
        tickets = [...getAllTickets()];
    }

    // Geo filter (bounding box and/or radius)
    tickets = applyGeoFilter(tickets, req.query);

    if (status) {
        tickets = tickets.filter((ticket) => ticket.status === status);
    }

    if (category) {
        tickets = tickets.filter((ticket) => ticket.aiCategory === category);
    }

    // Parse Mongoose-style sort: "-severityScore" → field="severityScore", desc=true
    const sortableFields = new Set(['severityScore', 'createdAt']);
    let sortField = 'createdAt';
    let sortDesc = true;
    if (sort) {
        const desc = sort.startsWith('-');
        const raw = desc ? sort.slice(1) : sort;
        const sortMap = { severity: 'severityScore' };
        const mapped = sortMap[raw] || raw;
        if (sortableFields.has(mapped)) {
            sortField = mapped;
            sortDesc = desc;
        }
    }
    tickets.sort((a, b) => {
        let cmp;
        if (sortField === 'createdAt') {
            cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else {
            cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
        }
        return sortDesc ? -cmp : cmp;
    });

    // Pagination
    const total = tickets.length;
    const start = (page - 1) * limit;
    const paginated = tickets.slice(start, start + limit).map(withDisplayPhoto);

    return res.status(200).json({
        success: true,
        count: paginated.length,
        total,
        page,
        data: paginated,
    });
}

async function postTicket(req, res) {
    const { description, longitude, latitude } = req.body;
    const uploadedPhoto = req.file;

    // ── 1. Validate required fields ──────────────────────────────
    if (!uploadedPhoto && !req.body.photoUrl) {
        return res.status(400).json({
            success: false,
            error: 'A photo file (multipart) or photoUrl (JSON) is required.',
        });
    }
    if (longitude === undefined || latitude === undefined) {
        return res.status(400).json({
            success: false,
            error: 'longitude and latitude are required.',
        });
    }
    const parsedLongitude = Number(longitude);
    const parsedLatitude = Number(latitude);
    if (Number.isNaN(parsedLongitude) || Number.isNaN(parsedLatitude)) {
        return res.status(400).json({
            success: false,
            error: 'longitude and latitude must be valid numbers.',
        });
    }

    // ── 2. Upload image to Cloudinary ──
    let photoUrl = req.body.photoUrl || null;
    if (uploadedPhoto) {
        try {
            photoUrl = await uploadToCloudinary(uploadedPhoto.buffer, 'civiclens/tickets');
        } catch (saveErr) {
            console.error('Cloudinary image upload failed:', saveErr.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload image to Cloudinary.',
            });
        }
    }

    // ── 3. AI classification (with fallback) ──────────────────────
    let aiCategory = 'unclassified';
    let aiConfidence = 0;
    let severityScore = 5;
    try {
        let aiResult;
        if (uploadedPhoto) {
            // Send the original buffer directly — Flask expects multipart 'image'
            console.log('🤖 Sending image to Flask AI for classification...');
            aiResult = await classifyImage(
                uploadedPhoto.buffer,
                uploadedPhoto.originalname,
                uploadedPhoto.mimetype
            );
        } else {
            // JSON-only submission (no file): AI requires a real image, skip classification
            aiResult = await classifyImageFromUrl(photoUrl);
        }
        if (aiResult && aiResult.category) {
            aiCategory = normalizeAiCategory(aiResult.category);
            aiConfidence = aiResult.confidence ?? 0;
            severityScore = aiResult.severity ?? 5;
            console.log(`✅ AI Result: ${aiCategory} (confidence: ${aiConfidence}, severity: ${severityScore})`);
        }
    } catch (aiErr) {
        console.warn('⚠️  AI classification failed, using fallback values:', aiErr.message);
    }

    if (!ALLOWED_AI_CATEGORIES.has(aiCategory)) {
        aiCategory = 'other';
    }

    // ── 4. Save to MongoDB (if connected) ─────────────────────────
    let mongoId = null;
    if (mongoose.connection.readyState === 1) {
        try {
            console.log('Saving ticket image URL:', photoUrl);
            const doc = await TicketModel.create({
                description: description || '',
                photoUrl,
                location: {
                    type: 'Point',
                    coordinates: [parsedLongitude, parsedLatitude],
                },
                aiCategory,
                aiConfidence,
                severityScore,
                status: 'open',
                reportedBy: req.user ? (req.user.id || req.user._id) : null,
            });
            mongoId = doc._id;
        } catch (dbErr) {
            console.error('MongoDB save failed:', dbErr.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to save ticket to database.',
            });
        }
    }

    // ── 5. Sync in-memory store (keeps GET endpoints consistent) ──
    const ticket = createTicket({
        description,
        photoUrl,
        longitude: parsedLongitude,
        latitude: parsedLatitude,
        aiCategory,
        aiConfidence,
        severityScore,
        mongoId,
        reportedBy: req.user ? (req.user.id || req.user._id) : null,
    });

    // ── 6. Push real-time update to all admin dashboard clients ──
    broadcast('new_ticket', ticket);

    return res.status(201).json({
        success: true,
        data: withDisplayPhoto(ticket),
    });
}

async function patchTicketStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;

    // ── 1. Update in-memory store ──────────────────────────────────
    const updated = updateTicketStatus(id, status);

    // ── 2. Persist to MongoDB if connected ────────────────────────
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoDoc = await TicketModel.findByIdAndUpdate(
                id,
                { status },
                { new: true }
            );
            if (!mongoDoc && !updated) {
                return res.status(404).json({ success: false, error: 'Ticket not found.' });
            }
        } catch {
            // id may be an in-memory string id, not a Mongo ObjectId — fallback silently
        }
    }

    if (!updated) {
        return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }

    // Push real-time status update to admin dashboard clients
    broadcast('ticket_updated', { id, status });

    return res.status(200).json({ success: true, data: withDisplayPhoto(updated) });
}

async function getTicketById(req, res) {
    const { id } = req.params;

    // Use MongoDB as source of truth when connected
    if (mongoose.connection.readyState === 1) {
        try {
            const doc = await TicketModel.findById(id).lean();
            if (doc) {
                return res.status(200).json({ success: true, data: withDisplayPhoto(doc) });
            }
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        } catch {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }
    }

    // Fallback: in-memory store
    const ticket = getAllTickets().find((t) => t.id === id || t._id === id);
    if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }
    return res.status(200).json({ success: true, data: withDisplayPhoto(ticket) });
}

async function getDashboardStats(req, res) {
    if (mongoose.connection.readyState === 1) {
        try {
            const [statusAgg, categoryAgg, severityAgg] = await Promise.all([
                TicketModel.aggregate([
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ]),
                TicketModel.aggregate([
                    { $group: { _id: '$aiCategory', count: { $sum: 1 } } },
                ]),
                TicketModel.aggregate([
                    { $group: { _id: null, avg: { $avg: '$severityScore' }, total: { $sum: 1 } } },
                ]),
            ]);

            const byStatus = { open: 0, in_progress: 0, resolved: 0 };
            for (const s of statusAgg) {
                if (s._id in byStatus) byStatus[s._id] = s.count;
            }

            const byCategory = {};
            for (const c of categoryAgg) {
                byCategory[c._id || 'other'] = c.count;
            }

            const total = severityAgg[0]?.total ?? 0;
            const avgSeverity = total ? Math.round((severityAgg[0].avg ?? 0) * 10) / 10 : 0;

            return res.status(200).json({
                success: true,
                data: { total, byStatus, byCategory, avgSeverity },
            });
        } catch (err) {
            console.error('Stats MongoDB query failed:', err.message);
        }
    }

    // Fallback to in-memory counts (with geo-filter support)
    let filtered = [...getAllTickets()];
    filtered = applyGeoFilter(filtered, req.query);

    const byStatus = { open: 0, in_progress: 0, resolved: 0 };
    const byCategory = {};
    let severitySum = 0;
    for (const t of filtered) {
        if (t.status in byStatus) byStatus[t.status]++;
        const cat = t.aiCategory || 'other';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        severitySum += t.severityScore || 0;
    }
    const total = filtered.length;
    const avgSeverity = total ? Math.round((severitySum / total) * 10) / 10 : 0;

    return res.status(200).json({
        success: true,
        data: { total, byStatus, byCategory, avgSeverity },
    });
}

async function getMyTickets(req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const userId = req.user.id || req.user._id;

    const { status, category, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    let tickets = [];

    if (mongoose.connection.readyState === 1) {
        try {
            const query = { reportedBy: userId };
            if (status) query.status = status;
            if (category) query.aiCategory = category;

            const sortableFields = new Set(['severityScore', 'createdAt']);
            let sortField = 'createdAt';
            let sortDesc = true;
            if (sort) {
                const desc = sort.startsWith('-');
                const raw = desc ? sort.slice(1) : sort;
                const sortMap = { severity: 'severityScore' };
                const mapped = sortMap[raw] || raw;
                if (sortableFields.has(mapped)) {
                    sortField = mapped;
                    sortDesc = desc;
                }
            }

            const sortObj = {};
            sortObj[sortField] = sortDesc ? -1 : 1;

            tickets = await TicketModel.find(query).sort(sortObj).lean();
        } catch (err) {
            console.error('MongoDB getMyTickets query failed:', err.message);
        }
    } else {
        const filtered = applyGeoFilter([...getAllTickets()], req.query);
        tickets = filtered.filter(t => String(t.reportedBy) === String(userId));
        if (status) {
            tickets = tickets.filter(t => t.status === status);
        }
        if (category) {
            tickets = tickets.filter(t => t.aiCategory === category);
        }
        
        const sortableFields = new Set(['severityScore', 'createdAt']);
        let sortField = 'createdAt';
        let sortDesc = true;
        if (sort) {
            const desc = sort.startsWith('-');
            const raw = desc ? sort.slice(1) : sort;
            const sortMap = { severity: 'severityScore' };
            const mapped = sortMap[raw] || raw;
            if (sortableFields.has(mapped)) {
                sortField = mapped;
                sortDesc = desc;
            }
        }
        tickets.sort((a, b) => {
            let cmp;
            if (sortField === 'createdAt') {
                cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else {
                cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
            }
            return sortDesc ? -cmp : cmp;
        });
    }

    const total = tickets.length;
    const start = (page - 1) * limit;
    const paginated = tickets.slice(start, start + limit).map(withDisplayPhoto);

    return res.status(200).json({
        success: true,
        count: paginated.length,
        total,
        page,
        data: paginated,
    });
}

module.exports = {
    getTickets,
    postTicket,
    patchTicketStatus,
    getTicketById,
    getDashboardStats,
    getMyTickets,
};
