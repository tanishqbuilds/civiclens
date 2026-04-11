require('dotenv').config();
const mongoose = require('mongoose');

console.log('--- Database Connection Test ---');
console.log('Connecting to:', process.env.MONGO_URI ? 'URI found in .env' : 'URI NOT FOUND');

const options = {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
};

mongoose.connect(process.env.MONGO_URI, options)
    .then(() => {
        console.log('✅ SUCCESS: Connected to MongoDB Atlas');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ FAILURE:', err.message);
        if (err.name === 'MongooseServerSelectionError') {
            console.error('\nPossible causes:');
            console.error('1. Your IP is not whitelisted in MongoDB Atlas (check Network Access).');
            console.error('2. Firewalls or College Ethernet blocking port 27017.');
            console.error('3. Sandbox environment network restrictions.');
        }
        process.exit(1);
    });
