const axios = require('axios');
async function run() {
    try {
        const response = await axios.get('http://localhost:8083/api/subscription-status?mobile=8878923337');
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}
run();
