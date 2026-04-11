import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API, { API_BASE } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check for existing token on mount
    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            setLoading(false);
            return;
        }
        API.get('/auth/verify', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                setAdmin(res.data.admin);
            })
            .catch(() => {
                localStorage.removeItem('admin_token');
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (username, password) => {
        const doLogin = () => API.post('/auth/login', { username, password }, { timeout: 20000 });
        const doLoginFetchFallback = async () => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 20000);
            try {
                const res = await fetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                    signal: ctrl.signal,
                });

                const data = await res.json();
                if (!res.ok) {
                    const err = new Error(data?.error || 'Login failed');
                    err.response = { status: res.status, data };
                    throw err;
                }
                return data;
            } finally {
                clearTimeout(t);
            }
        };

        try {
            const { data } = await doLogin();
            localStorage.setItem('admin_token', data.token);
            setAdmin(data.admin);
            return data;
        } catch (err) {
            if (!err?.response) {
                await new Promise((r) => setTimeout(r, 500));
                let data;
                try {
                    ({ data } = await doLogin());
                } catch (retryErr) {
                    if (retryErr?.response) throw retryErr;
                    data = await doLoginFetchFallback();
                }
                localStorage.setItem('admin_token', data.token);
                setAdmin(data.admin);
                return data;
            }
            throw err;
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('admin_token');
        setAdmin(null);
    }, []);

    return (
        <AuthContext.Provider value={{ admin, loading, login, logout, isAuthenticated: !!admin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
