const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../../models/User');
const { verifyUserToken, verifyToken } = require('../middleware/auth');
const { uploadToCloudinary } = require('../utils/cloudinary');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'civiclens-fallback-secret';
const TOKEN_EXPIRY = '7d';

// Multer — memory storage so we can pipe buffer to Cloudinary
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Generate JWT for a user
 */
function generateToken(user) {
    return jwt.sign(
        { id: user._id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

/**
 * POST /api/users/signup
 * Register a new citizen or officer
 */
router.post('/signup', upload.single('idProof'), async (req, res) => {
    const { name, email, password, role, phone, department, city, issueCategory } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    // Validate role
    const userRole = ['citizen', 'officer'].includes(role) ? role : 'citizen';

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
        }

        // Upload ID proof to Cloudinary if provided
        let idProofUrl = '';
        if (req.file && userRole === 'officer') {
            try {
                idProofUrl = await uploadToCloudinary(req.file.buffer, 'civiclens/id-proofs');
            } catch (uploadErr) {
                console.error('ID proof upload failed:', uploadErr.message);
                return res.status(500).json({ success: false, error: 'Failed to upload ID proof.' });
            }
        }

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: userRole,
            status: userRole === 'officer' ? 'pending' : 'approved',
            phone: phone || '',
            department: userRole === 'officer' ? (department || '') : '',
            issueCategory: userRole === 'officer' ? (issueCategory || '') : '',
            jurisdiction: userRole === 'officer' ? { city: city || '' } : undefined,
            idProofUrl,
        });

        const token = generateToken(user);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                phone: user.phone,
                department: user.department,
                issueCategory: user.issueCategory,
                jurisdiction: user.jurisdiction,
                idProofUrl: user.idProofUrl,
            },
        });
    } catch (err) {
        console.error('Signup error:', err.message);
        if (err.code === 11000) {
            return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
        }
        res.status(500).json({ success: false, error: 'Server error during signup.' });
    }
});

/**
 * POST /api/users/login
 * Authenticate an existing user
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        // Block pending/rejected officers
        if (user.role === 'officer' && user.status !== 'approved') {
            const msg = user.status === 'pending'
                ? 'Your officer account is pending admin approval. Please wait for approval.'
                : 'Your officer account has been rejected by the admin.';
            return res.status(403).json({ success: false, error: msg });
        }

        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                phone: user.phone,
                department: user.department,
                issueCategory: user.issueCategory,
                jurisdiction: user.jurisdiction,
                idProofUrl: user.idProofUrl,
            },
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ success: false, error: 'Server error during login.' });
    }
});

/**
 * GET /api/users/me
 * Get current user profile (requires auth)
 */
router.get('/me', verifyUserToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                phone: user.phone,
                department: user.department,
                issueCategory: user.issueCategory,
                jurisdiction: user.jurisdiction,
                idProofUrl: user.idProofUrl,
                avatar: user.avatar,
                createdAt: user.createdAt,
            },
        });
    } catch (err) {
        console.error('Profile fetch error:', err.message);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

/**
 * PATCH /api/users/link-ticket
 * Link an anonymous ticket to the current user (for post-report tracking)
 */
router.patch('/link-ticket', verifyUserToken, async (req, res) => {
    const { ticketId } = req.body;
    if (!ticketId) {
        return res.status(400).json({ success: false, error: 'ticketId is required.' });
    }

    try {
        const TicketModel = require('../../models/Ticket');
        const ticket = await TicketModel.findById(ticketId);
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }

        // Only link if not already linked
        if (!ticket.reportedBy) {
            ticket.reportedBy = req.user.id;
            await ticket.save();
        }

        res.json({ success: true, data: ticket });
    } catch (err) {
        console.error('Link ticket error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to link ticket.' });
    }
});

/**
 * GET /api/users/reputation
 * Get the neuro-fuzzy reputation score for the current user
 */
router.get('/reputation', verifyUserToken, async (req, res) => {
    const axios = require('axios');
    const flaskUrl = process.env.FLASK_API_URL || 'http://localhost:5000';

    try {
        const { data } = await axios.post(`${flaskUrl}/reputation`, {
            userId: req.user.id,
        }, { timeout: 10000 });

        res.json(data);
    } catch (err) {
        // Reputation is optional — gracefully degrade
        console.error('Reputation fetch error:', err.message);
        res.json({
            success: true,
            user_id: req.user.id,
            reputation_score: null,
            metrics: null,
            error: 'Reputation service unavailable',
        });
    }
});

/**
 * GET /api/users/notifications
 * Get notifications for the current user
 */
router.get('/notifications', verifyUserToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('notifications');
        if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

        // Return sorted by newest first, limit to 50
        const notifications = (user.notifications || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 50);

        const unreadCount = notifications.filter(n => !n.read).length;

        res.json({ success: true, data: notifications, unreadCount });
    } catch (err) {
        console.error('Notifications fetch error:', err.message);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

/**
 * PATCH /api/users/notifications/read
 * Mark all notifications as read
 */
router.patch('/notifications/read', verifyUserToken, async (req, res) => {
    try {
        await User.updateOne(
            { _id: req.user.id },
            { $set: { 'notifications.$[].read': true } }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err.message);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

/**
 * PATCH /api/users/:id/approve
 * Admin approves an officer
 */
router.patch('/:id/approve', verifyToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status: 'approved' },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

/**
 * PATCH /api/users/:id/reject
 * Admin rejects an officer
 */
router.patch('/:id/reject', verifyToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

/**
 * GET /api/users
 * Get all users for Admin Dashboard
 */
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = router;
