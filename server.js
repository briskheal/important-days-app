require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const mongoose = require('mongoose');
const axios = require('axios');
const multer = require('multer');

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
            syncGalleryFromDB(); // Restore uploads on start
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
    email: { type: String, required: true },
    address: String,
    city: String,
    pincode: String,
    state: String,
    loginId: { type: String, unique: true },
    password: { type: String, default: '1306' },
    createdAt: { type: Date, default: Date.now },
    first_login: { type: Boolean, default: true },
    resetOtp: String,
    resetOtpExpiry: Date
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
    id: { type: String, unique: true, default: process.env.ADMIN_ID || 'EMYRIS' },
    pwd: { type: String, default: process.env.ADMIN_PWD || 'NEW@1306' }
});

const User = mongoose.model('User', userSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Admin = mongoose.model('Admin', adminSchema);

const deletedImageSchema = new mongoose.Schema({
    url: { type: String, unique: true },
    deletedAt: { type: Date, default: Date.now }
});
const DeletedImage = mongoose.model('DeletedImage', deletedImageSchema);

const galleryImageSchema = new mongoose.Schema({
    filename: { type: String, unique: true },
    contentType: String,
    data: Buffer, // Store binary data
    uploadedAt: { type: Date, default: Date.now }
});
const GalleryImage = mongoose.model('GalleryImage', galleryImageSchema);

// ── SYNC LOGIC: Restore Gallery from DB on Startup ──
async function syncGalleryFromDB() {
    const galleryPath = path.join(__dirname, 'public', 'gallery');
    if (!fs.existsSync(galleryPath)) fs.mkdirSync(galleryPath, { recursive: true });

    try {
        const images = await GalleryImage.find({});
        console.log(`[SYNC] Found ${images.length} images in MongoDB. Checking filesystem...`);
        
        let restoredCount = 0;
        for (const img of images) {
            const filePath = path.join(galleryPath, img.filename);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, img.data);
                console.log(`[SYNC] Restored missing file: ${img.filename}`);
                restoredCount++;
            }
        }
        if (restoredCount > 0) console.log(`[OK] Successfully restored ${restoredCount} files to /public/gallery`);
        else console.log(`[OK] Filesystem is already in sync with DB.`);
    } catch (err) {
        console.error("[ERR] Gallery Sync Failed:", err);
    }
}

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

app.get('/api/debug-db', (req, res) => {
    res.json({
        dbConnected,
        mongooseState: mongoose.connection.readyState,
        uri: MONGODB_URI ? `${MONGODB_URI.split('@')[1]}` : 'none',
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

const staticOptions = {
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    }
};

app.use(express.static(__dirname, staticOptions));
app.use('/public', express.static(path.join(__dirname, 'public'), staticOptions));

// ── PHOTO UPLOAD CONFIGURATION (Multer) ──────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'public', 'gallery');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, 'upload-' + uniqueSuffix + ext);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images are allowed'));
    }
});

app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const filePath = `/public/gallery/${req.file.filename}`;
        
        // 1. Permanent Storage in MongoDB
        try {
            const imageBuffer = fs.readFileSync(req.file.path);
            await GalleryImage.findOneAndUpdate(
                { filename: req.file.filename },
                { 
                    filename: req.file.filename,
                    contentType: req.file.mimetype,
                    data: imageBuffer,
                    uploadedAt: new Date()
                },
                { upsert: true }
            );
            console.log(`[OK] Photo saved to MongoDB: ${req.file.filename}`);
        } catch (dbErr) {
            console.error("DB Upload Error:", dbErr);
        }

        console.log(`[OK] Photo uploaded to disk: ${filePath}`);
        res.json({ status: 'success', url: filePath });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.post('/api/delete-photo', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'No URL provided' });
        
        // 1. Permanent Blacklist in DB (to survive restarts)
        try {
            await DeletedImage.findOneAndUpdate(
                { url },
                { url, deletedAt: new Date() },
                { upsert: true }
            );
            
            // 2. ALSO remove from GalleryImage collection if it was an upload
            const fileName = path.basename(url);
            await GalleryImage.deleteOne({ filename: fileName });
            
            console.log(`[OK] Photo blacklisted and removed from DB storage: ${url}`);
        } catch (dbErr) {
            console.error("DB Blacklist/Delete Error:", dbErr);
        }

        // 2. Attempt Filesystem Delete (Immediate)
        const fileName = path.basename(url);
        const filePath = path.join(__dirname, 'public', 'gallery', fileName);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[OK] Photo unlinked from disk: ${filePath}`);
        }
        
        res.json({ status: 'success' });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

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
        if (!data.phone || !data.email) {
            return res.status(400).json({ error: "Phone and Email are both mandatory for security." });
        }

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

            // SEND WELCOME EMAIL WITH CREDENTIALS
            if (user.email) {
                try {
                    await sendEmail({
                        to: user.email,
                        subject: "✨ Welcome to Important Days! - Your Credentials",
                        text: `Hello ${user.name},\n\nYour account has been created successfully!\n\nLOGIN ID: ${newId}\nPASSWORD: ${newPwd}\n\nIMPORTANT: Please change your password in the profile module as soon as possible for better security.\n\nEnjoy exploring important global and Indian days!`,
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #6366f1; border-radius: 12px; max-width: 500px;">
                                <h1 style="color: #6366f1; margin-bottom: 20px;">Welcome to Important Days!</h1>
                                <p>Hello <b>${user.name}</b>,</p>
                                <p>Your account is ready. Here are your login credentials for your record:</p>
                                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                                    <p style="margin: 0; font-size: 0.9rem; color: #64748b;">LOGIN ID</p>
                                    <p style="margin: 0 0 16px 0; font-size: 1.25rem; font-weight: 800; color: #1e293b; letter-spacing: 1px;">${newId}</p>
                                    <p style="margin: 0; font-size: 0.9rem; color: #64748b;">PASSWORD</p>
                                    <p style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #1e293b; letter-spacing: 1px;">${newPwd}</p>
                                </div>
                                <div style="background: #fff7ed; padding: 12px; border-radius: 8px; border-left: 4px solid #f97316; margin-bottom: 20px;">
                                    <p style="margin: 0; font-size: 0.85rem; color: #9a3412;">
                                        <b>⚠️ Security Tip:</b> Please change your password in the <b>Profile Module</b> as soon as you log in.
                                    </p>
                                </div>
                                <p style="font-size: 0.9rem; color: #475569;">
                                    Use these details to access your dashboard and explore important dates worldwide.
                                </p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                                <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">Important Days — Celebrating what matters.</p>
                            </div>
                        `
                    });
                    console.log(`[OK] Welcome email sent to ${user.email}`);
                } catch (e) {
                    console.error("[ERR] Failed to send welcome email:", e.message);
                }
            }
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

// 4. RECOVER ACCOUNT (Step 1: Get Login ID & Send OTP)
app.post('/api/recover-account', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: "Phone required" });
        
        let user = await findUserByPhone(phone);
        
        if (user) {
            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.resetOtp = otp;
            user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
            await user.save();

            // Send OTP via Email
            if (user.email) {
                try {
                    await sendEmail({
                        to: user.email,
                        subject: "🔑 Security Code: Reset Password - Important Days",
                        text: `Hello ${user.name},\n\nYour 6-digit security code for resetting your password is: ${otp}\n\nThis code is valid for 10 minutes. If you did not request this, please ignore this email.`,
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px; max-width: 500px;">
                                <h2 style="color: #6366f1;">Password Reset</h2>
                                <p>Hello <b>${user.name}</b>,</p>
                                <p>You requested to reset your password. Use the security code below to proceed:</p>
                                <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; font-size: 1.5rem; letter-spacing: 5px; text-align: center; color: #1e293b; font-weight: 700;">
                                    ${otp}
                                </div>
                                <p style="font-size: 0.8rem; color: #64748b; margin-top: 20px;">
                                    This code is valid for 10 minutes. <br>
                                    If you did not request this, please ignore this email.
                                </p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                                <p style="font-size: 0.8rem; color: #94a3b8;">Important Days App Security Team</p>
                            </div>
                        `
                    });
                    console.log(`[OK] Reset OTP sent to ${user.email}`);
                } catch (e) {
                    console.error("[ERR] Failed to send Reset OTP:", e.message);
                }
            }

            res.json({ status: 'success', loginId: user.loginId, name: user.name, emailMasked: maskEmail(user.email) });
        } else {
            console.warn(`[WARN] Recovery failed for phone: ${phone}`);
            res.status(404).json({ status: 'error', message: 'Account not found. Please register first.' });
        }
    } catch (err) {
        console.error("Recovery error:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper: Mask email for privacy (e.g. m***@gmail.com)
function maskEmail(email) {
    if (!email) return "no email registered";
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `*@${domain}`;
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

// 5. RESET PASSWORD (Step 2: Verify OTP & Change Password)
app.post('/api/reset-password', async (req, res) => {
    try {
        const { phone, otp, newPassword } = req.body;
        if (!phone || !newPassword) return res.status(400).json({ error: "Phone and Password required" });
        
        let user = await findUserByPhone(phone);
        
        if (user) {
            // IF OTP is provided, verify it (Forgot Password Flow)
            if (otp) {
                if (!user.resetOtp || user.resetOtp !== otp) {
                    return res.status(400).json({ status: 'error', message: 'Invalid or incorrect security code.' });
                }
                if (new Date() > user.resetOtpExpiry) {
                    return res.status(400).json({ status: 'error', message: 'Security code has expired. Please request a new one.' });
                }
            } 
            // IF NO OTP, it's a direct reset (Authenticated Change from Profile)
            // Note: In a production app, we would verify a session token here.
            
            // Clear OTP and set new password
            user.password = newPassword;
            user.resetOtp = null;
            user.resetOtpExpiry = null;
            await user.save();
            
            console.log(`[OK] Password updated for: ${user.name} (${user.phone})`);

            // Send confirmation email
            if (user.email && user.email.includes('@')) {
                try {
                    await sendEmail({
                        to: user.email,
                        subject: '🔐 Password Reset Successful - Important Days App',
                        text: `Hello ${user.name}, your password has been reset successfully. Your Login ID is: ${user.loginId} and your new Password is: ${newPassword}`,
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #6366f1; border-radius: 12px; max-width: 500px;">
                                <h2 style="color: #6366f1; margin-top: 0;">Password Reset Successful</h2>
                                <p>Hello <strong>${user.name}</strong>,</p>
                                <p>Your password has been successfully updated. Please keep your new credentials safe:</p>
                                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                                    <p style="margin: 5px 0;"><strong>Login ID:</strong> <code style="color: #6366f1; font-weight: bold;">${user.loginId}</code></p>
                                    <p style="margin: 5px 0;"><strong>New Password:</strong> <code style="color: #6366f1; font-weight: bold;">${newPassword}</code></p>
                                </div>
                                <p style="font-size: 0.9rem; color: #64748b;">If you did not perform this change, please contact support immediately.</p>
                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                                <p style="font-size: 0.8rem; color: #94a3b8;">Important Days App Team</p>
                            </div>
                        `
                    });
                    console.log(`[OK] Reset confirmation email sent to ${user.email}`);
                } catch (e) {
                    console.error("[ERR] Failed to send reset confirmation email:", e.message);
                }
            }

            res.json({ status: 'success', loginId: user.loginId });
        } else {
            console.warn(`[WARN] Password update failed for phone: ${phone}`);
            res.status(404).json({ status: 'error', message: 'Account not found. Update failed.' });
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

        const s = normPhone(mobile);
        if (!s) return res.status(400).send('Invalid phone');

        // Fuzzy match: exact or last 10 digits
        let query = { mobile: s };
        if (s.length >= 10) {
            const last10 = s.slice(-10);
            query = { mobile: new RegExp(last10 + '$') };
        }

        const payment = await Payment.findOne(query).sort({ paidAt: -1 });
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

// 12. SMART AI CONTENT — Dual-Engine (Gemini + Pollinations Fusion)
app.get('/api/content', async (req, res) => {
    try {
        const { name, category } = req.query;
        if (!name) return res.status(400).json({ error: "Missing name" });

        console.log(`[INFO] Dual-AI Content Request: ${name} (${category})`);

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

        // ── Helper: Call Gemini (multi-model fallback) ─────────────
        async function callGemini(customPrompt) {
            if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('your_gemini_key')) return null;
            // Model order: gemini-flash-latest works on free quota via v1beta
            // gemini-2.0-flash has higher daily quota but resets at midnight
            const MODELS = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
            for (const model of MODELS) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
                    const resp = await axios.post(url, {
                        contents: [{ parts: [{ text: customPrompt }] }],
                        generationConfig: { temperature: 0.8, maxOutputTokens: 1200 }
                    }, { timeout: 12000 });
                    const raw = resp.data.candidates[0].content.parts[0].text;
                    const clean = raw.replace(/```json|```/g, '').trim();
                    const start = clean.indexOf('{');
                    const end = clean.lastIndexOf('}');
                    if (start === -1 || end === -1) throw new Error('No JSON in Gemini response');
                    const parsed = JSON.parse(clean.substring(start, end + 1));
                    console.log(`[OK] Gemini ${model} succeeded`);
                    return parsed;
                } catch (e) {
                    const status = e.response?.status;
                    if (status === 429 || status === 404) {
                        console.warn(`[WARN] Gemini ${model} unavailable (${status}). Trying next...`);
                        continue;
                    }
                    console.warn(`[WARN] Gemini ${model} error: ${e.message}`);
                    continue;
                }
            }
            console.warn('[WARN] All Gemini models failed. Falling back to Pollinations.');
            return null;
        }

        // ── Helper: Call Pollinations (Free, No Key) ───────────────
        async function callPollinations(customPrompt) {
            // Use GET format: text.pollinations.ai/{prompt}?model=openai&seed=random
            const seed = Math.floor(Math.random() * 9999);
            const url = `https://text.pollinations.ai/${encodeURIComponent(customPrompt)}?model=openai&seed=${seed}&json=true`;
            const resp = await axios.get(url, { timeout: 8000 });
            const raw = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
            const clean = raw.replace(/```json|```/g, '').trim();
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            if (start === -1 || end === -1) throw new Error('No JSON object in Pollinations response');
            return JSON.parse(clean.substring(start, end + 1));
        }

        // ── Run BOTH in parallel ───────────────────────────────────
        console.log(`[AI] Firing Gemini + Pollinations in parallel for: ${name}`);

        const geminiPrompt = `Create 4 social media posts for "${name}" (${category}):
1. LinkedIn/X: formal, insightful, 2-3 sentences
2. WhatsApp: warm, personal, emotional, 2-3 sentences  
3. Instagram: short punchy under 15 words with emojis
4. Hinglish: Indian audience mix Hindi+English, 2 sentences

Also 5 hashtags and 1 CTA.
ONLY return valid JSON (no markdown): {"variants":["post1","post2","post3","post4"],"hashtags":"#h1 #h2 #h3 #h4 #h5","cta":"cta here"}`;

        const pollinationsPrompt = `You are a creative storytelling expert. For the observance "${name}" (Category: ${category}), generate 2 unique content angles:
1. STORYTELLING (a short compelling micro-story or narrative about this day — 3 sentences)
2. DID YOU KNOW (a surprising fact or insightful perspective about this observance — 2 sentences)

Return ONLY valid JSON: {"story":"...","fact":"...","bonus_hashtags":"#extra1 #extra2 #extra3"}`;

        const [geminiResult, pollinationsResult] = await Promise.allSettled([
            callGemini(geminiPrompt),
            callPollinations(pollinationsPrompt)
        ]);

        let variants = [];
        let hashtags = '';
        let cta = '';
        let isAi = false;
        let freeSnippet = '';

        // ── Process Gemini output ──────────────────────────────────
        if (geminiResult.status === 'fulfilled' && geminiResult.value?.variants?.length >= 4) {
            const g = geminiResult.value;
            variants = g.variants;
            hashtags = g.hashtags || '';
            cta = g.cta || '';
            isAi = true;
            console.log(`[OK] Gemini delivered ${variants.length} variants`);
        } else {
            console.warn(`[WARN] Gemini failed: ${geminiResult.reason?.message || 'unknown'}`);
        }

        // ── Process Pollinations output & FUSE ────────────────────
        if (pollinationsResult.status === 'fulfilled' && pollinationsResult.value) {
            const p = pollinationsResult.value;
            console.log(`[OK] Pollinations delivered story + fact`);

            const storyVariant = p.story ? `📖 ${p.story}` : null;
            const factVariant = p.fact ? `💡 ${p.fact}` : null;

            // Append Pollinations creative variants to Gemini's 4
            if (storyVariant) variants.push(storyVariant);
            if (factVariant) variants.push(factVariant);

            // Merge & dedupe hashtags
            if (p.bonus_hashtags) {
                const allTags = new Set([
                    ...hashtags.split(' ').filter(Boolean),
                    ...p.bonus_hashtags.split(' ').filter(Boolean)
                ]);
                hashtags = [...allTags].slice(0, 8).join(' ');
            }

            // Use story as the free snippet for the card preview
            freeSnippet = p.story || p.fact || '';
            isAi = true;
        } else {
            console.warn(`[WARN] Pollinations failed: ${pollinationsResult.reason?.message || 'unknown'}`);
        }

        // ── Fallback: OpenAI if both failed ───────────────────────
        if (!isAi && OPENAI_API_KEY && !OPENAI_API_KEY.includes('your_openai_key')) {
            try {
                const aiResp = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are a professional social media content creator. Respond in JSON." },
                        { role: "user", content: `Create 4 social media variants for "${name}" (${category}). JSON: {"variants":["v1","v2","v3","v4"],"hashtags":"#h1...","cta":"..."}` }
                    ],
                    response_format: { type: "json_object" }, max_tokens: 900
                }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, timeout: 8000 });
                const d = JSON.parse(aiResp.data.choices[0].message.content);
                if (d.variants?.length >= 4) { variants = d.variants; hashtags = d.hashtags; cta = d.cta; isAi = true; }
            } catch (e) { console.warn(`[WARN] OpenAI fail: ${e.message}`); }
        }

        // ── Fallback: Claude if still nothing ─────────────────────
        if (!isAi && ANTHROPIC_API_KEY && !ANTHROPIC_API_KEY.includes('your_anthropic_key')) {
            try {
                const aiResp = await axios.post('https://api.anthropic.com/v1/messages', {
                    model: "claude-3-5-haiku-20241022", max_tokens: 900,
                    messages: [{ role: "user", content: `Create 4 social media variants for "${name}" (${category}). JSON: {"variants":["v1","v2","v3","v4"],"hashtags":"#h1...","cta":"..."}` }]
                }, { headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, timeout: 8000 });
                const raw = aiResp.data.content[0].text;
                const d = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
                if (d.variants?.length >= 4) { variants = d.variants; hashtags = d.hashtags; cta = d.cta; isAi = true; }
            } catch (e) { console.warn(`[WARN] Claude fail: ${e.message}`); }
        }


        // ── Step 2: Template + Wikipedia fallback if ALL AI failed ────────────
        if (!isAi) {
            console.log(`[FALLBACK] Both Gemini+Pollinations failed. Using templates for: ${name}`);
            let templateContent = '';
            switch (category) {
                case 'Festival':
                    templateContent = `✨ Happy ${name}! Celebrate with loved ones. Spread joy, happiness, and traditional values today!`;
                    hashtags = `#${(name||'').replace(/\s/g,'')} #Festival #Joy #Celebration #FestiveVibes`;
                    cta = `🎈 Share the festive spirit with everyone!`;
                    break;
                case 'Health':
                    templateContent = `💪 Today is ${name}. Health is your greatest wealth. Stay fit, stay aware, build a healthier future!`;
                    hashtags = `#${(name||'').replace(/\s/g,'')} #Health #Wellness #Awareness #HealthyLiving`;
                    cta = `💙 Spread health awareness and inspire others!`;
                    break;
                case 'India-National':
                    templateContent = `🇮🇳 Observing ${name}. Proud of our heritage. A time to reflect on history and future. Jai Hind!`;
                    hashtags = `#${(name||'').replace(/\s/g,'')} #India #NationalPride #Heritage #JaiHind`;
                    cta = `🇮🇳 Share with pride and honor!`;
                    break;
                default:
                    templateContent = `📅 Today is ${name}. An important day to reflect on the values and awareness it brings to society globally.`;
                    hashtags = `#${(name||'').replace(/\s/g,'')} #ImportantDay #Awareness #Knowledge #Significance`;
                    cta = `✨ Share this knowledge and spread importance!`;
            }
            variants.push(templateContent);
            variants.push(`🔍 Did you know today is ${name}? A day dedicated to raising awareness and celebrating milestones. Make a positive impact by sharing!`);
            variants.push(`🌍 ${name} is more than a date — it's a testament to our global heritage and ongoing efforts for a better world.`);
            try {
                const wikiRes = await axios.get(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g,'_'))}`,
                    { headers: { 'User-Agent': 'ImportantDaysApp/2.0' }, timeout: 5000 }
                );
                if (wikiRes.data?.extract) {
                    let s = wikiRes.data.extract.trim();
                    if (s.length > 500) s = s.substring(0, 497) + '…';
                    variants.push(s);
                }
            } catch (e) {
                variants.push(`🌟 Let's acknowledge ${name}. Learning about its history and sharing its values makes every day meaningful.`);
            }
            while (variants.length < 4) {
                variants.push(`🌈 Celebrating ${name} today! Share the significance of this special observance with your network.`);
            }
        }

        // freeSnippet: prefer Pollinations story/fact, else first variant
        const finalFreeSnippet = freeSnippet || variants[0] || '';
        console.log(`[DONE] ${variants.length} variants | AI=${isAi} | for: ${name}`);
        res.json({ status: 'success', variants, hashtags, cta, freeSnippet: finalFreeSnippet, isAi });
    } catch (err) {
        console.error("AI Content Error:", err);
        res.status(500).json({ error: "Failed to generate content" });
    }
});


// 13. BACKEND GALLERY API
app.get('/api/gallery', async (req, res) => {
    const galleryPath = path.join(__dirname, 'public', 'gallery');
    if (!fs.existsSync(galleryPath)) {
        return res.json([]);
    }

    try {
        // 1. Get all files
        const files = fs.readdirSync(galleryPath);
        const allImages = files
            .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
            .map(f => `/public/gallery/${f}`);

        // 2. Filter out blacklisted ones from DB
        const deletedRecords = await DeletedImage.find({}, 'url');
        const deletedUrls = new Set(deletedRecords.map(r => r.url));

        const visibleImages = allImages.filter(url => !deletedUrls.has(url));
        res.json(visibleImages);
    } catch (err) {
        console.error("Gallery API Error:", err);
        res.status(500).json({ error: "Failed to fetch gallery" });
    }
});

// 13. RESET DATABASE (Protected)
app.post('/api/admin/reset-db', async (req, res) => {
    try {
        const { id, pwd } = req.body;
        const adminId = process.env.ADMIN_ID || 'EMYRIS';
        const adminPwd = process.env.ADMIN_PWD || 'NEW@1306';

        if (id !== adminId || pwd !== adminPwd) {
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
        const adminId = process.env.ADMIN_ID || 'EMYRIS';
        const adminPwd = process.env.ADMIN_PWD || 'NEW@1306';

        if (id !== adminId || pwd !== adminPwd) {
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
