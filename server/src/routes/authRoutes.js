const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findAdminByUsername } = require('../models/adminStore');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'civiclens-fallback-secret';
const TOKEN_EXPIRY = '40m';

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const admin = findAdminByUsername(username);
    if (!admin) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, admin.passwordHash);
    if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: admin.id, username: admin.username, role: admin.role, jurisdiction: admin.jurisdiction ?? null },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
        token,
        admin: { id: admin.id, username: admin.username, role: admin.role, jurisdiction: admin.jurisdiction ?? null },
    });
});

// GET /api/auth/verify  — validate existing token
router.get('/verify', verifyToken, (req, res) => {
    res.json({ valid: true, admin: req.admin });
});

module.exports = router;
