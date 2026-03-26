const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUpload() {
    console.log("--- Testing Photo Upload API ---");

    // Use an existing image for testing (e.g., favicon.ico)
    const filePath = path.join(__dirname, 'favicon.ico');
    if (!fs.existsSync(filePath)) {
        console.error("Test image not found: favicon.ico");
        return;
    }

    const formData = new FormData();
    formData.append('photo', fs.createReadStream(filePath));

    try {
        console.log("Uploading favicon.ico...");
        const response = await axios.post('http://localhost:8083/api/upload-photo', formData, {
            headers: formData.getHeaders()
        });

        const data = response.data;
        console.log(`Status: ${data.status}`);
        console.log(`URL: ${data.url}`);

        if (data.status === 'success' && data.url.startsWith('/public/gallery/')) {
            console.log("✅ Upload successful!");
        } else {
            console.log("❌ Upload failed or returned unexpected data.");
        }
    } catch (error) {
        console.error(`Error testing upload: ${error.code} - ${error.message}`);
        if (error.response) {
            console.error(`Response Data:`, error.response.data);
        } else {
            console.error("No response from server. Is it running on PORT 8083?");
        }
    }
}

testUpload();
