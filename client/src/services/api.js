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

// Helper to attach user token
function userHeaders() {
    const token = localStorage.getItem('user_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Submit a new civic issue report
 */
export const submitTicket = (formData) =>
    API.post('/tickets', formData, {
        timeout: 120000,
        headers: userHeaders(),
    });

/**
 * Fetch all tickets with optional filters
 */
export const getTickets = (params) => API.get('/tickets', { params });

/**
 * Get a single ticket by ID
 */
export const getTicketById = (id) => API.get(`/tickets/${id}`);

/**
 * Update ticket status
 */
export const updateTicketStatus = (id, status) =>
    API.patch(`/tickets/${id}`, { status });

/**
 * Get dashboard aggregate stats
 */
export const getStats = () => API.get('/stats');

// =========================================
// Ticket Live Updates
// =========================================

export const getTicketUpdates = (id) => API.get(`/tickets/${id}/updates`);

export const postTicketUpdate = (id, message) =>
    API.post(`/tickets/${id}/updates`, { message }, { headers: userHeaders() });

// =========================================
// User Authentication (Citizen / Officer)
// =========================================

/**
 * Signup a new citizen or officer
 */
export const userSignup = (data) => API.post('/users/signup', data);

/**
 * Login an existing user
 */
export const userLogin = (data) => API.post('/users/login', data);

/**
 * Get current user profile (requires user token)
 */
export const getUserProfile = () => {
    return API.get('/users/me', { headers: userHeaders() });
};

/**
 * Get all users (admin only)
 */
export const getAllUsers = () => {
    return API.get('/users');
};

/**
 * Link an anonymous ticket to the logged-in user
 */
export const linkTicketToUser = (ticketId) => {
    return API.patch('/users/link-ticket', { ticketId }, { headers: userHeaders() });
};

/**
 * Get tickets submitted by the current user
 */
export const getMyTickets = () => {
    return API.get('/tickets/my', { headers: userHeaders() });
};

/**
 * Get the neuro-fuzzy reputation score for the current user
 */
export const getMyReputation = () => {
    return API.get('/users/reputation', { headers: userHeaders() });
};

// =========================================
// Notifications
// =========================================

export const getNotifications = () => {
    return API.get('/users/notifications', { headers: userHeaders() });
};

export const markNotificationsRead = () => {
    return API.patch('/users/notifications/read', {}, { headers: userHeaders() });
};

// =========================================
// Admin — Officer Approval
// =========================================

export const approveUser = (id) => API.patch(`/users/${id}/approve`);
export const rejectUser = (id) => API.patch(`/users/${id}/reject`);
export const assignOfficer = (id, officerId) => API.patch(`/tickets/${id}/assign`, { officerId });

export default API;
