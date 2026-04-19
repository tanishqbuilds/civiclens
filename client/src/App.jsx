import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import CitizenReportPage from './pages/CitizenReportPage';
import AuthPage from './pages/AuthPage';
import TrackPromptPage from './pages/TrackPromptPage';
import CitizenDashboard from './pages/CitizenDashboard';
import AdminDashboard from './pages/AdminDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminLogin from './pages/AdminLogin';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
                <Routes>
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/report" element={<CitizenReportPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/track" element={<TrackPromptPage />} />
                    <Route path="/dashboard" element={<CitizenDashboard />} />

                    {/* Admin */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute type="admin">
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />
                    
                    {/* Officer */}
                    <Route
                        path="/officer"
                        element={
                            <ProtectedRoute type="user" allowedRole="officer">
                                <OfficerDashboard />
                            </ProtectedRoute>
                        }
                    />

                    {/* Profile */}
                    <Route path="/profile" element={<ProfilePage />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
