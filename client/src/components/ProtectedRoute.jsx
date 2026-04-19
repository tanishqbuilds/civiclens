import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8]">
                <div className="liquid-glass rounded-2xl px-10 py-8 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Verifying session…</p>
                </div>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
}
