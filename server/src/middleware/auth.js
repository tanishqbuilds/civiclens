const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'civiclens-fallback-secret';

/**
 * Verify admin JWT token (used for admin dashboard routes)
 */
function verifyToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = header.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

/**
 * Verify user JWT token (used for citizen/officer routes)
 */
function verifyUserToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const token = header.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
}

/**
 * Optional user token — attaches user if token exists, but does NOT block the request.
 * Used for routes where auth is optional (e.g., anonymous ticket submission).
 */
function optionalUserToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return next();
    }

    const token = header.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch {
        // Silently ignore invalid tokens for optional auth
    }
    next();
}

/**
 * Verify ANY valid JWT token — works for both admin and user (officer/citizen) tokens.
 * Sets req.admin AND/OR req.user so downstream controllers can check either.
 */
function verifyAnyToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = header.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // If the token has a 'role' field, it's a user token (citizen/officer)
        if (decoded.role) {
            req.user = decoded;
        } else {
            req.admin = decoded;
        }
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
}

module.exports = { verifyToken, verifyUserToken, optionalUserToken, verifyAnyToken };
