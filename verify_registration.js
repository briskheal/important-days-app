const axios = require('axios');

async function testRegistration() {
    const testData = {
        name: "Test User",
        phone: "918878923337",
        email: "icdays.app@gmail.com",
        city: "Test City"
    };

    console.log("📡 Testing Registration API...");
    try {
        const response = await axios.post('http://localhost:8083/api/register', testData);
        console.log("✅ Registration Successful!");
        console.log("Response:", JSON.stringify(response.data, null, 2));
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

testRegistration();
