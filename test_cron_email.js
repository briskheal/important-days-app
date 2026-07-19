require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: '3-Day Reminder Activity Test',
    html: `
        <h2>Test Email Delivery</h2>
        <p>This is a manual test to verify that the 3-day reminder email system can successfully send emails.</p>
        <p>If you receive this, your SMTP settings (EMAIL_USER & EMAIL_PASS) are working correctly!</p>
    `
};

console.log("Attempting to send test email to:", process.env.EMAIL_USER);
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log('[ERR] Email Failed:', error.message);
    } else {
        console.log('[SUCCESS] Email Sent:', info.response);
    }
});
