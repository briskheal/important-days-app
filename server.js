require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8083;
const MONGODB_URI = process.env.MONGODB_URI;

// ── MongoDB Connection ──────────────────────────
let dbConnected = false;
if (MONGODB_URI && !MONGODB_URI.includes('your_mongodb_atlas')) {
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000, // Increased to 30s for more robust cloud handshakes
        socketTimeoutMS: 45000,
    })
        .then(() => {
            console.log('[OK] Connected to MongoDB Atlas');
            dbConnected = true;
        })
        .catch(err => {
            console.error('[ERR] MongoDB Connection Error:', err.message);
            if (err.message.includes('whitelsited') || err.message.includes('Could not connect to any servers')) {
                console.error('[HINT] This usually means Render\'s IP is NOT whitelisted in MongoDB Atlas.');
            }
            console.error('[HINT] Check MONGODB_URI in Render Env Vars and verify Network Access (0.0.0.0/0).');
            dbConnected = false;
        });
} else {
    console.warn('[WARN] No valid MONGODB_URI found. Check your environment configuration.');
}

// Middleware to check DB connection for API routes
const checkDb = (req, res, next) => {
    // List of routes that MUST have database connection
    const dbRequiredRoutes = [
        '/api/register',
        '/api/check-phone',
        '/api/login',
        '/api/admin/login',
        '/api/recover-account',
        '/api/reset-password',
        '/api/admin/users',
        '/api/notify-payment',
        '/api/admin/ledger',
        '/api/admin/update-status',
        '/api/subscription-status',
        '/api/admin/reset-db'
    ];

    const isDbRequired = dbRequiredRoutes.some(route => req.path.startsWith(route));

    if (!dbConnected && isDbRequired) {
        return res.status(503).json({ 
            error: 'Backend Database Not Connected',
            message: 'The server is up, but the database connection failed. Please check MONGODB_URI in Render dashboard and IP Whitelist in MongoDB Atlas.',
            status: 503
        });
    }
    next();
};
app.use(checkDb);

// ── Mongoose Schemas ────────────────────────────
const userSchema = new mongoose.Schema({
    name: String,
    phone: { type: String, unique: true, required: true },
    email: String,
    address: String,
    city: String,
    pincode: String,
    state: String,
    loginId: { type: String, unique: true },
    password: { type: String, default: '1306' },
    createdAt: { type: Date, default: Date.now },
    first_login: { type: Boolean, default: true }
}, { strict: false });

const paymentSchema = new mongoose.Schema({
    userName: String,
    mobile: String,
    email: String,
    type: String,
    amount: Number,
    txnId: { type: String, unique: true },
    status: { type: String, default: 'pending' },
    paidAt: { type: Date, default: Date.now },
    expiry: Date,
    reason: String,
    actionAt: Date
});

const adminSchema = new mongoose.Schema({
    id: { type: String, unique: true, default: 'EMYRIS' },
    pwd: { type: String, default: 'NEW@1306' }
});

const User = mongoose.model('User', userSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.text());

// Normalization helper
const normPhone = (s) => (s || '').replace(/\D/g, '');

// Fuzzy Phone Matcher: Finds user by exact phone or last 10 digits
const findUserByPhone = async (phone) => {
    const s = normPhone(phone);
    if (!s) return null;
    
    // 1. Exact Match
    let user = await User.findOne({ phone: s });
    if (user) return user;
    
    // 2. Last 10 Digits Match (Fuzzy)
    if (s.length >= 10) {
        const last10 = s.slice(-10);
        user = await User.findOne({ phone: new RegExp(last10 + '$') });
    }
    return user;
};

// Serve static files
// ── Serving Files ───────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing.html'));
});

// Explicit route for Admin Panel (allows access via /admin)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        database: dbConnected ? 'connected' : 'disconnected',
        time: new Date().toISOString()
    });
});

app.get('/api/ping', (req, res) => {
    res.json({ status: 'warm', timestamp: new Date().toISOString() });
});

// Redirect /login to /login.html
app.get('/login', (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(__dirname));

// ── EMAIL CONFIGURATION (Google Apps Script Bridge via Axios) ────
async function sendEmail({ to, subject, text, html }) {
    if (!process.env.EMAIL_BRIDGE_URL || process.env.EMAIL_BRIDGE_URL.includes('your-google-script')) {
        console.warn("[WARN] Email Bridge URL missing or default, skipping email.");
        return;
    }
    try {
        const response = await axios.post(process.env.EMAIL_BRIDGE_URL, {
            to, subject, text, html
        });
        console.log(`[OK] Email (Bridge API) SENT to ${to}:`, response.data.status);
    } catch (error) {
        console.error(`[ERR] Email (Bridge API) FAILED for ${to}:`, error.message);
    }
}

// ── API ROUTES ──────────────────────────────────

// 1. REGISTER / SYNC
app.post('/api/register', async (req, res) => {
    try {
        const data = req.body;
        if (!data.phone) return res.status(400).send('Missing phone');

        const normalizedPhone = normPhone(data.phone);
        let user = await findUserByPhone(normalizedPhone);

        if (!user) {
            // GENERATE NEW CREDENTIALS ON BACKEND
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let newId = 'USR-';
            for (let i = 0; i < 4; i++) newId += chars.charAt(Math.floor(Math.random() * chars.length));
            
            // Check for ID collision (rare but possible)
            let existingId = await User.findOne({ loginId: newId });
            while (existingId) {
                newId = 'USR-';
                for (let i = 0; i < 4; i++) newId += chars.charAt(Math.floor(Math.random() * chars.length));
                existingId = await User.findOne({ loginId: newId });
            }

            const newPwd = Math.floor(100000 + Math.random() * 900000).toString(); // Secure 6-digit random

            user = new User({ 
                ...data, 
                phone: normalizedPhone, 
                loginId: newId, 
                password: newPwd,
                createdAt: new Date(), 
                first_login: true 
            });
            await user.save();
            console.log(`[OK] New user registered on backend: ${data.name} (ID: ${newId})`);
            res.json({ status: 'success', user });
        } else {
            // SYNC DATA BUT PRESERVE SENSITIVE CREDENTIALS
            // We ignore any loginId or password sent from the frontend to ensure consistency
            const { loginId, password, ...profileData } = data;
            Object.assign(user, profileData);
            user.phone = normalizedPhone;
            await user.save();
            console.log(`[OK] User data synced: ${user.name} (ID: ${user.loginId})`);
            res.json({ status: 'success', user });
        }
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 2. CHECK PHONE (New)
app.post('/api/check-phone', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: "Phone required" });
        const user = await findUserByPhone(phone);
        if (user) {
            return res.json({ exists: true, name: user.name, loginId: user.loginId });
        }
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// 2. USER LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { loginId, password } = req.body;
        const user = await User.findOne({ loginId, password });
        
        if (user) {
            console.log(`[OK] User Logged in: ${user.name}`);
            res.json({ status: 'success', user });
        } else {
            res.status(401).json({ status: 'fail', message: 'Invalid ID or Password' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. ADMIN LOGIN
app.post('/api/admin/login', async (req, res) => {
    try {
        let { id, pwd } = req.body;
        id = (id || '').trim();
        pwd = (pwd || '').trim();
        console.log(`[INFO] Admin Login Attempt: ID=${id}`);

        let admin = await Admin.findOne({ id });
        
        // Setup initial admin or UPDATE if master credentials match
        // This ensures the user can always regain access with these specific credentials
        if (id === 'EMYRIS' && pwd === 'NEW@1306') {
            if (!admin) {
                admin = new Admin({ id, pwd });
                await admin.save();
                console.log(`[OK] Master admin created`);
            } else if (admin.pwd !== pwd) {
                admin.pwd = pwd;
                await admin.save();
                console.log(`[OK] Master admin password reset`);
            }
        }

        if (admin && admin.pwd === pwd) {
            console.log(`[OK] Admin Logged in: ${id}`);
            res.json({ status: 'success' });
        } else {
            console.warn(`[WARN] Admin Login Failed: ID=${id} (Invalid Credentials)`);
            res.status(401).json({ status: 'fail', message: 'Invalid Admin ID or Password' });
        }
    } catch (err) {
        console.error("[ERR] Admin login error:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. RECOVER ACCOUNT
app.post('/api/recover-account', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: "Phone required" });
        
        let user = await findUserByPhone(phone);
        
        if (user) {
            console.log(`[OK] Account recovered for: ${user.name} (${user.phone})`);
            res.json({ status: 'success', loginId: user.loginId, name: user.name });
        } else {
            console.warn(`[WARN] Recovery failed for phone: ${phone}`);
            res.status(404).json({ status: 'error', message: 'Account not found. Please register first.' });
        }
    } catch (err) {
        console.error("Recovery error:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 5. RESET PASSWORD
app.post('/api/reset-password', async (req, res) => {
    try {
        const { phone, newPassword } = req.body;
        if (!phone || !newPassword) return res.status(400).json({ error: "Phone and Password required" });
        
        let user = await findUserByPhone(phone);
        
        if (user) {
            user.password = newPassword;
            await user.save();
            console.log(`[OK] Password reset for: ${user.name} (${user.phone})`);
            res.json({ status: 'success' });
        } else {
            console.warn(`[WARN] Password reset failed for phone: ${phone}`);
            res.status(404).json({ status: 'error', message: 'Account not found. Reset failed.' });
        }
    } catch (err) {
        console.error("Reset error:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 6. ADMIN: GET ALL USERS
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 7. SUBMIT PAYMENT (NOTIFY)
app.post('/api/notify-payment', async (req, res) => {
    try {
        let data = req.body;
        if (typeof data === 'string' && data.startsWith('{')) data = JSON.parse(data);

        console.log(`[INFO] Payment Notification API Call:`, JSON.stringify(data, null, 2));

        const { userName, mobile, type, amount, txnId, email: customerEmail } = data;
        if (!txnId || !mobile) {
            console.warn("[WARN] Payment notification missing critical data (UTR or Mobile)");
            return res.status(400).json({ error: 'Missing UTR or Mobile' });
        }
        
        console.log(`[INFO] Processing Payment: User=${userName}, Mobile=${mobile}, UTR=${txnId}, Amount=${amount}, Type=${type}`);

        // 1. Save to MongoDB FIRST (Crucial for data integrity)
        const newPayment = new Payment({
            userName, mobile: normPhone(mobile), email: customerEmail, type, amount, txnId,
            status: 'pending', paidAt: new Date()
        });
        await newPayment.save();
        console.log(`[OK] Payment record created in DB for UTR: ${txnId}`);

        // 2. Email Notifications (Async, catch errors so they don't block response)
        try {
            // Email to Admin
            await sendEmail({
                to: process.env.EMAIL_USER,
                subject: `🔔 New Subscription Payment: ${userName}`,
                text: `New payment received.\n\nUser: ${userName}\nMobile: ${mobile}\nPlan: ${type}\nAmount: ${amount}\nUTR: ${txnId}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #7c6fff; border-radius: 10px;">
                        <h2 style="color: #7c6fff;">New Subscription Payment</h2>
                        <p><strong>User:</strong> ${userName}</p>
                        <p><strong>Mobile:</strong> ${mobile}</p>
                        <p><strong>Plan:</strong> ${type.toUpperCase()}</p>
                        <p><strong>Amount:</strong> ₹${amount}</p>
                        <p><strong>UTR:</strong> ${txnId}</p>
                        <hr>
                        <p style="font-size: 0.8rem; color: #666;">Please verify this in the Admin Dashboard.</p>
                    </div>
                `
            });
        } catch (e) { console.error("[ERR] Admin notification email failed:", e.message); }

        try {
            // Email to Customer
            if (customerEmail && customerEmail.includes('@')) {
                await sendEmail({
                    to: customerEmail,
                    subject: `Payment Received - Verification in Progress`,
                    text: `Dear ${userName},\n\nWe received your payment of Rs. ${amount}. Your UTR is ${txnId}.\nVerification is in progress and usually takes less than 24 hours.`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #7c6fff; border-radius: 10px; max-width: 500px;">
                            <h2 style="color: #7c6fff;">Payment Received</h2>
                            <p>Dear <strong>${userName}</strong>,</p>
                            <p>We've received your payment of <strong>₹${amount}</strong> for the <strong>${type}</strong> subscription.</p>
                            <p><strong>UTR:</strong> ${txnId}</p>
                            <p>Our team is currently verifying the transaction. Access will be granted within 24 hours.</p>
                            <hr>
                            <p style="font-size: 0.8rem; color: #666;">Thank you for your support!</p>
                        </div>
                    `
                });
            }
        } catch (e) { console.error("[ERR] Customer receipt email failed:", e.message); }

        console.log(`[OK] Payment notification fully processed for ${txnId}`);
        res.json({ status: 'success', message: 'Payment recorded and notifications triggered.' });
    } catch (error) {
        console.error('Payment Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 8. ADMIN: GET LEDGER
app.get('/api/admin/ledger', async (req, res) => {
    try {
        const payments = await Payment.find().sort({ paidAt: -1 });
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 9. ADMIN: UPDATE STATUS (with automatic email notification)
app.post('/api/admin/update-status', async (req, res) => {
    try {
        const { mobile, txnId, status, expiry, reason, type } = req.body;
        const result = await Payment.findOneAndUpdate(
            { mobile: normPhone(mobile), txnId },
            { status, expiry, reason, actionAt: new Date() },
            { new: true }
        );
        
        if (result) {
            console.log(`[OK] Status updated to ${status} for UTR: ${txnId}`);
            
            // Trigger Email Notification automatically
            const customerEmail = result.email;
            const userName = result.userName || 'User';
            
            if (customerEmail && customerEmail.includes('@')) {
                let subject = '';
                let html = '';
                
                if (status === 'approved') {
                    subject = '✅ Subscription Approved - Important Days App';
                    html = `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #43d08a; border-radius: 10px; max-width: 500px;">
                            <h2 style="color: #43d08a;">Subscription Approved!</h2>
                            <p>Dear <strong>${userName}</strong>,</p>
                            <p>Great news! Your payment for the <strong>${(type || '').toUpperCase()}</strong> subscription has been <strong>APPROVED</strong>.</p>
                            <p>Your account is now active and you have full access to all features.</p>
                            ${expiry ? `<p><strong>Expiry Date:</strong> ${new Date(expiry).toLocaleDateString()}</p>` : ''}
                            <hr>
                            <p style="font-size: 0.8rem; color: #666;">Thank you for your support! Happy exploring.</p>
                        </div>
                    `;
                } else if (status === 'rejected') {
                    subject = '❌ Subscription Payment Rejected';
                    html = `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f72585; border-radius: 10px; max-width: 500px;">
                            <h2 style="color: #f72585;">Payment Update</h2>
                            <p>Dear <strong>${userName}</strong>,</p>
                            <p>We are sorry to inform you that your payment for the <strong>${(type || '').toUpperCase()}</strong> subscription was <strong>REJECTED</strong>.</p>
                            <p><strong>Reason:</strong> ${reason || 'Invalid UTR or payment not received'}</p>
                            <p>If you believe this is a mistake, please contact support at 8878923337 or reply to this email.</p>
                            <hr>
                            <p style="font-size: 0.8rem; color: #666;">Important Days App Team</p>
                        </div>
                    `;
                }

                if (subject) {
                    try {
                        await sendEmail({
                            to: customerEmail,
                            subject: subject,
                            text: `Hello ${userName}, your subscription status is now: ${status.toUpperCase()}.`,
                            html: html
                        });
                        console.log(`[OK] Status notification email sent to ${customerEmail}`);
                    } catch (e) {
                        console.error(`[ERR] Status notification email failed:`, e.message);
                    }
                }
            } else {
                console.log(`[WARN] No valid email found for ${mobile}, skipping status notification.`);
            }

            res.json({ status: 'success' });
        } else {
            res.status(404).send('Payment record not found');
        }
    } catch (err) {
        console.error('Update Status Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 10. USER: SUBSCRIPTION STATUS
app.get('/api/subscription-status', async (req, res) => {
    try {
        const { mobile } = req.query;
        if (!mobile) return res.status(400).send('Missing mobile');

        const payment = await Payment.findOne({ mobile: normPhone(mobile) }).sort({ paidAt: -1 });
        if (payment) {
            res.json(payment);
        } else {
            res.json({ status: 'none' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 11. NOTIFY STATUS (EMAIL)
app.post('/api/notify-status', async (req, res) => {
    try {
        let data = req.body;
        if (typeof data === 'string') data = JSON.parse(data);
        const { email, name, statusText, msgText } = data;

        if (email && email.includes('@')) {
            await sendEmail({
                to: email,
                subject: `Subscription Update: ${statusText}`,
                text: `Dear ${name},\n\n${msgText}\n\nThank you!`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #7c6fff; border-radius: 10px;">
                        <h2 style="color: #43d08a;">Subscription Update</h2>
                        <p>Dear <strong>${name}</strong>,</p>
                        <p style="font-size: 1.1rem;">${msgText}</p>
                        <p>If you have any questions, please reply to this email.</p>
                        <hr>
                        <p style="font-size: 0.8rem; color: #666;">Important Days App Team</p>
                    </div>
                `
            });
        }
        res.status(200).send("OK");
    } catch (err) {
        res.status(500).send('Status email failed');
    }
});

// 12. SMART AI CONTENT
app.get('/api/content', async (req, res) => {
    try {
        const { date: mmdd, name, category } = req.query;
        let variants = [];
        let hashtags = "";
        let cta = "";

        if (!name) return res.status(400).json({ error: "Missing name" });

        console.log(`[INFO] Generating content for: ${name} (${category})`);

        // Variant 1: Template-based
        let templateContent = "";
        switch (category) {
            case "Festival":
                templateContent = `✨ Happy ${name}! Celebrate this beautiful festival with your loved ones. Spread joy, happiness, and traditional values today!`;
                hashtags = `#${(name||'').replace(/\s/g, '')} #Festival #Joy #Celebration #FestiveVibes`;
                cta = `🎈 Share the festive spirit with everyone!`;
                break;
            case "Health":
                templateContent = `💪 Today is ${name}. Health is your greatest wealth. Let's take a pledge to stay fit, stay aware, and build a healthier future together!`;
                hashtags = `#${(name||'').replace(/\s/g, '')} #Health #Wellness #Awareness #HealthyLiving`;
                cta = `💙 Spread health awareness and inspire others!`;
                break;
            case "India-National":
                templateContent = `🇮🇳 Observing ${name}. Proud of our heritage and the values this day represents. A time to reflect on our history and future. Jai Hind!`;
                hashtags = `#${(name||'').replace(/\s/g, '')} #India #NationalPride #Heritage #Bharat #JaiHind`;
                cta = `🇮🇳 Share with pride and honor!`;
                break;
            default:
                templateContent = `📅 Today is ${name}. An important day to reflect on the values and awareness it brings to our lives and society globally.`;
                hashtags = `#${(name||'').replace(/\s/g, '')} #ImportantDay #Awareness #Knowledge #Significance`;
                cta = `✨ Share this knowledge and spread importance!`;
        }
        variants.push(templateContent);

        // Variant 2: Generic Awareness / Educational
        variants.push(`🔍 Did you know today is ${name}? It's a day dedicated to raising awareness, celebrating milestones, and understanding the deep significance of this event. Let's make a positive impact together by sharing the word!`);

        // Variant 3: Global Impact & Legacy
        variants.push(`🌍 ${name} is more than just a date on the calendar; it's a testament to our global heritage and the ongoing efforts to create a better world. Its legacy inspires us to continue advocate for positive change and community strength.`);

        // Variant 4: Wikipedia-based (Rich Content)
        try {
            const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}`;
            const wikiRes = await axios.get(wikiUrl, {
                headers: { 'User-Agent': 'ImportantDaysApp/1.5 (https://important-days.onrender.com; contact@example.com)' },
                timeout: 5000
            });
            const wikiData = wikiRes.data;
            if (wikiData && wikiData.extract) {
                // Sanitize and trim
                let summary = wikiData.extract.trim();
                if (summary.length > 500) summary = summary.substring(0, 497) + "...";
                variants.push(summary);
                console.log(`[OK] Wikipedia content added for ${name}`);
            }
        } catch (e) {
            console.warn(`[WARN] Wiki fetch failed for ${name}: ${e.message}`);
            // Fallback for Variant 4 if Wiki fails
            variants.push(`🌟 Let's take a moment to acknowledge the importance of ${name}. Whether it's through learning more about its history or sharing its values with others, every small action counts in making this day meaningful.`);
        }

        // Ensure we always have at least 4 variants
        while (variants.length < 4) {
            variants.push(`🌈 Celebrating ${name} today! A perfect opportunity to learn, grow, and share the significance of this special observance with your network.`);
        }

        // Add a freeSnippet for the Quick Fact section in app.js
        const freeSnippet = variants[0];

        res.json({ status: "success", variants, hashtags, cta, freeSnippet, isAi: true });
    } catch (err) {
        console.error("AI Content Error:", err);
        res.status(500).json({ error: "Failed to generate content" });
    }
});

// 13. RESET DATABASE (Protected)
app.post('/api/admin/reset-db', async (req, res) => {
    try {
        const { id, pwd } = req.body;
        // Basic check for master credentials
        if (id !== 'EMYRIS' || pwd !== 'NEW@1306') {
            return res.status(401).json({ error: 'Unauthorized reset attempt' });
        }
        
        await User.deleteMany({});
        await Payment.deleteMany({});
        console.log(`[OK] Database cleared by admin.`);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: 'Reset failed' });
    }
});

// 14. ADMIN: TEST EMAIL (For Debugging)
app.post('/api/admin/test-email', async (req, res) => {
    try {
        const { id, pwd } = req.body;
        if (id !== 'EMYRIS' || pwd !== 'NEW@1306') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        console.log(`[INFO] Admin triggered email test to ${process.env.EMAIL_USER}`);
        
        await sendEmail({
            to: process.env.EMAIL_USER,
            subject: "🛠️ Admin Email Test - Important Days App",
            text: "This is a direct test of the Mailjet API configuration from the server.",
            html: `<h3>Mailjet API Test Successful!</h3><p>Your server at <b>${req.headers.host}</b> is able to send emails correctly via HTTPS.</p>`
        });

        res.json({ status: 'success', message: 'Test email sent successfully.' });
    } catch (err) {
        console.error("[ERR] Admin Test Email Failed:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Fallback error handler 
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    console.log(`[WARN] 404 Not Found: ${req.url}`);
    res.status(404).sendFile(path.join(__dirname, 'landing.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`[INFO] Server started at http://localhost:${PORT}/`);
});
