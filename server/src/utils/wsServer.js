/**
 * CivicLens WebSocket Server
 *
 * Attached to the existing Express HTTP server so clients can receive
 * real-time push notifications without a separate port.
 *
 * Message envelope:
 *   { type: 'new_ticket'     | 'ticket_updated' | 'ping',
 *     payload: <ticket doc>  | { id, status }   | null }
 */
const { WebSocketServer } = require('ws');

let wss = null; // singleton

/**
 * Attach the WebSocket server to an existing http.Server instance.
 * Call this once in server.js after app.listen().
 */
function attachWss(httpServer) {
    // path: '/ws' keeps app WebSocket separate from Vite’s HMR WebSocket
    // so the Vite proxy can forward /ws → backend cleanly
    wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    // Prevent unhandled 'error' crashes when the underlying HTTP server errors.
    wss.on('error', (err) => {
        console.error('WebSocket server error:', err.message);
    });

    wss.on('connection', (ws, req) => {
        // Send a welcome ping so clients know the handshake succeeded
        ws.send(JSON.stringify({ type: 'ping', payload: null }));

        ws.on('error', () => {}); // swallow per-socket errors silently
    });

    // Keep-alive: ping all clients every 25 s to prevent idle disconnects
    setInterval(() => {
        if (!wss) return;
        wss.clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({ type: 'ping', payload: null }));
            }
        });
    }, 25_000);
}

/**
 * Broadcast a structured message to all connected WebSocket clients.
 * Safe to call before attachWss (no-op if wss is null).
 * @param {'new_ticket'|'ticket_updated'} type
 * @param {object} payload
 */
function broadcast(type, payload) {
    if (!wss) return;
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            try { client.send(msg); } catch {}
        }
    });
}

module.exports = { attachWss, broadcast };
