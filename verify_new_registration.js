const axios = require('axios');

async function testNewRegistration() {
    const random = Math.floor(Math.random() * 1000000);
    const testData = {
        name: "New Bot User " + random,
        phone: "1" + random.toString().padStart(6, '0'),
        email: "bot" + random + "@example.com",
        city: "Bot City"
    };

    console.log(`📡 Testing NEW Registration for ${testData.phone}...`);
    try {
        const response = await axios.post('http://localhost:8083/api/register', testData);
        console.log("✅ Registration Successful!");
        console.log("Response:", JSON.stringify(response.data.user.loginId, null, 2));
    } catch (error) {
        console.error("❌ Registration Failed!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
}

testNewRegistration();
