const express = require('express');
<<<<<<< HEAD
const { getTickets, postTicket, patchTicketStatus, getTicketById, getDashboardStats, getMyTickets } = require('../controllers/ticketsController');
const { upload } = require('../config/multer');
const { validatePostTicket, validatePatchTicket } = require('../middleware/validate');
const { verifyToken, optionalUserToken, verifyUserToken } = require('../middleware/auth');
=======
const { getTickets, postTicket, patchTicketStatus, getTicketById, getDashboardStats } = require('../controllers/ticketsController');
const { upload } = require('../config/multer');
const { validatePostTicket, validatePatchTicket } = require('../middleware/validate');
const { verifyToken } = require('../middleware/auth');
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38

const router = express.Router();

router.get('/stats', getDashboardStats);
<<<<<<< HEAD
router.get('/tickets/my', verifyUserToken, getMyTickets);
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicketById);
router.post('/tickets', upload.single('photo'), optionalUserToken, validatePostTicket, postTicket);
=======
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicketById);
router.post('/tickets', upload.single('photo'), validatePostTicket, postTicket);
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
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
