const axios = require('axios');
async function run() {
    try {
        const response = await axios.post('http://localhost:8083/api/admin/test-email', {
            id: 'EMYRIS',
            pwd: 'NEW@1306'
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}
run();
