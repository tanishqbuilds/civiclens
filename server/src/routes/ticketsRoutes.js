const express = require('express');
const { getTickets, postTicket, patchTicketStatus, getTicketById, getDashboardStats } = require('../controllers/ticketsController');
const { upload } = require('../config/multer');
const { validatePostTicket, validatePatchTicket } = require('../middleware/validate');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicketById);
router.post('/tickets', upload.single('photo'), validatePostTicket, postTicket);
router.patch('/tickets/:id', verifyToken, validatePatchTicket, patchTicketStatus);

// Catch multer / upload errors and return JSON (prevents HTML 500 responses)
router.use((err, req, res, next) => {
    if (err && err.code) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'Image too large. Maximum size is 10 MB.'
            : `Upload error: ${err.message}`;
        return res.status(400).json({ success: false, error: msg });
    }
    next(err);
});

module.exports = router;
