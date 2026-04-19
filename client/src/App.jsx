import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
<<<<<<< HEAD
import LandingPage from './pages/LandingPage';
import CitizenReportPage from './pages/CitizenReportPage';
import AuthPage from './pages/AuthPage';
import TrackPromptPage from './pages/TrackPromptPage';
import CitizenDashboard from './pages/CitizenDashboard';
=======
import CitizenReportPage from './pages/CitizenReportPage';
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
                <Routes>
<<<<<<< HEAD
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/report" element={<CitizenReportPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/track" element={<TrackPromptPage />} />
                    <Route path="/dashboard" element={<CitizenDashboard />} />

                    {/* Admin */}
=======
                    <Route path="/" element={<CitizenReportPage />} />
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />
<<<<<<< HEAD

                    {/* Fallback */}
=======
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
