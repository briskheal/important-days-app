async function testFetchRegistration() {
    const random = Math.floor(Math.random() * 1000000);
    const testData = {
        name: "Fetch User " + random,
        phone: "9" + random.toString().padStart(6, '0'),
        email: "fetch" + random + "@example.com",
        city: "Fetch City"
    };

    console.log(`📡 Testing Registration with Fetch simulation for ${testData.phone}...`);
    try {
        const response = await fetch('http://localhost:8083/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });
        const data = await response.json();
        if (response.ok) {
            console.log("✅ Registration Successful!");
            console.log("Response ID:", data.user.loginId);
        } else {
            console.error("❌ Registration Failed with status:", response.status);
            console.error("Data:", data);
        }
    } catch (error) {
        console.error("❌ Fetch Error:", error.message);
    }
}

testFetchRegistration();
