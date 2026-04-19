const { BlobServiceClient } = require('@azure/storage-blob');

function getAzureContainerName() {
    return process.env.AZURE_CONTAINER_NAME || process.env.AZURE_STORAGE_CONTAINER_NAME || 'ticket-image';
}

async function uploadAzureConnectivityTest() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = getAzureContainerName();

    if (!connectionString) {
        throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured.');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create the container if it does not exist so first-time setup succeeds.
    await containerClient.createIfNotExists();

    const blobName = `azure-test-${Date.now()}.txt`;
    const payload = Buffer.from(`Azure connectivity test at ${new Date().toISOString()}`, 'utf8');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(payload, {
        blobHTTPHeaders: {
            blobContentType: 'text/plain',
        },
    });

    return {
        blobName,
        blobUrl: blockBlobClient.url,
    };
}

module.exports = {
    uploadAzureConnectivityTest,
};
