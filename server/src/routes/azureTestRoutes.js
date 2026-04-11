const express = require('express');
const { uploadAzureConnectivityTest } = require('../utils/blobTest');

const router = express.Router();

router.get('/test-azure', async (req, res) => {
    try {
        const result = await uploadAzureConnectivityTest();
        res.status(200).json({
            success: true,
            message: 'Azure Blob upload test succeeded.',
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

module.exports = router;
