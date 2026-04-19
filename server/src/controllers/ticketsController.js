const { getAllTickets, createTicket, updateTicketStatus, getStats } = require('../models/ticketStore');
const { classifyImage, classifyImageFromUrl } = require('../utils/aiClassifier');
const { broadcast } = require('../utils/wsServer');
const TicketModel = require('../../models/Ticket');
const UserModel = require('../../models/User');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { uploadToCloudinary } = require('../utils/cloudinary');

const ALLOWED_STATUS = ['open', 'in_progress', 'resolved'];
const AZURE_BLOB_PREFIX = 'https://optimumhackoverflow.blob.core.windows.net/ticket-images/';
const ALLOWED_AI_CATEGORIES = new Set([
    'pothole',
    'garbage_dump',
    'electrical_hazard',
    'waterlogging',
    'blocked_drain',
    'clean_street',
    'unclassified',
]);

function normalizeTicketPhotoForDisplay(photoUrl) {
    if (!photoUrl || typeof photoUrl !== 'string') return null;

    const trimmed = photoUrl.trim();
    if (!trimmed) return null;

    const stripQuery = (url) => url.split('?')[0];

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

    // Cloudinary URLs
    if (/^https?:\/\/res\.cloudinary\.com\//i.test(trimmed)) {
        return trimmed;
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
    
    // Direct match for standardized keys
    const validCategories = new Set(['pothole', 'garbage_dump', 'waterlogging', 'electrical_hazard', 'blocked_drain', 'clean_street']);
    if (validCategories.has(normalized)) return normalized;

    // Mapping for legacy or slightly different AI outputs
    const mapping = {
        'garbage dump': 'garbage_dump',
        'garbage': 'garbage_dump',
        'sanitation': 'garbage_dump',
        'broken streetlight': 'electrical_hazard',
        'electrical hazard': 'electrical_hazard',
        'open drain': 'blocked_drain',
        'blocked drain': 'blocked_drain',
        'open/blocked drain': 'blocked_drain',
        'flooding': 'waterlogging',
        'clean street': 'clean_street'
    };

    return mapping[normalized] || 'unclassified';
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

/**
 * Auto-assign a ticket to a matching officer based on city + issueCategory.
 * Returns { officerId, officerName } or null if no match.
 */
async function autoAssignOfficer(city, issueCategory) {
    if (!city || !issueCategory) return null;

    try {
        // Find approved officers matching city and category
        const matchingOfficers = await UserModel.find({
            role: 'officer',
            status: 'approved',
            'jurisdiction.city': city,
            issueCategory: issueCategory,
        }).select('_id name').lean();

        if (matchingOfficers.length === 0) return null;

        if (matchingOfficers.length === 1) {
            return { officerId: String(matchingOfficers[0]._id), officerName: matchingOfficers[0].name };
        }

        // Load-balance: pick officer with fewest open/in_progress tickets
        const officerIds = matchingOfficers.map(o => String(o._id));
        const counts = await TicketModel.aggregate([
            { $match: { assignedTo: { $in: officerIds }, status: { $in: ['open', 'in_progress'] } } },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        ]);

        const countMap = {};
        for (const c of counts) countMap[c._id] = c.count;

        let bestOfficer = matchingOfficers[0];
        let bestCount = countMap[String(bestOfficer._id)] || 0;

        for (const officer of matchingOfficers) {
            const cnt = countMap[String(officer._id)] || 0;
            if (cnt < bestCount) {
                bestOfficer = officer;
                bestCount = cnt;
            }
        }

        return { officerId: String(bestOfficer._id), officerName: bestOfficer.name };
    } catch (err) {
        console.error('Auto-assign error:', err.message);
        return null;
    }
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

    // Parse Mongoose-style sort
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
    const { description, longitude, latitude, city } = req.body;
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
            console.log('🤖 Sending image to Flask AI for classification...');
            aiResult = await classifyImage(
                uploadedPhoto.buffer,
                uploadedPhoto.originalname,
                uploadedPhoto.mimetype
            );
        } else {
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
        aiCategory = 'unclassified';
    }

    // ── 4. Auto-assign officer ──
    let assignment = null;
    // Don't auto-assign unclassified or clean streets
    if (aiCategory !== 'unclassified' && aiCategory !== 'clean_street') {
        assignment = await autoAssignOfficer(city, aiCategory);
    }

    // ── 5. Save to MongoDB (if connected) ─────────────────────────
    let mongoId = null;
    const reportedBy = req.user ? (req.user.id || req.user._id) : null;
    if (mongoose.connection.readyState === 1) {
        try {
            console.log('Saving ticket image URL:', photoUrl);
            const doc = await TicketModel.create({
                description: description || '',
                city: city || '',
                photoUrl,
                location: {
                    type: 'Point',
                    coordinates: [parsedLongitude, parsedLatitude],
                },
                aiCategory,
                aiConfidence,
                severityScore,
                status: 'open',
                reportedBy,
                assignedTo: assignment?.officerId || null,
                assignedOfficerName: assignment?.officerName || '',
            });
            mongoId = doc._id;

            // ── Create notification for citizen ──
            if (reportedBy && assignment) {
                await UserModel.updateOne(
                    { _id: reportedBy },
                    {
                        $push: {
                            notifications: {
                                message: `Your complaint has been assigned to Officer ${assignment.officerName}`,
                                ticketId: String(doc._id),
                                read: false,
                            },
                        },
                    }
                );
            }

            // ── Create notification for assigned officer ──
            if (assignment) {
                await UserModel.updateOne(
                    { _id: assignment.officerId },
                    {
                        $push: {
                            notifications: {
                                message: `New ${aiCategory.replace('_', ' ')} issue assigned to you in ${city || 'your area'}`,
                                ticketId: String(doc._id),
                                read: false,
                            },
                        },
                    }
                );
            }
        } catch (dbErr) {
            console.error('MongoDB save failed:', dbErr.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to save ticket to database.',
            });
        }
    }

    // ── 6. Sync in-memory store ──
    const ticket = createTicket({
        description,
        city: city || '',
        photoUrl,
        longitude: parsedLongitude,
        latitude: parsedLatitude,
        aiCategory,
        aiConfidence,
        severityScore,
        mongoId,
        reportedBy,
        assignedTo: assignment?.officerId || null,
        assignedOfficerName: assignment?.officerName || '',
    });

    // ── 7. Push real-time update ──
    broadcast('new_ticket', ticket);

    return res.status(201).json({
        success: true,
        data: withDisplayPhoto(ticket),
    });
}

async function patchTicketStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;

    const updated = updateTicketStatus(id, status);

    if (mongoose.connection.readyState === 1) {
        try {
            const mongoDoc = await TicketModel.findByIdAndUpdate(
                id,
                { status },
                { new: true }
            ).lean();
            if (!mongoDoc && !updated) {
                return res.status(404).json({ success: false, error: 'Ticket not found.' });
            }

            // Notify citizen about status change
            if (mongoDoc && mongoDoc.reportedBy) {
                const statusLabel = status.replace('_', ' ');
                await UserModel.updateOne(
                    { _id: mongoDoc.reportedBy },
                    {
                        $push: {
                            notifications: {
                                message: `Your ${(mongoDoc.issueCategory || mongoDoc.aiCategory || 'issue').replace('_', ' ')} complaint status changed to "${statusLabel}"`,
                                ticketId: String(mongoDoc._id),
                                read: false,
                            },
                        },
                    }
                );
            }

            // Notify assigned officer about status change (if changed by admin)
            if (mongoDoc && mongoDoc.assignedTo && req.admin) {
                await UserModel.updateOne(
                    { _id: mongoDoc.assignedTo },
                    {
                        $push: {
                            notifications: {
                                message: `Admin updated ticket status to "${status.replace('_', ' ')}" for a ${(mongoDoc.issueCategory || '').replace('_', ' ')} issue`,
                                ticketId: String(mongoDoc._id),
                                read: false,
                            },
                        },
                    }
                );
            }
        } catch {
            // id may be an in-memory string id, not a Mongo ObjectId
        }
    }

    if (!updated) {
        return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }

    broadcast('ticket_updated', { id, status });

    return res.status(200).json({ success: true, data: withDisplayPhoto(updated) });
}

async function getTicketById(req, res) {
    const { id } = req.params;

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
    const userId = req.user ? (req.user.id || req.user._id) : null;
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: User ID missing' });
    }

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
                const isDesc = sort.startsWith('-');
                const rawField = isDesc ? sort.slice(1) : sort;
                if (sortableFields.has(rawField)) {
                    sortField = rawField;
                    sortDesc = isDesc;
                }
            }

            tickets = await TicketModel.find(query)
                .sort({ [sortField]: sortDesc ? -1 : 1 })
                .lean();
        } catch (err) {
            console.error('MongoDB query failed, falling back to memory:', err.message);
            tickets = getAllTickets().filter(t => String(t.reportedBy) === String(userId));
        }
    } else {
        tickets = getAllTickets().filter(t => String(t.reportedBy) === String(userId));
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

/**
 * POST /api/tickets/:id/updates — Officer posts a live update on a ticket
 */
async function addTicketUpdate(req, res) {
    const { id } = req.params;
    const { message } = req.body;
    const officerId = req.user?.id || req.user?._id;
    const officerName = req.user?.name || 'Officer';

    if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Update message is required.' });
    }

    try {
        const ticket = await TicketModel.findByIdAndUpdate(
            id,
            {
                $push: {
                    updates: {
                        message: message.trim(),
                        postedBy: officerId,
                        postedByName: officerName,
                    },
                },
            },
            { new: true }
        ).lean();

        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }

        // Create notification for the citizen who reported this ticket
        if (ticket.reportedBy) {
            await UserModel.updateOne(
                { _id: ticket.reportedBy },
                {
                    $push: {
                        notifications: {
                            message: `Officer ${officerName} posted an update on your ${(ticket.issueCategory || ticket.aiCategory || '').replace('_', ' ')} complaint`,
                            ticketId: String(ticket._id),
                            read: false,
                        },
                    },
                }
            );
        }

        // Broadcast real-time update
        broadcast('ticket_update', { ticketId: id, update: ticket.updates[ticket.updates.length - 1] });

        return res.status(200).json({ success: true, data: ticket.updates });
    } catch (err) {
        console.error('Add update error:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to add update.' });
    }
}

/**
 * GET /api/tickets/:id/updates — Get all updates for a ticket
 */
async function getTicketUpdates(req, res) {
    const { id } = req.params;

    try {
        const ticket = await TicketModel.findById(id).select('updates').lean();
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }
        return res.status(200).json({ success: true, data: ticket.updates || [] });
    } catch (err) {
        console.error('Get updates error:', err.message);
        return res.status(500).json({ success: false, error: 'Server error.' });
    }
}

/**
 * PATCH /api/tickets/:id/assign — Manually assign an officer to a ticket (Admin only)
 */
async function assignOfficer(req, res) {
    const { id } = req.params;
    const { officerId } = req.body;

    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        return res.status(403).json({ success: false, error: 'Unauthorized to assign officers' });
    }

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(officerId)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }

    try {
        const officer = await UserModel.findById(officerId).lean();
        if (!officer || officer.role !== 'officer') {
            return res.status(404).json({ success: false, error: 'Officer not found' });
        }

        const ticket = await TicketModel.findByIdAndUpdate(
            id,
            {
                assignedTo: officer._id,
                assignedOfficerName: officer.name
            },
            { new: true }
        ).lean();

        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        // Notify the officer
        await UserModel.findByIdAndUpdate(
            officer._id,
            {
                $push: {
                    notifications: {
                        message: `You have been manually assigned to a new ticket: ${ticket.aiCategory}`,
                        type: 'system',
                        createdAt: new Date(),
                        link: `/officer?ticketId=${ticket._id}`
                    }
                }
            }
        );

        broadcast('ticket_update', { id, status: ticket.status, assignedTo: officer._id, assignedOfficerName: officer.name });

        return res.status(200).json({ success: true, data: withDisplayPhoto(ticket) });
    } catch (err) {
        console.error('Assign officer error:', err.message);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
}

module.exports = {
    getTickets,
    postTicket,
    patchTicketStatus,
    getTicketById,
    getDashboardStats,
    getMyTickets,
    addTicketUpdate,
    getTicketUpdates,
    assignOfficer,
};
