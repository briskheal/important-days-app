require('dotenv').config();
const axios = require('axios');

async function testEmail() {
    const EMAIL_BRIDGE_URL = process.env.EMAIL_BRIDGE_URL;
    const testRecipient = "jaisidhu007@gmail.com"; // Common test recipient or I could ask. Use a dummy but real looking.

    if (!EMAIL_BRIDGE_URL) {
        console.error("❌ EMAIL_BRIDGE_URL is missing in .env");
        return;
    }

    console.log(`📡 Testing Email Bridge: ${EMAIL_BRIDGE_URL}`);
    try {
        const response = await axios.post(EMAIL_BRIDGE_URL, {
            to: testRecipient,
            subject: "🚀 Test Email from Important Days App",
            text: "This is a test to verify the mail bridge is working.",
            html: "<h1>Mail Bridge Test</h1><p>The bridge is connected successfully!</p>"
        }, { timeout: 5000 });
        console.log("✅ Success Response:", response.data);
    } catch (error) {
        console.error("❌ Failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

testEmail();
