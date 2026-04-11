const multer = require('multer');

// Memory storage only for Phase 1 scaffolding.
// File persistence and cloud upload will be added in later phases.
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB — phone cameras can produce 5-8 MB JPEGs
    },
});

module.exports = {
    upload,
};
