const axios = require('axios');

async function testPost() {
    try {
        const res = await axios.post('http://localhost:8083/api/personal-activity', {
            userPhone: '1234567890',
            date: '10-15',
            name: 'Test Activity',
            description: 'This is a test description.'
        });
        console.log("Response:", res.data);
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}
testPost();
