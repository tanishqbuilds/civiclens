const express = require('express');
const ticketsController = require('../controllers/ticketsController');
const { upload } = require('../config/multer');
const { validatePostTicket, validatePatchTicket } = require('../middleware/validate');
const { verifyToken, optionalUserToken, verifyUserToken } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', ticketsController.getDashboardStats);
router.get('/tickets/my', verifyUserToken, ticketsController.getMyTickets);
router.get('/tickets', ticketsController.getTickets);
router.get('/tickets/:id', ticketsController.getTicketById);
router.post('/tickets', upload.single('photo'), optionalUserToken, validatePostTicket, ticketsController.postTicket);
router.patch('/tickets/:id', verifyToken, validatePatchTicket, ticketsController.patchTicketStatus);
router.patch('/tickets/:id/assign', verifyToken, ticketsController.assignOfficer);

// Live updates on tickets
router.get('/tickets/:id/updates', ticketsController.getTicketUpdates);
router.post('/tickets/:id/updates', verifyUserToken, ticketsController.addTicketUpdate);

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
