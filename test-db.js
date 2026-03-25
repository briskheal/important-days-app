const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error("❌ ERROR: MONGODB_URI is not defined in your .env file.");
    process.exit(1);
}

console.log("🔍 Testing connection to MongoDB...");
console.log(`📡 URI: ${uri.replace(/:([^@]+)@/, ':****@')}`); // Hide password

mongoose.connect(uri)
    .then(() => {
        console.log("✅ SUCCESS: Connected to MongoDB Atlas successfully!");
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ FAILED: Connection Error.");
        console.error("Message:", err.message);
        
        if (err.message.includes('whitelsited') || err.message.includes('Could not connect to any servers')) {
            console.log("\n💡 TIP: This usually means your IP is NOT whitelisted in MongoDB Atlas.");
            console.log("👉 Go to MongoDB Atlas > Network Access > Add IP Address > 'Allow Access From Anywhere' (0.0.0.0/0).");
        }
        
        if (err.message.includes('authentication failed')) {
            console.log("\n💡 TIP: Your username or password in the MONGODB_URI is incorrect.");
        }
        
        process.exit(1);
    });
