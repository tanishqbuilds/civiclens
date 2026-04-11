import axios from 'axios';

export const API_BASE = "https://d3coujrx9zr1yv.cloudfront.net";

const API_ROOT = import.meta.env.DEV
    ? "http://localhost:3001"
    : (import.meta.env.VITE_API_BASE || API_BASE);

const API = axios.create({
    baseURL: `${API_ROOT}/api`,
    timeout: 30000, // 30s — AI classification can take time
});

// Attach admin JWT token if present
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Redirect to login on 401
API.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('/login')) {
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/login';
        }
        return Promise.reject(err);
    }
);

/**
 * Submit a new civic issue report
 * @param {FormData} formData - Must contain: photo (File), longitude, latitude, description (optional)
 */
export const submitTicket = (formData) =>
    API.post('/tickets', formData, {
        // Upload + AI classification can exceed the default 30s timeout.
        timeout: 120000,
    });

/**
 * Fetch all tickets with optional filters
 * @param {Object} params - { status, category, sort, page, limit }
 */
export const getTickets = (params) => API.get('/tickets', { params });

/**
 * Get a single ticket by ID
 */
export const getTicketById = (id) => API.get(`/tickets/${id}`);

/**
 * Update ticket status
 * @param {string} id
 * @param {string} status - 'open' | 'in_progress' | 'resolved'
 */
export const updateTicketStatus = (id, status) =>
    API.patch(`/tickets/${id}`, { status });

/**
 * Get dashboard aggregate stats
 */
export const getStats = () => API.get('/stats');

export default API;
