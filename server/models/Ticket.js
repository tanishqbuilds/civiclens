const mongoose = require('mongoose');

const ticketUpdateSchema = new mongoose.Schema(
    {
        message: { type: String, required: true, trim: true, maxlength: 1000 },
        postedBy: { type: String, ref: 'User', required: true },
        postedByName: { type: String, default: '' },
    },
    { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
    {
        // --- Citizen Input ---
        city: {
            type: String,
            trim: true,
            default: '',
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        photoUrl: {
            type: String,
            required: [true, 'Photo URL is required'],
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
                required: true,
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: [true, 'GPS coordinates are required'],
                validate: {
                    validator: function (v) {
                        return (
                            v.length === 2 &&
                            v[0] >= -180 && v[0] <= 180 &&
                            v[1] >= -90 && v[1] <= 90
                        );
                    },
                    message: 'Invalid coordinates. Must be [longitude, latitude].',
                },
            },
        },

        // --- AI-Generated Fields ---
        aiCategory: {
            type: String,
            enum: ['pothole', 'garbage_dump', 'electrical_hazard', 'waterlogging', 'blocked_drain', 'clean_street', 'unclassified'],
            default: 'unclassified',
        },
        aiConfidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0,
        },
        severityScore: {
            type: Number,
            min: 1,
            max: 10,
            default: 5,
        },

        // --- Reporter (optional — anonymous submissions have no reporter) ---
        reportedBy: {
            type: String,
            ref: 'User',
            default: null,
        },

        // --- Assignment ---
        assignedTo: {
            type: String,
            ref: 'User',
            default: null,
        },
        assignedOfficerName: {
            type: String,
            default: '',
        },

        // --- Live Updates from Officer ---
        updates: [ticketUpdateSchema],

        // --- Workflow ---
        status: {
            type: String,
            enum: ['open', 'in_progress', 'resolved'],
            default: 'open',
        },
    },
    {
        timestamps: true,
    }
);

// Geospatial index for map queries
ticketSchema.index({ location: '2dsphere' });

// Compound index for dashboard sorting
ticketSchema.index({ status: 1, severityScore: -1 });

// Index for officer assignment queries
ticketSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
