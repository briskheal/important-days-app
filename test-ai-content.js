const axios = require('axios');

async function testAiContent() {
    console.log("--- Testing AI Content API ---");
    
    const testCases = [
        { name: "Earth Day", category: "Environment" },
        { name: "Holi", category: "Festival" }
    ];

    for (const test of testCases) {
        console.log(`\nTesting: ${test.name} (${test.category})...`);
        try {
            const response = await axios.get(`http://localhost:8083/api/content?name=${encodeURIComponent(test.name)}&category=${encodeURIComponent(test.category)}`);
            const data = response.data;
            
            console.log(`Status: ${data.status}`);
            console.log(`Is AI: ${data.isAi}`);
            console.log(`Variants Count: ${data.variants.length}`);
            console.log(`First Variant Snippet: ${data.variants[0].substring(0, 100)}...`);
            console.log(`Hashtags: ${data.hashtags}`);
            console.log(`CTA: ${data.cta}`);
        } catch (error) {
            console.error(`Error testing ${test.name}: ${error.code} - ${error.message}`);
            if (error.response) {
                console.error(`Response Data:`, error.response.data);
            } else {
                console.error(`No response from server. Is it running on PORT 8083?`);
            }
        }
    }
}

testAiContent();
