# Admin Authentication Implementation Plan

## 📋 Overview

**Objective**: Secure the Admin Dashboard while keeping the Citizen Report Page publicly accessible.

**Current State**: 
- ✅ Citizen Report Page: Public access (anyone can report issues)
- ❌ Admin Dashboard: Currently accessible to anyone

**Target State**:
- ✅ Citizen Report Page: Remains public
- 🔒 Admin Dashboard: Protected with login/authentication

---

## 🎯 Why This Is Important

1. **Security**: Prevent unauthorized access to:
   - View all citizen reports and locations
   - Change ticket statuses
   - Access sensitive civic infrastructure data
   - Modify/delete reports

2. **Accountability**: Track which admin made changes to tickets

3. **Role Management**: Support multiple admin users with different permissions (future enhancement)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │  Citizen Report  │        │  Admin Dashboard │           │
│  │  (Public)        │        │  (Protected)     │           │
│  └──────────────────┘        └──────────────────┘           │
│                                       │                      │
│                              ┌────────▼────────┐             │
│                              │  Login Page     │             │
│                              │  (/admin/login) │             │
│                              └────────┬────────┘             │
│                                       │                      │
│                              ┌────────▼────────┐             │
│                              │  Auth Service   │             │
│                              │  (JWT Tokens)   │             │
│                              └────────┬────────┘             │
└───────────────────────────────────────┼─────────────────────┘
                                        │
                                        │ HTTP + JWT
                                        │
┌───────────────────────────────────────▼─────────────────────┐
│                    BACKEND (Express)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │  Public Routes   │        │  Protected Routes│           │
│  │  /api/tickets    │        │  /api/admin/*    │           │
│  │  (POST only)     │        │  (All methods)   │           │
│  └──────────────────┘        └────────┬─────────┘           │
│                                       │                      │
│                              ┌────────▼────────┐             │
│                              │  Auth Middleware│             │
│                              │  (Verify JWT)   │             │
│                              └────────┬────────┘             │
│                                       │                      │
│  ┌──────────────────────────────────┬─┴────────────────┐    │
│  │         MongoDB Atlas            │                  │    │
│  │  ┌──────────────┐  ┌────────────▼───────────┐     │    │
│  │  │   Tickets    │  │   Admin Users          │     │    │
│  │  │  Collection  │  │   Collection           │     │    │
│  │  └──────────────┘  └────────────────────────┘     │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Plan

### **Phase 1: Backend Setup** (Server Folder)

#### 1.1 Create Admin User Model
**File**: `server/models/Admin.js`

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // hashed
    role: { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
```

**Dependencies to install**:
```bash
npm install bcryptjs jsonwebtoken
```

---

#### 1.2 Create Auth Routes
**File**: `server/routes/auth.js`

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find admin
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Check password
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Verify token (check if logged in)
router.get('/verify', authMiddleware, (req, res) => {
    res.json({ 
        success: true, 
        user: req.user 
    });
});

module.exports = router;
```

---

#### 1.3 Create Auth Middleware
**File**: `server/middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token, authorization denied' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Token is not valid' 
        });
    }
};

module.exports = authMiddleware;
```

---

#### 1.4 Protect Admin Routes
**File**: `server/routes/tickets.js` (Update existing)

```javascript
const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// PUBLIC: Submit ticket (citizen)
router.post('/tickets', submitTicket);

// PROTECTED: Get all tickets (admin only)
router.get('/tickets', authMiddleware, getTickets);

// PROTECTED: Update ticket status (admin only)
router.patch('/tickets/:id', authMiddleware, updateTicketStatus);

// PROTECTED: Delete ticket (admin only)
router.delete('/tickets/:id', authMiddleware, deleteTicket);

module.exports = router;
```

---

#### 1.5 Update server.js
**File**: `server/server.js`

```javascript
// Add auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Add JWT_SECRET to .env
// JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
```

---

#### 1.6 Create Seed Script for First Admin
**File**: `server/seed-admin.js`

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const admin = await Admin.create({
            username: 'admin',
            email: 'admin@civiclens.com',
            password: 'Admin@123', // Will be hashed automatically
            role: 'superadmin'
        });
        
        console.log('✅ Admin created:', admin.username);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createAdmin();
```

**Run**: `node server/seed-admin.js`

---

### **Phase 2: Frontend Setup** (Client Folder)

#### 2.1 Create Auth Context
**File**: `client/src/context/AuthContext.jsx`

```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Check if user is logged in on mount
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            verifyToken(token);
        } else {
            setLoading(false);
        }
    }, []);

    const verifyToken = async (token) => {
        try {
            const res = await axios.get('/api/auth/verify', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data.user);
        } catch (error) {
            localStorage.removeItem('adminToken');
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        const res = await axios.post('/api/auth/login', { username, password });
        localStorage.setItem('adminToken', res.data.token);
        setUser(res.data.user);
        navigate('/admin');
    };

    const logout = () => {
        localStorage.removeItem('adminToken');
        setUser(null);
        navigate('/admin/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
```

---

#### 2.2 Create Login Page
**File**: `client/src/pages/AdminLogin.jsx`

```javascript
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(username, password);
            toast.success('Welcome back! 👋');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8] font-display">
            {/* Background decorative blurs */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] -z-10" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] -z-10" />

            <div className="liquid-glass rounded-2xl p-10 w-full max-w-md shadow-2xl">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-white text-3xl">shield_person</span>
                    </div>
                </div>
                
                <h1 className="text-3xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                    Admin Portal
                </h1>
                <p className="text-center text-slate-500 mb-8 text-sm">
                    Sign in to access the dashboard
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all"
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-white border border-slate-200 focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all"
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Secure admin access only
                </p>
            </div>
        </div>
    );
}

export default AdminLogin;
```

---

#### 2.3 Create Protected Route Component
**File**: `client/src/components/ProtectedRoute.jsx`

```javascript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return user ? children : <Navigate to="/admin/login" />;
}

export default ProtectedRoute;
```

---

#### 2.4 Update App.jsx with Routes
**File**: `client/src/App.jsx`

```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import CitizenReportPage from './pages/CitizenReportPage';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Toaster position="top-right" />
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<CitizenReportPage />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    
                    {/* Protected Routes */}
                    <Route 
                        path="/admin" 
                        element={
                            <ProtectedRoute>
                                <AdminDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
```

---

#### 2.5 Update API Service to Include Token
**File**: `client/src/services/api.js`

```javascript
import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 30000,
});

// Add token to every request if it exists
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 errors (token expired)
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login';
        }
        return Promise.reject(error);
    }
);

export default API;
```

---

#### 2.6 Add Logout Button to Admin Dashboard
**File**: `client/src/pages/AdminDashboard.jsx` (Update header)

```javascript
import { useAuth } from '../context/AuthContext';

function AdminDashboard() {
    const { user, logout } = useAuth();
    
    // ... existing code ...
    
    // In the header section:
    <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
        <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold">{user?.username}</p>
            <p className="text-[10px] text-slate-500">{user?.role}</p>
        </div>
        <button 
            onClick={logout}
            className="w-10 h-10 rounded-full bg-rose-100 hover:bg-rose-200 transition-colors flex items-center justify-center"
            title="Logout"
        >
            <Icon name="logout" className="text-rose-600 text-[20px]" />
        </button>
    </div>
}
```

---

### **Phase 3: Environment Variables**

#### Backend `.env`
```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/civiclens

# JWT Secret (Generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-change-in-production

# Server
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

#### Frontend `.env`
```env
VITE_API_BASE_URL=
VITE_MAPBOX_TOKEN=pk.eyJ1...
```

---

## 📝 Implementation Steps (Order of Execution)

### Backend First:
1. ✅ Install dependencies: `bcryptjs`, `jsonwebtoken`
2. ✅ Add `JWT_SECRET` to `server/.env`
3. ✅ Create `models/Admin.js`
4. ✅ Create `middleware/auth.js`
5. ✅ Create `routes/auth.js`
6. ✅ Update `routes/tickets.js` to protect routes
7. ✅ Update `server.js` to include auth routes
8. ✅ Create `seed-admin.js` and run it: `node server/seed-admin.js`
9. ✅ Test login with Postman: `POST /api/auth/login`

### Frontend After Backend Works:
10. ✅ Install: `npm install react-router-dom` (if not already installed)
11. ✅ Create `context/AuthContext.jsx`
12. ✅ Create `components/ProtectedRoute.jsx`
13. ✅ Create `pages/AdminLogin.jsx`
14. ✅ Update `App.jsx` with routes
15. ✅ Update `services/api.js` with interceptors
16. ✅ Add logout to `AdminDashboard.jsx`
17. ✅ Test login flow: `/admin/login` → `/admin`

---

## 🎨 My Professional Opinion

### ✅ **Strongly Recommended**

This is **absolutely necessary** for a production civic application because:

1. **Data Privacy**: Citizen reports may contain:
   - Personal descriptions
   - Exact GPS coordinates of homes/businesses
   - Photo evidence that could identify individuals
   - Patterns that could reveal infrastructure vulnerabilities

2. **Legal Compliance**: Many jurisdictions require:
   - Audit trails for government data access
   - Role-based access control
   - Data protection measures for civic platforms

3. **Operational Security**: Without auth:
   - Malicious actors could mark all issues as "resolved"
   - Competitors could scrape civic infrastructure data
   - Pranksters could spam status changes
   - Data could be deleted or manipulated

### 🎯 **Recommended Enhancements** (Future)

**Phase 2 (Post-Hackathon)**:
- Multi-factor authentication (MFA)
- Role-based access control (viewer vs editor)
- Activity logs (who changed what ticket, when)
- Session management (force logout after inactivity)
- Password reset flow via email

**Phase 3 (Production)**:
- OAuth integration (Google/Microsoft for govt orgs)
- IP whitelisting for extra security
- Rate limiting on login attempts
- CAPTCHA on login page
- Encrypted backup of admin credentials

---

## ⚠️ Security Best Practices

### DO:
- ✅ Use strong JWT secrets (min 32 characters, random)
- ✅ Hash passwords with bcrypt (never store plain text)
- ✅ Set token expiry (8 hours recommended)
- ✅ Use HTTPS in production
- ✅ Keep admin credentials in password manager
- ✅ Log auth attempts

### DON'T:
- ❌ Store passwords in plain text
- ❌ Share JWT secret in Git/public repos
- ❌ Use weak passwords (use: Admin@12345Strong!)
- ❌ Store token in cookies without httpOnly flag
- ❌ Skip token verification on backend

---

## 🚀 Quick Start Commands

```bash
# Backend
cd server
npm install bcryptjs jsonwebtoken
node seed-admin.js
npm start

# Frontend
cd client
npm install react-router-dom
npm run dev
```

**Default Admin Credentials** (from seed script):
- Username: `admin`
- Password: `Admin@123`

⚠️ **Change immediately after first login!**

---

## 📊 Testing Checklist

- [ ] Admin can login with correct credentials
- [ ] Login fails with wrong password
- [ ] Token is stored in localStorage
- [ ] Protected routes redirect to login if no token
- [ ] Admin dashboard loads after login
- [ ] Logout clears token and redirects to login
- [ ] Citizen report page still works without login
- [ ] API returns 401 for protected routes without token
- [ ] Token expires after 8 hours
- [ ] Refresh page maintains login state

---

## 🎯 Estimated Time

- **Backend Setup**: 2-3 hours
- **Frontend Setup**: 2-3 hours
- **Testing & Debug**: 1-2 hours
- **Total**: ~6-8 hours

---

## 📚 Dependencies Summary

**Backend (`server/package.json`)**:
```json
{
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2"
}
```

**Frontend (`client/package.json`)**:
```json
{
  "react-router-dom": "^6.20.0"
}
```

---

## 🏆 Hackathon Tip

If time is limited during the hackathon:
1. Implement basic JWT auth (login + protected routes)
2. Skip: password reset, MFA, role management
3. Demo with: One admin account, show login screen → dashboard
4. Mention in presentation: "Production version will include [list enhancements]"

This shows you understand security while focusing on core features!

---

**Created**: March 12, 2026  
**For**: CivicLens - SIH25031 Civic Issue Reporting System  
**Status**: Ready for Implementation 🚀
