const axios = require('axios');
const FormData = require('form-data');

/**
 * Classify an image by sending its raw buffer as multipart/form-data.
 * Flask endpoint expects POST /classify with field name "image".
 */
async function classifyImage(imageBuffer, filename, mimeType) {
    const baseUrl = process.env.FLASK_API_URL || process.env.AI_SERVICE_URL || 'http://localhost:5000';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/classify`;

    const formData = new FormData();
    formData.append('image', imageBuffer, {
        filename: filename || 'photo.jpg',
        contentType: mimeType || 'image/jpeg',
    });

    const { data } = await axios.post(endpoint, formData, {
        headers: { ...formData.getHeaders() },
        // First classify call can be slower; avoid false fallback to unclassified.
        timeout: 30000,
    });

    return {
        category: data?.category,
        confidence: data?.confidence,
        severity: data?.severity,
    };
}

/**
 * Legacy stub for URL-only submissions (no file buffer available).
 * Flask requires an actual image file so we return unclassified defaults.
 */
async function classifyImageFromUrl(_photoUrl) {
    return { category: 'unclassified', confidence: 0, severity: 5 };
}

module.exports = {
    classifyImage,
    classifyImageFromUrl,
};
