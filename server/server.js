require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');

const ticketRoutes = require('./src/routes/ticketsRoutes');
const authRoutes = require('./src/routes/authRoutes');
<<<<<<< HEAD
const userAuthRoutes = require('./src/routes/userAuthRoutes');
=======
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
const azureTestRoutes = require('./src/routes/azureTestRoutes');
const { seedAdmin } = require('./src/models/adminStore');
const { loadFromMongo } = require('./src/models/ticketStore');
const { attachWss } = require('./src/utils/wsServer');

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// ========================
// Middleware
// ========================
app.use(
    cors({
<<<<<<< HEAD
        origin: [CLIENT_ORIGIN, 'http://localhost:3000', 'http://localhost:5174'],
=======
        origin: [CLIENT_ORIGIN, 'http://localhost:3000'],
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// Routes
// ========================
app.use('/api', ticketRoutes);
app.use('/api/auth', authRoutes);
<<<<<<< HEAD
app.use('/api/users', userAuthRoutes);
=======
>>>>>>> b73c570ef66a6690a06603b99a0c60b0312bcd38
app.use('/api', azureTestRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'civiclens-api' });
});

// ========================
// Start Server — connect MongoDB then listen
// ========================
seedAdmin();

const MONGO_URI = process.env.MONGO_URI;

async function startServer() {
    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log('MongoDB connected');
            // Load existing tickets into in-memory store
            const TicketModel = require('./models/Ticket');
            const docs = await TicketModel.find().lean();
            loadFromMongo(docs);
        } catch (err) {
            console.error('MongoDB connection failed — running without persistence:', err.message);
        }
    } else {
        console.warn('MONGO_URI not set — MongoDB persistence disabled');
    }

    const server = http.createServer(app);

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use.`);
            console.error('Stop the existing process on that port or set a different PORT in .env.');
            process.exit(1);
        }
        throw error;
    });

    server.listen(PORT, () => {
        // Attach WebSocket server only after HTTP server is successfully bound.
        attachWss(server);
        console.log('Server running');
        console.log(`Listening on http://localhost:${PORT}`);
    });
}

startServer();


