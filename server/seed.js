require('dotenv').config();
const mongoose = require('mongoose');
const Ticket = require('./models/Ticket');

const seedTickets = [
    {
        description: 'Large pothole at the main entrance of Sector 5.',
        photoUrl: 'https://example.com/pothole1.jpg',
        location: {
            type: 'Point',
            coordinates: [88.4277, 22.5726] 
        },
        aiCategory: 'pothole',
        aiConfidence: 0.85,
        severityScore: 8,
        status: 'open'
    },
    {
        description: 'Broken streetlight near the park.',
        photoUrl: 'https://example.com/light1.jpg',
        location: {
            type: 'Point',
            coordinates: [88.4332, 22.5801]
        },
        aiCategory: 'broken_streetlight',
        aiConfidence: 0.92,
        severityScore: 6,
        status: 'in_progress'
    },
    {
        description: 'Garbage pile-up on the sidewalk.',
        photoUrl: 'https://example.com/garbage1.jpg',
        location: {
            type: 'Point',
            coordinates: [88.4201, 22.5655]
        },
        aiCategory: 'garbage',
        aiConfidence: 0.78,
        severityScore: 5,
        status: 'open'
    },
    {
        description: 'Waterlogging issue near the subway entrance.',
        photoUrl: 'https://example.com/water1.jpg',
        location: {
            type: 'Point',
            coordinates: [88.4350, 22.5710]
        },
        aiCategory: 'waterlogging',
        aiConfidence: 0.88,
        severityScore: 9,
        status: 'open'
    },
    {
        description: 'Damaged pavement causing tripping hazard.',
        photoUrl: 'https://example.com/pavement1.jpg',
        location: {
            type: 'Point',
            coordinates: [88.4250, 22.5750]
        },
        aiCategory: 'other',
        aiConfidence: 0.70,
        severityScore: 4,
        status: 'resolved'
    }
];

async function seed() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not set in environment variables.');
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB Atlas for seeding...');

        // Clear existing tickets (optional, but good for a fresh start in Phase 1)
        await Ticket.deleteMany({});
        console.log('Cleared existing tickets.');

        await Ticket.insertMany(seedTickets);
        console.log(`Successfully seeded ${seedTickets.length} dummy tickets.`);

        await mongoose.connection.close();
        console.log('Database connection closed.');
    } catch (err) {
        console.error('Error seeding database:', err);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seed();
