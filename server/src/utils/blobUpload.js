const path = require('path');
const {
    BlobServiceClient,
    BlobSASPermissions,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
} = require('@azure/storage-blob');

function getBlobExtension(originalName, mimeType) {
    const extFromName = path.extname(originalName || '').toLowerCase();
    if (extFromName) {
        return extFromName;
    }

    const mimeToExt = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
    };

    return mimeToExt[mimeType] || '.jpg';
}

function buildBlobName(originalName, mimeType) {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    const ext = getBlobExtension(originalName, mimeType);
    return `ticket-${stamp}-${rand}${ext}`;
}

function parseConnectionString(connectionString) {
    const segments = connectionString.split(';').map((s) => s.trim()).filter(Boolean);
    const map = {};
    for (const seg of segments) {
        const idx = seg.indexOf('=');
        if (idx > 0) {
            const key = seg.slice(0, idx);
            const val = seg.slice(idx + 1);
            map[key] = val;
        }
    }
    return map;
}

function buildBlobReadUrlWithSas({ connectionString, containerName, blobName, fallbackUrl }) {
    try {
        const parsed = parseConnectionString(connectionString);
        const accountName = parsed.AccountName;
        const accountKey = parsed.AccountKey;
        if (!accountName || !accountKey) return fallbackUrl;

        const credential = new StorageSharedKeyCredential(accountName, accountKey);
        const expiresOn = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 1 year read URL
        const sasToken = generateBlobSASQueryParameters(
            {
                containerName,
                blobName,
                permissions: BlobSASPermissions.parse('r'),
                startsOn: new Date(Date.now() - 5 * 60 * 1000),
                expiresOn,
            },
            credential,
        ).toString();

        return `${fallbackUrl}?${sasToken}`;
    } catch {
        return fallbackUrl;
    }
}

async function uploadBufferToBlob({ buffer, originalName, mimeType }) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'ticket-image';

    if (!connectionString) {
        throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured.');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    await containerClient.createIfNotExists();

    const blobName = buildBlobName(originalName, mimeType);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
            blobContentType: mimeType || 'application/octet-stream',
        },
    });

    const blobUrl = buildBlobReadUrlWithSas({
        connectionString,
        containerName,
        blobName,
        fallbackUrl: blockBlobClient.url,
    });

    return {
        blobName,
        blobUrl,
    };
}

module.exports = {
    uploadBufferToBlob,
};
