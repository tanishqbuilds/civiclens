const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const notificationSchema = new mongoose.Schema(
    {
        message: { type: String, required: true },
        ticketId: { type: String, default: null },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: 100,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Don't return password in queries by default
        },
        role: {
            type: String,
            enum: ['citizen', 'officer'],
            default: 'citizen',
        },
        // Officer approval status
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved', // citizens get auto-approved; officers set to 'pending' at signup
        },
        phone: {
            type: String,
            trim: true,
            default: '',
        },
        // Officer-specific fields
        department: {
            type: String,
            trim: true,
            default: '',
        },
        // The issue domain this officer handles
        issueCategory: {
            type: String,
            enum: ['pothole', 'garbage_dump', 'electrical_hazard', 'waterlogging', 'blocked_drain', 'clean_street', 'unclassified', ''],
            default: '',
        },
        jurisdiction: {
            city: { type: String, default: '' },
            center: { type: [Number], default: undefined },
            radiusKm: { type: Number, default: 30 },
        },
        idProofUrl: {
            type: String,
            default: '',
        },
        avatar: {
            type: String,
            default: '',
        },
        // In-app notifications
        notifications: [notificationSchema],
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

// Index for quick lookups
userSchema.index({ role: 1 });
userSchema.index({ role: 1, status: 1, 'jurisdiction.city': 1, issueCategory: 1 });

module.exports = mongoose.model('User', userSchema);
