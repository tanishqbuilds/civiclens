/**
 * CivicLens Debug Logger
 *
 * Logs are suppressed in production.
 * Enable in two ways without shipping to prod:
 *   1. Vite dev mode (import.meta.env.DEV === true)
 *   2. Append ?debug=1 to any URL — persists for the session
 *
 * Usage:
 *   import { debugLog } from '../utils/debug';
 *   debugLog('ws:event', { type, payload });   // shown only in dev / ?debug=1
 */

function isDebug() {
    try {
        // Vite dev mode
        if (import.meta.env.DEV) return true;
    } catch {}
    // Session override: ?debug=1 in URL
    return new URLSearchParams(window.location.search).get('debug') === '1';
}

export function debugLog(label, ...args) {
    if (!isDebug()) return;
    // Prefix with [CivicLens] so it's easy to grep in DevTools
    console.log(`%c[CivicLens] ${label}`, 'color:#4F46E5;font-weight:bold', ...args);
}
