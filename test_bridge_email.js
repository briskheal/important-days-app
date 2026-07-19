require('dotenv').config();
const axios = require('axios');

async function sendEmail({ to, subject, text, html }) {
    if (!process.env.EMAIL_BRIDGE_URL || process.env.EMAIL_BRIDGE_URL.includes('your-google-script')) {
        console.warn("[WARN] Email Bridge URL missing or default, skipping email.");
        return;
    }
    try {
        console.log("Sending POST to:", process.env.EMAIL_BRIDGE_URL);
        const response = await axios.post(process.env.EMAIL_BRIDGE_URL, {
            to, subject, text, html
        });
        console.log(`[OK] Email (Bridge API) SENT to ${to}:`, response.data);
    } catch (error) {
        console.error(`[ERR] Email (Bridge API) FAILED for ${to}:`, error.message);
    }
}

sendEmail({
    to: process.env.EMAIL_USER,
    subject: '3-Day Reminder Test via Bridge',
    text: 'If you see this, the 3-day reminder email system via Google Apps Script is working flawlessly.',
    html: '<h2>3-Day Reminder Test</h2><p>The Google Apps Script Bridge is successfully relaying emails.</p>'
});
