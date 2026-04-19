const bcrypt = require('bcryptjs');

// In-memory admin store (matches Phase-1 in-memory approach)
const admins = [];

const SEED_ADMINS = [
    {
        id: 'admin-001',
        username: 'admin@gov',
        password: 'admin@gov',
        role: 'super_admin',
        jurisdiction: null,              // sees everything
    },
    {
        id: 'admin-ranchi',
        username: 'admin@ranchi.gov',
        password: 'admin123',
        role: 'admin',
        jurisdiction: { city: 'Ranchi', center: [85.3096, 23.3441], radiusKm: 30 },
    },
    {
        id: 'admin-mumbai',
        username: 'admin@mumbai.gov',
        password: 'admin123',
        role: 'admin',
        jurisdiction: { city: 'Mumbai', center: [72.8777, 19.076], radiusKm: 40 },
    },
    {
        id: 'admin-delhi',
        username: 'admin@delhi.gov',
        password: 'admin123',
        role: 'admin',
        jurisdiction: { city: 'Delhi', center: [77.1025, 28.7041], radiusKm: 35 },
    },
];

function seedAdmin() {
    const salt = bcrypt.genSaltSync(10);
    for (const a of SEED_ADMINS) {
        admins.push({
            id: a.id,
            username: a.username,
            passwordHash: bcrypt.hashSync(a.password, salt),
            role: a.role,
            jurisdiction: a.jurisdiction,
        });
    }
    console.log(`🔐 ${admins.length} admin accounts seeded (super + ${admins.length - 1} city)`);
}

function findAdminByUsername(username) {
    return admins.find((a) => a.username === username) || null;
}

module.exports = { seedAdmin, findAdminByUsername };
