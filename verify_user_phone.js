const axios = require('axios');

async function testUserPhoneRegistration() {
    const testData = {
        name: "User Test Registration",
        phone: "+91 8878923337",
        email: "icdays.app@gmail.com",
        city: "Bilaspur"
    };

    console.log(`📡 Testing Registration with specifically requested phone: ${testData.phone}...`);
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

testUserPhoneRegistration();
