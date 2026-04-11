const tickets = [];

let nextId = 1;

function createSeedTicket({
    description,
    photoUrl,
    longitude,
    latitude,
    aiCategory,
    aiConfidence,
    severityScore,
    status,
}) {
    const ticketId = String(nextId++);
    return {
        id: ticketId,
        _id: ticketId,
        description,
        photoUrl,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude],
        },
        aiCategory,
        aiConfidence,
        severityScore,
        status,
        createdAt: new Date().toISOString(),
    };
}

function seedTickets() {
    // Intentionally disabled for real ticket testing.
    // Keep function for compatibility with existing startup flow.
    return;
}

function getAllTickets() {
    return tickets;
}

function createTicket({ description, photoUrl, longitude, latitude, aiCategory, aiConfidence, severityScore, mongoId }) {
    const ticketId = mongoId ? String(mongoId) : String(nextId++);
    if (!mongoId) nextId = Math.max(nextId, Number(ticketId) + 1);
    const newTicket = {
        id: ticketId,
        _id: ticketId,
        description: description || '',
        photoUrl,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude],
        },
        aiCategory: aiCategory || 'unclassified',
        aiConfidence: aiConfidence ?? 0,
        severityScore: severityScore ?? 5,
        status: 'open',
        createdAt: new Date().toISOString(),
    };

    tickets.push(newTicket);
    return newTicket;
}

function updateTicketStatus(id, status) {
    const matchId = String(id);
    const ticket = tickets.find((item) => item.id === matchId || item._id === matchId);
    if (!ticket) {
        return null;
    }

    ticket.status = status;
    return ticket;
}

function getStats() {
    const byStatus = { open: 0, in_progress: 0, resolved: 0 };
    const byCategory = {};
    let severitySum = 0;

    for (const t of tickets) {
        if (t.status in byStatus) byStatus[t.status]++;
        const cat = t.aiCategory || 'other';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        severitySum += t.severityScore || 0;
    }

    const total = tickets.length;
    const avgSeverity = total ? Math.round((severitySum / total) * 10) / 10 : 0;

    return { total, byStatus, byCategory, avgSeverity };
}

/** Bulk-load MongoDB documents into the in-memory store (called on startup). */
function loadFromMongo(docs) {
    for (const doc of docs) {
        const id = String(doc._id);
        tickets.push({
            id,
            _id: id,
            description: doc.description || '',
            photoUrl: doc.photoUrl,
            location: doc.location,
            aiCategory: doc.aiCategory || 'unclassified',
            aiConfidence: doc.aiConfidence ?? 0,
            severityScore: doc.severityScore ?? 5,
            status: doc.status || 'open',
            createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        });
    }
    if (docs.length) console.log(`📦 Loaded ${docs.length} tickets from MongoDB into memory`);
}

module.exports = {
    seedTickets,
    getAllTickets,
    createTicket,
    updateTicketStatus,
    getStats,
    loadFromMongo,
};
