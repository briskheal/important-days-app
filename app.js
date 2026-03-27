/* ====================================
   IMPORTANT DAYS APP – app.js
   ==================================== */

'use strict';

// ── Global Helper: Normalize Phone ──────────────────
window.normPhone = function(p) {
    if (!p) return "";
    return String(p).replace(/\D/g, '');
};

// ── API URL Helper ──────────────────
function getApiUrl(path) {
    if (!path || path.startsWith('data:')) return path;
    if (window.location.protocol === 'file:') {
        return `http://localhost:8083${path}`;
    }
    return path;
}

// ── Server Warm-up (Ping) ──────────────────
(function wakeUpServer() {
    if (window.location.protocol !== 'file:') {
        console.log("[INFO] Waking up server...");
        fetch(getApiUrl('/api/ping')).catch(() => {});
    }
})();

// ── Auth Check ─────────────────────────────
if (localStorage.getItem('importantDays_session_active') !== 'true') {
    window.location.replace('landing.html');
}

// ── Header Actions ───────────────────────────
window.handleLogout = function() {
    // Clear session immediately for reliability, or use a custom modal if needed.
    // We'll use a smoother transition.
    const btn = document.getElementById('logout-btn');
    if (btn) btn.textContent = '🚪 Logging out...';
    
    setTimeout(() => {
        localStorage.removeItem('importantDays_session_active');
        localStorage.removeItem('importantDays_user');
        localStorage.removeItem('importantDays_clickCount'); 
        window.location.replace('landing.html');
    }, 300);
};

// ── PWA: Service Worker ──────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
    });
}

// ── Feedback: Toasts ──────────────────────────
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.cssText = `
        padding: 12px 20px; border-radius: 12px; background: #1f2937; color: #fff;
        border: 1px solid rgba(255,255,255,0.1); border-left: 4px solid ${type === 'success' ? '#10b981' : '#ef4444'};
        font-size: 0.88rem; font-weight: 500; display: flex; align-items: center; gap: 10px;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); animation: toastSlideIn 0.3s ease;
    `;
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> ${message}`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// ── Welcome Onboarding ───────────────────────
window.closeWelcomeModal = function() {
    const modal = document.getElementById('welcome-modal');
    if (modal) modal.hidden = true;
};

function checkFirstLogin() {
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    if (user.first_login !== false) {
        const modal = document.getElementById('welcome-modal');
        if (modal) modal.hidden = false;
        
        // Mark as seen anyway (user can still see it once)
        user.first_login = false;
        localStorage.setItem('importantDays_user', JSON.stringify(user));
    }
}

// ── Welcome Banner & Admin Tools ──────
const activeUserObj = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
const welcomeBanner = document.getElementById('welcome-banner');
const exportBtn = document.getElementById('db-export-btn');

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateWelcomeBanner() {
    const activeUserObj = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    if (!activeUserObj || !activeUserObj.name || !welcomeBanner) return;

    const regDate = new Date(activeUserObj.createdAt || new Date());
    const diffDays = Math.ceil(Math.abs(new Date() - regDate) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, 10 - diffDays);

    let statusHtml = '';
    const subKey = activeUserObj.phone ? `importantDays_subscription_${activeUserObj.phone}` : 'importantDays_subscription';
    const sub = JSON.parse(localStorage.getItem(subKey) || 'null');
    
    if (sub?.status === 'pending') {
        statusHtml = `<span class="badge badge-pending">⏳ Pending Verification</span>`;
    } else if (sub?.status === 'rejected') {
        statusHtml = `<span class="badge badge-rejected">❌ Payment Rejected</span>`;
    } else if (sub?.status === 'active' || sub?.status === 'approved') {
        const expiry = new Date(sub.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        statusHtml = `<span class="badge badge-active">💎 ${sub.type.toUpperCase()} Activated until ${expiry}</span>`;
    } else if (remaining > 0) {
        statusHtml = `<span class="badge badge-trial">${remaining} days trial</span>`;
    }

    welcomeBanner.innerHTML = `👋 Welcome, ${escHtml(activeUserObj.name.split(' ')[0])}! ${statusHtml}`;
    welcomeBanner.style.display = 'inline-flex';

    // Show teaser if user preference is ON
    const teaser = document.getElementById('onboarding-teaser');
    if (teaser) {
        const showPref = activeUserObj.showTeaser !== false; // Default to true
        teaser.style.display = showPref ? 'block' : 'none';
    }

    const adminBtn = document.getElementById('fixed-admin-btn');
    if (adminBtn) {
        const normPhone = (activeUserObj.phone || '').replace(/\D/g, '');
        // Robust check: matches both 10-digit and 12-digit versions of the admin phone
        const isAdmin = (normPhone === '8878923337' || normPhone === '918878923337');
        adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        if (isAdmin) console.log("[ADMIN] Admin button visibility: active");
    }
}

updateWelcomeBanner();

async function checkSubscriptionStatus() {
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    const subStatusBadge = document.getElementById('sub-status-badge');
    const subBtn = document.getElementById('fixed-subscribe-btn');
    const footerCta = document.getElementById('footer-sub-cta');

    if (!user.phone) return;

    // Show button originally, then handle state
    if (subBtn) subBtn.style.setProperty('display', 'inline-flex', 'important');
    if (footerCta) {
        footerCta.onclick = () => showSubscriptionModal();
        footerCta.hidden = false;
    }

    try {
        const res = await fetch(getApiUrl(`/api/subscription-status?mobile=${encodeURIComponent(user.phone)}`));
        const sub = await res.json();
        const now = new Date();
        const subKey = `importantDays_subscription_${user.phone}`;

        if (sub && (sub.status === 'active' || sub.status === 'approved')) {
            if (new Date(sub.expiry) > now) {
                localStorage.setItem(subKey, JSON.stringify(sub));
                updateWelcomeBanner(); 
                if (subBtn) subBtn.style.setProperty('display', 'none', 'important');
                if (footerCta) footerCta.hidden = true;
                if (subStatusBadge) {
                    subStatusBadge.style.display = 'inline-flex';
                    const displayType = sub.type.charAt(0).toUpperCase() + sub.type.slice(1);
                    subStatusBadge.innerHTML = `<span>💎</span> ${displayType} Subscription`;
                    subStatusBadge.style.background = 'rgba(67, 208, 138, 0.1)';
                    subStatusBadge.style.color = 'var(--accent-success)';
                }
                return;
            } else {
                localStorage.removeItem(subKey);
            }
        } else if (sub && sub.status === 'pending') {
            localStorage.setItem(subKey, JSON.stringify(sub));
            if (subBtn) {
                subBtn.innerHTML = "⏳ Pending with admin";
                subBtn.style.background = "rgba(124, 111, 255, 0.1)";
                subBtn.style.color = "var(--accent-1)";
                subBtn.style.padding = "8px 20px";
            }
            if (footerCta) footerCta.hidden = true;
            if (subStatusBadge) {
                subStatusBadge.classList.add('show');
                subStatusBadge.innerHTML = `<span>⏳</span> Payment Pending`;
                subStatusBadge.style.background = 'rgba(124, 111, 255, 0.1)';
                subStatusBadge.style.display = 'inline-flex';
            }
        } else if (sub && sub.status === 'rejected') {
            localStorage.setItem(subKey, JSON.stringify(sub));
            if (subBtn) {
                subBtn.innerHTML = "❌ Payment Rejected";
                subBtn.style.background = "rgba(239, 68, 68, 0.1)";
                subBtn.style.color = "#f87171";
                subBtn.onclick = () => showSubscriptionModal(true);
            }
            if (subStatusBadge) {
                subStatusBadge.style.display = 'inline-flex';
                subStatusBadge.classList.add('show');
                subStatusBadge.innerHTML = `<span>❌</span> Payment Rejected`;
                subStatusBadge.style.background = 'rgba(239, 68, 68, 0.1)';
                subStatusBadge.style.display = 'inline-flex';
            }
        }
    } catch (err) {
        console.warn("Backend sync failed", err);
    }

    // Trial check logic (if not active)
    const regDate = new Date(user.createdAt || new Date());
    const diffDays = Math.ceil(Math.abs(new Date() - regDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 10) {
        lockMainContent();
    }
    // Trial info is shown in the welcome banner — no duplicate badge needed
}
async function checkPendingApprovals() {
    const activeUserObj = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    if (!activeUserObj || !activeUserObj.phone) return;

    const normPhone = (activeUserObj.phone || '').replace(/\D/g, '');
    const isAdmin = (normPhone === '8878923337' || normPhone === '918878923337');
    
    if (!isAdmin) return;

    try {
        const res = await fetch(getApiUrl('/api/admin/ledger'));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ledger = await res.json();
        
        const pendingItems = (ledger || []).filter(p => p.status === 'pending');
        const pendingCount = pendingItems.length;
        
        const adminBtn = document.getElementById('fixed-admin-btn');
        if (adminBtn) {
            if (pendingCount > 0) {
                adminBtn.classList.add('blink-admin');
                // Add or update badge
                let badge = adminBtn.querySelector('.admin-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'admin-badge';
                    adminBtn.appendChild(badge);
                }
                badge.textContent = pendingCount;
                console.log(`[ADMIN] ${pendingCount} approvals pending. Blinking active.`);
            } else {
                adminBtn.classList.remove('blink-admin');
                const badge = adminBtn.querySelector('.admin-badge');
                if (badge) badge.remove();
            }
        }
    } catch (e) {
        console.warn("[ADMIN] Failed to check pending approvals:", e.message);
    }
}

async function initApp() {
    updateWelcomeBanner();
    await checkSubscriptionStatus();
    checkFirstLogin();
    checkPendingApprovals();
    // Re-check every 30 seconds
    setInterval(checkPendingApprovals, 30000);
}
initApp();


// Lock main content area only — header & Subscribe button remain clickable
function lockMainContent() {
    const main = document.querySelector('main');
    if (!main || document.getElementById('main-lock')) return;
    
    const lock = document.createElement('div');
    lock.id = 'main-lock';
    lock.className = 'trial-lock-overlay';
    lock.innerHTML = `
        <div class="lock-card glass-card">
            <div class="lock-icon">⏰</div>
            <h2>Trial Expired</h2>
            <p>Your 10-day free trial has expired. Subscribe to continue exploring special days.</p>
            <button class="btn-primary" onclick="showSubscriptionModal(true)">Subscribe Now</button>
        </div>`;
    main.appendChild(lock);
}

window.resetSubscription = function() {
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    if (user.phone) {
        localStorage.removeItem(`importantDays_subscription_${user.phone}`);
        const rejs = JSON.parse(localStorage.getItem('importantDays_rejectedSubs') || '{}');
        delete rejs[user.phone];
        localStorage.setItem('importantDays_rejectedSubs', JSON.stringify(rejs));
    }
    localStorage.removeItem('importantDays_subscription');
    window.location.reload();
};

window.showSubscriptionModal = function(isExpired = false) {
    const modal = document.getElementById('fixed-sub-modal');
    const message = document.getElementById('sub-message');
    if (!modal) return;
    
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    const subKey = user.phone ? `importantDays_subscription_${user.phone}` : 'importantDays_subscription';
    const sub = JSON.parse(localStorage.getItem(subKey) || 'null');

    modal.hidden = false;
    
    if (sub && sub.status === 'rejected') {
        message.innerHTML = "<div style='color: #f72585; font-weight: 700; font-size: 1.1rem; margin-bottom: 8px;'>REJECTED BY ADMIN</div>Your payment receipt was rejected due to non-receipt of payment.<br>Please <a href='tel:8878923337' style='color: #7c6fff; font-weight: bold; text-decoration: underline;'>Contact 8878923337</a> for support or <a href='#' onclick='resetSubscription()' style='color: #43d08a; font-weight: bold; text-decoration: underline;'>Subscribe Again</a>.";
        document.getElementById('upi-section').style.display = 'none';
        document.getElementById('sub-close-btn').style.display = 'flex';
    } else if (sub && sub.status === 'pending') {
        message.innerHTML = "<div style='color: var(--accent-1); font-weight: 700;'>Payment Verification Pending</div>Your transaction ID has been submitted. The Admin is verifying your payment. Access will be granted shortly.";
        document.getElementById('upi-section').style.display = 'none';
        document.getElementById('sub-close-btn').style.display = 'flex';
    } else if (isExpired) {
        message.textContent = "Your 10-day free trial has expired. Subscribe to continue enjoying full access.";
        document.getElementById('sub-close-btn').style.display = 'none';
        document.getElementById('upi-section').style.display = 'none';
    } else {
        message.textContent = "Enjoying the app? Subscribe now for uninterrupted access and support our work!";
        document.getElementById('sub-close-btn').style.display = 'flex';
        document.getElementById('upi-section').style.display = 'none';
    }
}

// ── Generic Modal Close Listeners ──
document.getElementById('sub-close-btn')?.addEventListener('click', () => {
    document.getElementById('fixed-sub-modal').hidden = true;
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const subModal = document.getElementById('fixed-sub-modal');
        const profModal = document.getElementById('fixed-profile-modal');
        if (subModal && !subModal.hidden) {
            // Only allow escape if NOT expired (X button is hidden for expired users)
            if (document.getElementById('sub-close-btn').style.display !== 'none') {
                subModal.hidden = true;
            }
        }
        if (profModal && !profModal.hidden) profModal.hidden = true;
    }
});

document.getElementById('fixed-sub-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'fixed-sub-modal') {
        // Only allow overlay close if NOT expired
        if (document.getElementById('sub-close-btn').style.display !== 'none') {
            document.getElementById('fixed-sub-modal').hidden = true;
        }
    }
});

document.getElementById('fixed-profile-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'fixed-profile-modal') {
        document.getElementById('fixed-profile-modal').hidden = true;
    }
});

// ── State ──────────────────────────────
let state = {
    query: '',
    category: 'All',
};

// Calendar state
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let selectedDate = null; // 'MM-DD'

// ── Helpers ────────────────────────────
function padZ(n) { return String(n).padStart(2, '0'); }

function todayMMDD() {
    const now = new Date();
    return `${padZ(now.getMonth() + 1)}-${padZ(now.getDate())}`;
}

function mmddFromDate(d) {
    return `${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
}

function formatDateFull(d) {
    return d.toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
}

function formatShortDate(mmdd) {
    const [mm, dd] = mmdd.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { month: months[mm - 1], day: dd };
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlight(text, query) {
    if (!query) return escHtml(text);
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escHtml(text).replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
}

function catClass(cat) {
    return 'cat-' + cat.replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ── Unique categories list ──────────────
const ALL_CATEGORIES = ['All', ...Object.values(CATEGORIES)];

// ── DOM refs ───────────────────────────
const todayBadgesEl = document.getElementById('today-badges');
const heroDateEl = document.getElementById('today-full-date');
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const categoryChipsEl = document.getElementById('category-chips');
const calGrid = document.getElementById('cal-grid');
const calMonthLabel = document.getElementById('cal-month-label');
const calPrevBtn = document.getElementById('cal-prev-btn');
const calNextBtn = document.getElementById('cal-next-btn');
const dayDetailPanel = document.getElementById('day-detail-panel');
const upcomingList = document.getElementById('upcoming-list');
const clockEl = document.getElementById('live-clock');

// ── Live Clock ──────────────────────────
function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ── Render Today Banner ──────────────────
function renderToday() {
    const today = new Date();
    heroDateEl.textContent = formatDateFull(today);

    const todayKey = todayMMDD();
    const todayDays = importantDays.filter(d => d.date === todayKey);

    todayBadgesEl.innerHTML = '';
    if (todayDays.length === 0) {
        todayBadgesEl.innerHTML = `<span class="no-days-today">No special observances registered for today</span>`;
    } else {
        todayDays.forEach((d, i) => {
            const el = document.createElement('div');
            el.className = 'today-badge';
            el.style.animationDelay = `${i * 0.07}s`;
            el.style.cursor = 'pointer'; // Ensure pointer cursor
            el.setAttribute('role', 'button');
            el.innerHTML = `<span class="emoji">${d.emoji}</span> ${escHtml(d.name)}`;
            el.onclick = () => {
                selectDate(todayKey, true);
                // The auto-open logic in selectDate will take care of the rest
            };
            todayBadgesEl.appendChild(el);
        });
    }
}

// ── Render Category Chips ────────────────
function renderChips() {
    categoryChipsEl.innerHTML = '';
    ALL_CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'chip' + (cat === state.category ? ' active' : '');
        btn.textContent = cat;
        btn.setAttribute('aria-pressed', cat === state.category);
        btn.addEventListener('click', () => {
            state.category = cat;
            renderChips();
            renderCalendar();
        });
        categoryChipsEl.appendChild(btn);
    });
}

// ── Get filtered days for a given MM-DD key ──
function getEventsForDate(mmdd) {
    let events = importantDays.filter(d => d.date === mmdd);
    if (state.category !== 'All') {
        events = events.filter(d => d.category === state.category);
    }
    if (state.query) {
        const q = state.query.toLowerCase();
        events = events.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q)
        );
    }
    return events;
}

// ── Get all events for current month (filtered) ──
function getMonthEvents() {
    const mm = padZ(calMonth + 1);
    const daysInMon = new Date(calYear, calMonth + 1, 0).getDate();
    let events = importantDays.filter(d => d.date.startsWith(mm + '-'));
    if (state.category !== 'All') {
        events = events.filter(d => d.category === state.category);
    }
    if (state.query) {
        const q = state.query.toLowerCase();
        events = events.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q)
        );
    }
    return events;
}

// ── Render Calendar ─────────────────────
function renderCalendar() {
    const todayKey = todayMMDD();
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMon = new Date(calYear, calMonth + 1, 0).getDate();

    calMonthLabel.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
    calGrid.innerHTML = '';

    // Blank cells before day 1
    for (let b = 0; b < firstDay; b++) {
        const blank = document.createElement('div');
        blank.className = 'cal-cell cal-blank';
        calGrid.appendChild(blank);
    }

    // Day cells
    for (let d = 1; d <= daysInMon; d++) {
        const mm = padZ(calMonth + 1);
        const dd = padZ(d);
        const key = `${mm}-${dd}`;
        const isToday = (key === todayKey);
        const isSelected = (key === selectedDate);
        const events = getEventsForDate(key);

        const cell = document.createElement('div');
        cell.className = 'cal-cell'
            + (isToday ? ' cal-today' : '')
            + (isSelected ? ' cal-selected' : '')
            + (events.length ? ' cal-has-events' : '');
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label',
            `${MONTH_NAMES[calMonth]} ${d}${events.length ? ': ' + events.map(e => e.name).join(', ') : ''}`);

        // Day number
        const numEl = document.createElement('div');
        numEl.className = 'cal-day-num';
        numEl.textContent = d;
        cell.appendChild(numEl);

        // Event pills — show up to 3
        if (events.length > 0) {
            const listEl = document.createElement('ul');
            listEl.className = 'cal-event-list';
            const SHOW_MAX = 3;
            events.slice(0, SHOW_MAX).forEach(ev => {
                const li = document.createElement('li');
                li.className = 'cal-event-item';
                li.innerHTML = `<span class="cal-ev-emoji">${ev.emoji}</span><span class="cal-ev-name">${escHtml(ev.name)}</span>`;
                listEl.appendChild(li);
            });
            if (events.length > SHOW_MAX) {
                const more = document.createElement('li');
                more.className = 'cal-event-more';
                more.textContent = `+${events.length - SHOW_MAX} more`;
                listEl.appendChild(more);
            }
            cell.appendChild(listEl);
        }

        // Click to show detail
        cell.addEventListener('click', () => selectDate(key));

        calGrid.appendChild(cell);
    }

    // Re-render detail panel for current selection
    renderDayDetail();
}

// ── Select a date ────────────────────────
function selectDate(key, force = false) {
    const isAlreadySelected = (selectedDate === key);
    selectedDate = (isAlreadySelected && !force) ? null : key;
    renderCalendar();
    
    if (selectedDate) {
        // Track usage — triggers registration modal after 10 clicks
        if (typeof trackDayClick === 'function') trackDayClick();
        
        // Auto-scroll to detail panel
        setTimeout(() => dayDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

        // --- SMART AUTO-OPEN ---
        // If this day has EXACTLY ONE event, open the content modal automatically
        const events = getEventsForDate(selectedDate);
        if (events.length === 1) {
            const ev = events[0];
            // Small delay to ensure renderDayDetail is done and scrolling is underway
            setTimeout(() => {
                openContentModal(selectedDate, ev.name, ev.category);
            }, 300);
        }
    }
}

// ── Render Day Detail Panel ──────────────
function renderDayDetail() {
    dayDetailPanel.innerHTML = '';
    if (!selectedDate) return;

    const events = getEventsForDate(selectedDate);
    const [mm, dd] = selectedDate.split('-').map(Number);
    const dateLabel = `${MONTH_NAMES[mm - 1]} ${dd}, ${calYear}`;

    if (events.length === 0) {
        dayDetailPanel.innerHTML = `
          <div class="detail-empty">
            <span>📭</span>
            <p>No activities on <strong>${dateLabel}</strong>${state.category !== 'All' ? ` under <em>${state.category}</em>` : ''}</p>
            <button class="detail-close-btn" id="detail-close">✕ Close</button>
          </div>`;
    } else {
        const cards = events.map((ev, idx) => {
            const catCls = catClass(ev.category);
            return `
            <div class="detail-card">
              <div class="detail-card-top">
                <div class="detail-emoji">${ev.emoji}</div>
                <div class="detail-info">
                  <div class="detail-name">${highlight(ev.name, state.query)}</div>
                  <span class="card-category ${catCls}">${escHtml(ev.category)}</span>
                </div>
              </div>
              <p class="detail-desc">${highlight(ev.description, state.query)}</p>
              <div class="detail-free-content" id="free-content-${idx}" style="margin: 12px 0; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; font-size: 0.82rem; border-left: 3px solid var(--accent-3); display: none;">
                <div style="font-weight: 700; color: var(--accent-3); margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase;">💡 Quick Fact</div>
                <div class="free-text">Loading...</div>
              </div>
              <button class="detail-content-btn detail-content-btn--card" data-action="get-content" data-date="${selectedDate}" data-name="${escHtml(ev.name)}" data-category="${escHtml(ev.category)}">📝 Get Content for &ldquo;${escHtml(ev.name)}&rdquo;</button>
            </div>`;
        }).join('');

        dayDetailPanel.innerHTML = `
          <div class="detail-header">
            <div class="detail-date-label">📅 ${dateLabel}</div>
            <div class="detail-header-actions">
              <button class="detail-close-btn" data-action="close-detail">✕ Close</button>
            </div>
          </div>
          <div class="detail-cards-grid">${cards}</div>`;

        // Fetch free snippets for each card
        events.forEach((ev, idx) => fetchFreeSnippet(selectedDate, ev.name, `free-content-${idx}`));
    }
}

async function fetchFreeSnippet(date, name, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
        const res = await fetch(getApiUrl(`/api/content?date=${date}&name=${encodeURIComponent(name)}`));
        if (res.ok) {
            const data = await res.json();
            // Use freeSnippet if available, or first variant as fallback
            const snippet = data.freeSnippet || (data.variants && data.variants[0]);
            if (data.status === 'success' && snippet) {
                el.style.display = 'block';
                el.querySelector('.free-text').textContent = snippet;
            }
        }
    } catch (e) {
        console.warn("Free snippet fetch failed", e);
    }
}

// ── Event delegation on detail panel (set up ONCE, works across all renders) ──
dayDetailPanel.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'get-content') {
        e.preventDefault();
        openContentModal(btn.dataset.date, btn.dataset.name, btn.dataset.category);
    }
    if (btn.dataset.action === 'close-detail') {
        selectedDate = null;
        renderCalendar();
    }
    // also handle empty-panel close button
    if (btn.classList.contains('detail-close-btn')) {
        selectedDate = null;
        renderCalendar();
    }
});


// ── Render Upcoming 7 Days ───────────────
function renderUpcoming() {
    upcomingList.innerHTML = '';
    const today = new Date();
    const upcomingDays = [];

    for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const key = mmddFromDate(d);
        const matches = importantDays.filter(x => x.date === key);
        matches.forEach(m => upcomingDays.push({ ...m, jsDate: d }));
    }

    if (upcomingDays.length === 0) {
        upcomingList.innerHTML = `<p style="color:var(--text-muted);font-size:.88rem">No upcoming days in the next 7 days.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    upcomingDays.forEach((d, i) => {
        const { month, day } = formatShortDate(d.date);
        const li = document.createElement('div');
        li.className = 'upcoming-item';
        li.style.cursor = 'pointer';
        li.setAttribute('role', 'button');
        li.style.animationDelay = `${i * 0.05}s`;
        li.onclick = () => selectDate(d.date, true);
        li.innerHTML = `
      <div class="upcoming-date-badge">
        <span class="month">${month}</span>
        <span class="day-num">${day}</span>
      </div>
      <span class="upcoming-emoji">${d.emoji}</span>
      <div>
        <div class="upcoming-name">${escHtml(d.name)}</div>
        <div class="upcoming-cat">${escHtml(d.category)}</div>
      </div>
    `;
        fragment.appendChild(li);
    });
    upcomingList.appendChild(fragment);
}

// ── Search handling ──────────────────────
searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim();
    clearBtn.style.display = state.query ? 'block' : 'none';
    renderCalendar();
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.query = '';
    clearBtn.style.display = 'none';
    renderCalendar();
    searchInput.focus();
});

// ── Calendar nav ─────────────────────────
calPrevBtn.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    selectedDate = null;
    renderCalendar();
});

calNextBtn.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    selectedDate = null;
    renderCalendar();
});

// ── Keyboard shortcut: '/' focuses search ──
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
    if (e.key === 'Escape' && selectedDate) {
        selectedDate = null;
        renderCalendar();
    }
});

// ── Initial Render ──────────────────────
try {
    checkSubscriptionStatus();
} catch (e) {
    console.error("Subscription check failed:", e);
}
renderToday();
renderChips();
renderCalendar();
renderUpcoming();
checkFirstLogin();

// ── Blinking Login Hint Banner ──────────
(function showLoginHint() {
    // Only show once per session
    if (sessionStorage.getItem('importantDays_hintShown')) return;
    sessionStorage.setItem('importantDays_hintShown', '1');

    const hint = document.createElement('div');
    hint.id = 'login-hint-banner';
    hint.innerHTML = `
      <span class="hint-pulse-dot"></span>
      <span>👆 Click on any <strong>calendar event</strong> to view details &nbsp;·&nbsp; 💎 <strong>Subscribe</strong> to unlock full content!</span>
      <button class="hint-close-btn" onclick="this.parentElement.remove()" aria-label="Dismiss">✕</button>
    `;
    hint.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
        'z-index:9999', 'background:linear-gradient(135deg,rgba(124,111,255,0.95),rgba(247,37,133,0.9))',
        'color:#fff', 'padding:14px 22px', 'border-radius:50px',
        'font-size:0.88rem', 'font-weight:600', 'display:flex', 'align-items:center', 'gap:10px',
        'box-shadow:0 8px 32px rgba(124,111,255,0.45)', 'max-width:92vw',
        'animation:hintSlideUp 0.5s ease'
    ].join(';');
    document.body.appendChild(hint);

    // Auto-dismiss after 12 seconds
    setTimeout(() => { if (hint.parentElement) hint.remove(); }, 12000);
})();

// Auto select today if there are events
const todayEvts = importantDays.filter(d => d.date === todayMMDD());
if (todayEvts.length > 0) {
    selectedDate = todayMMDD();
    renderDayDetail();
}

// ── Dynamic Premium Content Modal ───────────
const GalleryUI = {
    overlay: null,
    grid: null,
    onSelect: null,
    init() {
        if (this.overlay) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'gallery-overlay';
        this.overlay.innerHTML = `
            <div class="gallery-container">
                <div class="gallery-header">
                    <h3 style="margin:0; font-family:'Outfit',sans-serif;">📁 Backend Gallery</h3>
                    <button class="gallery-close" onclick="GalleryUI.hide()">✕</button>
                </div>
                <div id="gallery-grid" class="gallery-grid">
                    <p style="grid-column: 1/-1; text-align:center; opacity:0.5;">Loading images...</p>
                </div>
                <div style="padding:15px; border-top:1px solid rgba(255,255,255,0.05); text-align:center;">
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin:0;">Tip: Add your own images to <code>/public/gallery</code> folder</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.grid = document.getElementById('gallery-grid');
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.hide(); };
    },
    async show(callback) {
        this.init();
        this.onSelect = callback;
        this.overlay.style.display = 'flex';
        this.grid.innerHTML = '<div class="gallery-loading-pulse">⏳ Loading high-quality gallery... Please wait.</div>';
        
        try {
            const res = await fetch(getApiUrl('/api/gallery'));
            const images = await res.json();
            
            if (!images || images.length === 0) {
                this.grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; opacity:0.5; padding:40px;">No images found in gallery.<br><br><span style="font-size:0.7rem;">Please add images to <code>/public/gallery</code></span></p>';
                return;
            }
            
            this.grid.innerHTML = images.map(url => `
                <div class="gallery-item">
                    <button class="gallery-del-btn" onclick="GalleryUI.deletePhoto(event, '${url}')" title="Delete Photo">✕</button>
                    <img src="${getApiUrl(url)}" alt="Gallery Image" onclick="GalleryUI.select('${url}')">
                </div>
            `).join('');
        } catch (e) {
            console.error("Gallery Fetch Error:", e);
            this.grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#f87171;">Failed to load gallery.</p>';
        }
    },
    async deletePhoto(e, url) {
        e.stopPropagation();
        if (!confirm("Permanently delete this photo from gallery?")) return;
        
        try {
            const res = await fetch(getApiUrl('/api/delete-photo'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.show(this.onSelect); // Refresh
            } else {
                alert("Delete failed: " + (data.error || 'Server error'));
            }
        } catch (err) {
            console.error("Delete Fail:", err);
            alert("Connection error. Could not delete.");
        }
    },
    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    },
    select(url) {
        if (this.onSelect) this.onSelect(url);
        this.hide();
    }
};

const ContentUI = {
    overlay: null,
    title: null,
    body: null,
    copyBtn: null,
    refreshBtn: null,
    variants: [],
    currentIndex: 0,
    selectedImage: null,
    withPhoto: true,
    aiDimensions: { width: 1080, height: 1350, label: '2:3' },
    init() {
        console.log("ContentUI: Initializing...");
        const existing = document.getElementById('dynamic-content-modal');
        if (existing && document.getElementById('DCM-AI-GENERATE')) {
            this.overlay = existing;
            return;
        }
        if (existing) existing.remove();

        this.overlay = document.createElement('div');
        this.overlay.id = 'dynamic-content-modal';
        this.overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 1000000; 
            background: rgba(10, 12, 30, 0.75); backdrop-filter: blur(12px); 
            display: none; align-items: center; justify-content: center; padding: 20px;
        `;
        this.overlay.innerHTML = `
            <div class="cm-main-card" style="background:#161a2e; border:1px solid rgba(255,255,255,0.1); border-radius:24px; max-width:520px; width:100%; position:relative; box-shadow: 0 20px 50px rgba(0,0,0,0.5); color:#ebecf0; font-family:'Inter', sans-serif; overflow:hidden;">
                <div class="cm-header" style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:space-between; position:relative; z-index:10;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.2rem;">💡</span>
                        <h3 id="DCM-TITLE" style="margin:0; font-family:'Outfit',sans-serif; font-size:1.1rem; font-weight:700;">Content</h3>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <button id="DCM-REFRESH" title="See Next Variant" style="background:linear-gradient(135deg, #7c6fff, #4cc9f0); color:#fff; border:none; padding:10px 20px; border-radius:50px; cursor:pointer; font-weight:800; font-size:0.85rem; display:none; align-items:center; gap:8px; transition:0.3s; box-shadow: 0 4px 15px rgba(124, 111, 255, 0.3); transform: scale(1.05);">
                            <span>🔄</span> Next Variant
                        </button>
                        <button id="DCM-CLOSE" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; width:36px; height:36px; border-radius:50%; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; transition:0.2s;">✕</button>
                    </div>
                </div>

                <!-- NEW: Integrated Scroll Container -->
                <div class="cm-scroll-container" style="position:relative;">
                    <div id="DCM-SCROLL-VIEWPORT" style="max-height: 480px; overflow-y: auto; scrollbar-width: none; position: relative; scroll-behavior: smooth;">
                        
                        <div id="DCM-BODY" style="padding:16px 20px; line-height:1.6; font-size:0.95rem; color:#d1d5db;"></div>
                        
                        <!-- Image Preview Section -->
                        <div id="DCM-IMAGE-SECTION" style="padding:0 20px; display:none;">
                            <div class="cm-image-preview-container">
                                <img id="DCM-PREVIEW" class="cm-image-preview" src="" alt="Post Preview">
                                <div id="DCM-PREVIEW-PLACEHOLDER" style="font-size:0.8rem; opacity:0.5;">No Image Selected</div>
                            </div>
                        </div>

                        <div class="cm-image-controls" style="padding:0 20px; display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
                            <button id="DCM-TOGGLE-PHOTO" class="cm-btn-secondary" title="Toggle Photo Section" style="flex:0; padding:10px;">
                                <span id="DCM-PHOTO-ICON">🖼️</span> <span id="DCM-PHOTO-TEXT" style="display:none;">With Photo</span>
                            </button>
                            <button id="DCM-AI-GENERATE" class="cm-btn-secondary" style="background:rgba(124,111,255,0.2); border-color:rgba(124,111,255,0.4); color:#a78bfa; flex:1.2; min-width:110px; font-weight:700; display:none; border-width:2px;">
                                ✨ AI Photos
                            </button>
                            <button id="DCM-OPEN-GALLERY" class="cm-btn-secondary" style="display:none; flex:1; min-width:80px;">
                                📁 Gallery
                            </button>
                            <button id="DCM-UPLOAD-PHOTO" class="cm-btn-secondary" style="display:none; flex:1; min-width:80px;">
                                📤 Upload
                            </button>
                            <button id="DCM-REMOVE-PHOTO" class="cm-btn-secondary" style="display:none; background:rgba(248,113,113,0.1); color:#f87171; border-color:rgba(248,113,113,0.2); flex:0; padding:10px;">
                                🗑️
                            </button>
                        </div>
                        
                        <div id="DCM-DOWNLOAD-WRAP" style="padding:12px 20px 0; display:none;">
                            <button id="DCM-DOWNLOAD-BTN" class="cm-btn-download">
                                📥 Download Image for Sharing
                            </button>
                        </div>

                        <!-- Feedback Message -->
                        <div style="text-align:center; height:20px; margin-top:12px;">
                            <span id="DCM-FEEDBACK" style="font-size:0.8rem; color:#43d08a; font-weight:600; opacity:0; transition:0.3s; display:inline-block;">Copied!</span>
                        </div>

                        <!-- Social Sharing Section -->
                        <div style="padding:8px 20px; text-align:center;">
                            <p style="font-size:0.75rem; color:#9ca3af; margin:0 0 10px;">
                                💡 Tip: <a href="#" id="DCM-LINK-PROFILES" style="color:#7c6fff; text-decoration:none; border-bottom:1px dashed #7c6fff;">Link social profiles</a> for easier sharing
                            </p>
                            <div style="display:flex; align-items:center; gap:12px; justify-content:center; flex-wrap:wrap;">
                                <button id="DCM-X" title="Share on X (Twitter)" style="background:#000; color:#fff; border:1px solid rgba(255,255,255,0.1); width:26px; height:26px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.8rem; transition:0.2s;">𝕏</button>
                                <button id="DCM-FB" title="Share on Facebook" style="background:#1877F2; color:#fff; border:none; width:26px; height:26px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.8rem; transition:0.2s;">f</button>
                                <button id="DCM-LI" title="Share on LinkedIn" style="background:#0077B5; color:#fff; border:none; width:26px; height:26px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.8rem; transition:0.2s;">in</button>
                                <button id="DCM-IG" title="Share on Instagram" style="background:linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); color:#fff; border:none; width:26px; height:26px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.8rem; transition:0.2s;">📸</button>
                            </div>
                        </div>

                        <!-- Auto Post Button -->
                        <div id="DCM-AUTO-POST-WRAP" style="padding: 12px 20px 24px;">
                            <button id="DCM-POST-ALL" style="width: 100%; padding: 12px; border-radius: 12px; background: linear-gradient(135deg, #7c6fff, #43d08a); border: none; color: #fff; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(124, 111, 255, 0.3); transition: 0.3s;">
                                🚀 1-Click Post to All Linked Profiles
                            </button>
                        </div>

                    </div> <!-- End DCM-SCROLL-VIEWPORT -->

                    <div id="DCM-RIBBON" class="modal-scroll-ribbon" style="top: 0; bottom: 0;">
                        <div id="DCM-THUMB" class="modal-scroll-thumb"></div>
                    </div>
                </div> <!-- End cm-scroll-container -->

            </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.title = document.getElementById('DCM-TITLE');
        this.body = document.getElementById('DCM-BODY');
        this.refreshBtn = document.getElementById('DCM-REFRESH');

        document.getElementById('DCM-CLOSE').onclick = () => this.hide();
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.hide(); };

        // Image Selection Handlers
        document.getElementById('DCM-TOGGLE-PHOTO').onclick = () => {
            this.withPhoto = !this.withPhoto;
            this.updatePhotoUI();
        };

        document.getElementById('DCM-AI-GENERATE').onclick = () => {
            this.showAiPhotoSelector();
        };

        document.getElementById('DCM-REMOVE-PHOTO').onclick = () => {
            this.selectedImage = null;
            this.updatePhotoUI();
            this.showFeedback("🗑️ Photo removed from post.");
        };

        document.getElementById('DCM-OPEN-GALLERY').onclick = () => {
            GalleryUI.show((url) => {
                this.selectedImage = url;
                this.updatePhotoUI();
            });
        };

        document.getElementById('DCM-UPLOAD-PHOTO').onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.showFeedback("⏳ Uploading high-quality photo...", 10000);
                    const formData = new FormData();
                    formData.append('photo', file);
                    
                    try {
                        const res = await fetch(getApiUrl('/api/upload-photo'), {
                            method: 'POST',
                            body: formData
                        });
                        const data = await res.json();
                        if (data.status === 'success') {
                            this.selectedImage = data.url;
                            this.updatePhotoUI();
                            this.showFeedback("✅ Photo uploaded & saved to Gallery!");
                        } else {
                            throw new Error(data.error || 'Upload failed');
                        }
                    } catch (err) {
                        console.error("Upload Error:", err);
                        this.showFeedback("❌ Upload failed. Please try a smaller image.");
                    }
                }
            };
            input.click();
        };

        document.getElementById('DCM-DOWNLOAD-BTN').onclick = () => {
            this.captureAndDownload();
        };

        const getShareText = () => this.variants[this.currentIndex] || (typeof _lastContentText !== 'undefined' ? _lastContentText : '');

        // Scroll handlers removed as we now use the Ribbon and native scroll viewport

        this.refreshBtn.onclick = () => {
            console.log("Next Variant clicked. Current index:", this.currentIndex, "Total:", this.variants.length);
            if (this.variants.length > 1) {
                this.currentIndex = (this.currentIndex + 1) % this.variants.length;
                this.updateContent(this._currentIsAi);
            } else {
                console.warn("Next Variant: Only one variant available.");
            }
        };

        // Modal Ribbon Sync
        const viewport = document.getElementById('DCM-SCROLL-VIEWPORT');
        const ribbon = document.getElementById('DCM-RIBBON');
        const thumb = document.getElementById('DCM-THUMB');
        
        if (viewport && ribbon && thumb) {
            const updateModalThumb = () => {
                const scrollHeight = viewport.scrollHeight - viewport.clientHeight;
                if (scrollHeight <= 5) { // Small buffer for rounding
                    ribbon.style.display = 'none';
                    return;
                }
                ribbon.style.display = 'block';
                const scrolled = (viewport.scrollTop / scrollHeight) * 100;
                // Move thumb
                const maxTop = ribbon.clientHeight - thumb.clientHeight;
                thumb.style.top = Math.max(0, Math.min(maxTop, (scrolled / 100) * maxTop)) + 'px';
            };

            viewport.addEventListener('scroll', updateModalThumb);
            
            // Click on ribbon to scroll
            ribbon.onclick = (e) => {
                const rect = ribbon.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const percentage = y / rect.height;
                viewport.scrollTop = percentage * (viewport.scrollHeight - viewport.clientHeight);
            };

            // Observer to handle content changes (includes image loading/visibility toggles)
            const observer = new MutationObserver(() => {
                setTimeout(updateModalThumb, 50); // Small delay to allow layout to settle
            });
            observer.observe(viewport, { childList: true, subtree: true, characterData: true, attributes: true });
            
            // Initial update
            setTimeout(updateModalThumb, 100);
        }

        // Social Button Handlers
        document.getElementById('DCM-X').onclick = () => this.startShareFlow('x');
        document.getElementById('DCM-FB').onclick = () => this.startShareFlow('fb');
        document.getElementById('DCM-LI').onclick = () => this.startShareFlow('li');
        document.getElementById('DCM-IG').onclick = () => this.startShareFlow('ig');

        // Link to profile nudge
        const nudgeLink = document.getElementById('DCM-LINK-PROFILES');
        if (nudgeLink) {
            nudgeLink.onclick = (e) => {
                e.preventDefault();
                this.hide();
                window.openProfileModal();
            };
        }

        // Post to All Logic
        const postAllBtn = document.getElementById('DCM-POST-ALL');
        if (postAllBtn) {
            postAllBtn.onclick = () => {
                const text = getShareText();
                if (!text) return;
                console.log("🚀 Post all clicked with text length:", text.length);
                const u = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
                const url = window.location.origin + window.location.pathname;
                
                // Identify selected sites based on profile checkboxes
                const selectedSites = [];
                if (u.xAuto) selectedSites.push({ id: 'X', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` });
                if (u.fbAuto) selectedSites.push({ id: 'FB', url: u.fbLink || `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}` });
                if (u.liAuto) selectedSites.push({ id: 'LI', url: u.liLink || `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` });
                if (u.igAuto) selectedSites.push({ id: 'IG', url: u.igLink || 'https://www.instagram.com/' });

                const fb = document.getElementById('DCM-FEEDBACK');
                
                if (selectedSites.length === 0) {
                    fb.innerHTML = `<span style="color:#ff9a9e; font-size:0.75rem;">⚠️ Go to Profile to Link to Social Sites for better understanding.</span>`;
                    fb.style.opacity = '1';
                    // Open profile modal if they click the link? No, the suggestion is enough.
                    setTimeout(() => fb.style.opacity = '0', 6000);
                    return;
                }

                // 1. Copy text first (essential for IG and manual pasting)
                navigator.clipboard.writeText(text);
                
                fb.innerHTML = `🚀 Launching ${selectedSites.length} tabs... <br><span style="font-size:0.7rem; color:#ff9a9e;">NOTE: Please <b>Allow Popups</b> in browser bar!</span>`;
                fb.style.opacity = '1';

                // 2. Open sharing intents sequentially
                let delay = 0;
                selectedSites.forEach(site => {
                    setTimeout(() => {
                        window.open(site.url, '_blank');
                    }, delay);
                    delay += 800;
                });

                setTimeout(() => {
                    fb.innerHTML = "🚀 Multi-Share launched! <br><span style='color:#43d08a;'>Content is in your Clipboard. <b>Paste (Ctrl+V)</b> in each site.</span>";
                    setTimeout(() => fb.style.opacity = '0', 8000);
                }, delay + 1000);
            };
        }
    },
    async captureAndDownload() {
        if (!this.selectedImage || !this.body) return;
        
        this.showFeedback("🎨 Generating card...");
        const text = this.variants[this.currentIndex] || "";
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
            // High Resolution Setup & Dynamic Aspect Ratio
            const naturalRatio = img.width / img.height;
            canvas.width = 1080;
            // Use image ratio if available, otherwise default to portrait 1080x1350
            canvas.height = Math.round(1080 / naturalRatio);
            
            // Limit height to prevent absurdly tall images (max 1920)
            if (canvas.height > 1920) canvas.height = 1920;
            // Ensure minimum height (min 1080)
            if (canvas.height < 1080) canvas.height = 1080;

            console.log("🎨 Canvas dimensions set to:", canvas.width, "x", canvas.height, "Ratio:", naturalRatio);
            
            // Background Image (Cover style)
            const canvasRatio = canvas.width / canvas.height;
            let drawW, drawH, drawX, drawY;
            if (naturalRatio > canvasRatio) {
                drawH = canvas.height;
                drawW = canvas.height * naturalRatio;
                drawX = (canvas.width - drawW) / 2;
                drawY = 0;
            } else {
                drawW = canvas.width;
                drawH = canvas.width / naturalRatio;
                drawX = 0;
                drawY = (canvas.height - drawH) / 2;
            }
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            
            // Overlay Gradient
            const grad = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height);
            grad.addColorStop(0, "rgba(10, 12, 30, 0)");
            grad.addColorStop(0.7, "rgba(10, 12, 30, 0.85)");
            grad.addColorStop(1, "rgba(10, 12, 30, 0.98)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // App Brand Line
            ctx.fillStyle = "#7c6fff";
            ctx.font = "800 24px 'Inter', sans-serif";
            ctx.fillText("IMPORTANT DAYS APP", 60, canvas.height - 60);

            // Awareness Text Rendering
            ctx.fillStyle = "#ffffff";
            ctx.font = "500 36px 'Inter', sans-serif";
            const maxWidth = canvas.width - 120;
            const lineHeight = 50;
            const x = 60;
            
            // Simple text wrapping (bottom-up)
            const lines = [];
            const paragraphs = text.split('\n');
            paragraphs.reverse().forEach(p => {
                if (!p.trim()) { lines.push(""); return; }
                const words = p.split(' ');
                let currentLine = "";
                const pLines = [];
                words.forEach(word => {
                    const testLine = currentLine + word + " ";
                    const metrics = ctx.measureText(testLine);
                    if (metrics.width > maxWidth && currentLine.length > 0) {
                        pLines.push(currentLine);
                        currentLine = word + " ";
                    } else {
                        currentLine = testLine;
                    }
                });
                pLines.push(currentLine);
                pLines.reverse().forEach(l => lines.push(l));
            });

            // Calculate starting Y to draw lines upwards from bottom
            let y = canvas.height - 140;
            lines.slice(0, 18).forEach(line => {
                ctx.fillText(line.trim(), x, y);
                y -= lineHeight;
            });

            // Download trigger
            try {
                const dataUrl = canvas.toDataURL("image/png");
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `ImportantDay_Post_${Date.now()}.png`;
                link.click();
                this.showFeedback("✅ Card Downloaded!");
            } catch (e) {
                console.error("Canvas export failed:", e);
                this.showFeedback("❌ Browser blocked image creation. Downloading photo only.");
                const link = document.createElement('a');
                link.href = getApiUrl(this.selectedImage);
                link.download = `Photo_${Date.now()}.jpg`;
                link.click();
            }
        };
        
        img.onerror = () => {
            this.showFeedback("❌ Failed to combine photo. Downloading separately.");
            const link = document.createElement('a');
            link.href = getApiUrl(this.selectedImage);
            link.download = `Photo_${Date.now()}.jpg`;
            link.click();
        };

        img.src = getApiUrl(this.selectedImage);
    },
    startShareFlow(platform) {
        const overlay = document.createElement('div');
        overlay.className = 'cm-share-prompt-overlay';
        overlay.innerHTML = `
            <div class="cm-share-prompt-card">
                <div class="cm-share-prompt-title">🖼️ Add a Photo?</div>
                <div class="cm-share-prompt-msg">Would you like to attach a high-quality photo card for this day or just the text?</div>
                <div class="cm-share-prompt-btns">
                    <button id="SPF-YES" class="cm-btn-download" style="margin:0; background:rgba(124,111,255,0.1); border-color:rgba(124,111,255,0.2); color:#a78bfa;">Yes, Choose Photo</button>
                    <button id="SPF-NO" class="cm-btn-secondary" style="justify-content:center;">No, Only Text</button>
                    <button id="SPF-CANCEL" style="background:transparent; border:none; color:#64748b; font-size:0.75rem; cursor:pointer; margin-top:5px;">Cancel</button>
                </div>
            </div>
        `;
        this.overlay.querySelector('div').appendChild(overlay);

        const close = () => overlay.remove();
        
        document.getElementById('SPF-CANCEL').onclick = close;
        
        document.getElementById('SPF-NO').onclick = () => {
            close();
            this.executeSocialShare(platform);
        };

        document.getElementById('SPF-YES').onclick = () => {
            close();
            this.showAiPhotoSelector(platform);
        };
    },
    showAiPhotoSelector(platform) {
        const title = this.title?.textContent || 'Important Day';
        const text = this.variants[this.currentIndex] || '';
        
        // Advanced Keyword Extraction
        const getEssenceKeywords = (t) => {
            const stops = new Set(['today', 'the', 'this', 'that', 'with', 'for', 'from', 'your', 'will', 'have', 'were', 'those', 'also', 'some', 'very', 'than', 'into', 'just', 'only', 'more', 'about', 'daily', 'global', 'india', 'celebration', 'celebrations', 'importance', 'awareness']);
            const dayWords = title.toLowerCase().split(/\s+/);
            const words = t.toLowerCase()
                .replace(/[^a-z\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3 && !stops.has(w) && !dayWords.includes(w));
            
            // Prioritize middle-of-text words which usually contain the 'meat'
            return [...new Set(words)].slice(0, 5).join(' ');
        };

        const essence = getEssenceKeywords(text);
        let providerIndex = 0;
        const providers = ['ai', 'real', 'picsum'];
        
        const generateUrl = (idx) => {
            const seed = Math.floor(Math.random() * 1000000);
            const type = providers[idx % providers.length];
            const w = this.aiDimensions.width;
            const h = this.aiDimensions.height;
            
            if (type === 'ai') {
                const styles = ['digital art, vibrant colors', 'cinematic lighting, masterpiece', 'minimalist vector style', 'highly detailed photography'];
                const style = styles[idx % styles.length];
                const prompt = `${title}: ${essence}, ${style}, high resolution, 8k, trending on artstation, no text, clean composition`;
                return `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
            } else if (type === 'real') {
                const prompt = `Realistic professional photography of a scene representing ${title} (${essence}), high resolution, 8k, award winning photo, national geographic style`;
                return `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
            } else {
                return `https://picsum.photos/seed/${seed}/${w}/${h}`;
            }
        };

        const overlay = document.createElement('div');
        overlay.className = 'ai-photo-selector-overlay';
        overlay.innerHTML = `
            <div class="ai-grid-header">
                <div class="premium-glow-text" style="font-size:1.1rem; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.4rem;">✨</span> AI PHOTO MASTER
                </div>
                <button id="AI-CLOSE" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; cursor:pointer; font-size:1.2rem; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:0.2s;">&times;</button>
            </div>

            <div class="ai-dim-row">
                <button class="ai-dim-btn ${this.aiDimensions.label === '2:3' ? 'active' : ''}" data-w="1080" data-h="1350" data-label="2:3">📐 2:3 (Port)</button>
                <button class="ai-dim-btn ${this.aiDimensions.label === '1:1' ? 'active' : ''}" data-w="1080" data-h="1080" data-label="1:1">⬜ 1:1 (Sq)</button>
                <button class="ai-dim-btn ${this.aiDimensions.label === '1024' ? 'active' : ''}" data-w="1024" data-h="1024" data-label="1024">🖼️ 1024px</button>
            </div>
            
            <div class="ai-single-preview" id="AI-PREVIEW-WRAP">
                <div class="cm-spinner" id="AI-SPINNER" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:32px; height:32px; border-width:3px; border-color:var(--accent-main) transparent var(--accent-main) transparent;"></div>
                <div id="AI-ERROR" class="ai-error-msg" style="display:none; text-align:center; padding:20px;">
                    <span style="font-size:2rem; display:block; margin-bottom:15px;">📉</span>
                    <p style="font-size:0.9rem; color:#94a3b8;">Generation limit reached or connection lost.<br>Try another variant or use gallery.</p>
                </div>
                <img id="AI-IMG" src="" style="opacity:0; transition:opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); display:none; border-radius:8px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            </div>
            
            <div style="display:flex; justify-content:center; margin-bottom:20px;">
                <button id="AI-TRY-ANOTHER" class="ai-try-another-btn">
                    <span>🔄</span> Generate Different Style
                </button>
            </div>
            
            <div class="ai-grid-footer">
                <button id="AI-USE-GALLERY" class="cm-btn-secondary" style="font-size:0.8rem; padding:12px 20px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);">📂 Open Gallery</button>
                <div style="flex-grow:1;"></div>
                <button id="AI-CONFIRM" class="cm-btn-download" style="font-size:0.9rem; padding:12px 28px; background:linear-gradient(135deg, #43d08a, #10b981); border:none; color:#fff; font-weight:800; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">Apply This Masterpiece</button>
            </div>
        `;
        this.overlay.querySelector('div').appendChild(overlay);

        const img = document.getElementById('AI-IMG');
        const spinner = document.getElementById('AI-SPINNER');
        const errorMsg = document.getElementById('AI-ERROR');

        const loadNextPhoto = () => {
            img.style.opacity = '0';
            img.style.display = 'none'; 
            spinner.style.display = 'block';
            errorMsg.style.display = 'none';
            const url = generateUrl(providerIndex);
            console.log(`🖼️ Loading Photo [${providers[providerIndex % providers.length]}]:`, url);
            img.src = url;
        };

        img.onload = () => {
            img.style.display = 'block';
            img.style.opacity = '1';
            spinner.style.display = 'none';
            errorMsg.style.display = 'none';
        };

        img.onerror = () => {
            console.warn(`❌ Failed for ${providers[providerIndex % providers.length]}. Trying next...`);
            providerIndex++;
            if (providerIndex < 5) {
                loadNextPhoto();
            } else {
                spinner.style.display = 'none';
                errorMsg.style.display = 'block';
            }
        };

        document.querySelectorAll('.ai-dim-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.ai-dim-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.aiDimensions = {
                    width: parseInt(btn.dataset.w),
                    height: parseInt(btn.dataset.h),
                    label: btn.dataset.label
                };
                console.log("📐 Dimension changed to:", this.aiDimensions.label, this.aiDimensions.width, "x", this.aiDimensions.height);
                providerIndex = 0; // Reset provider index for different dimension
                loadNextPhoto();
            };
        });

        loadNextPhoto();

        document.getElementById('AI-CLOSE').onclick = () => overlay.remove();
        
        document.getElementById('AI-USE-GALLERY').onclick = () => {
            overlay.remove();
            GalleryUI.show(async (url) => {
                this.selectedImage = url;
                this.updatePhotoUI();
                if (platform) {
                    await this.captureAndDownload();
                    setTimeout(() => this.executeSocialShare(platform), 2000);
                }
            });
        };

        document.getElementById('AI-CONFIRM').onclick = async () => {
            overlay.remove();
            this.selectedImage = img.src;
            this.updatePhotoUI();
            this.showFeedback("✨ AI Photo Applied!");
            if (platform) {
                await this.captureAndDownload();
                setTimeout(() => this.executeSocialShare(platform), 2500);
            }
        };
    },
    executeSocialShare(platform) {
        const text = this.variants[this.currentIndex] || (typeof _lastContentText !== 'undefined' ? _lastContentText : '');
        const url = window.location.origin + window.location.pathname;
        const u = JSON.parse(localStorage.getItem('importantDays_user') || '{}');

        // Always copy for convenience
        navigator.clipboard.writeText(text);

        let target = '';
        switch(platform) {
            case 'x':
                target = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                break;
            case 'fb':
                target = u.fbLink || `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
                break;
            case 'li':
                target = u.liLink || `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
                break;
            case 'ig':
                target = u.igLink || 'https://www.instagram.com/';
                break;
        }
        
        if (target) {
            window.open(target, '_blank');
            const msg = platform === 'x' ? "✨ Copied! Compose box opened." : "📋 Content Copied! Now Paste (Ctrl+V) in site.";
            this.showFeedback(msg);
        }
    },
    show(title, loading = true) {
        console.log("ContentUI: Showing modal for:", title);
        this.init();
        if (this.title) this.title.textContent = title;
        if (loading && this.body) {
            this.body.innerHTML = `<div style="text-align:center; padding:40px;"><div class="cm-spinner" style="margin:0 auto 15px;"></div><p style="opacity:0.6; font-size:0.9rem;">Fetching awareness content...</p></div>`;
            if (this.refreshBtn) this.refreshBtn.style.display = 'none';
        }
        if (this.overlay) {
            this.overlay.style.display = 'flex';
            console.log("ContentUI: Overlay style set to flex");
        } else {
            console.error("ContentUI: Overlay is missing!");
        }
    },
    updateContent(isAi = false) {
        if (this.variants.length > 0) {
            const text = this.variants[this.currentIndex];
            const aiBadge = isAi ? `<div style="display:inline-flex; align-items:center; gap:5px; background:rgba(124,111,255,0.15); color:#a78bfa; padding:5px 12px; border-radius:100px; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:16px; border:1px solid rgba(124,111,255,0.3); box-shadow: 0 0 20px rgba(124, 111, 255, 0.1);">
                <span style="font-size:0.9rem;">✨</span> AI CONTENT VARIANT <span style="background:rgba(124,111,255,0.2); padding:2px 8px; border-radius:10px; margin-left:6px; color:#fff;">${this.currentIndex + 1} / ${this.variants.length}</span>
            </div>` : '';
            
            this.body.innerHTML = `
                ${aiBadge}
                <div style="font-size:1.05rem; line-height:1.7; color:#f3f4f6; white-space:pre-wrap; font-family:'Inter', sans-serif;">${text}</div>
            `;
            
            // Auto-Copy to clipboard as requested
            if (text) {
                navigator.clipboard.writeText(text).then(() => {
                    this.showFeedback("✨ Content Auto-Copied!");
                }).catch(err => console.log("Auto-copy blocked by browser", err));
            }
            
            // Update Auto-Post visibility
            const u = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
            const hasAnyLink = (u.xLink || u.fbLink || u.liLink || u.igLink);
            // autoWrap is now always visible as per user's requirement to show the button
            const nudgeWrap = document.querySelector('#DCM-LINK-PROFILES')?.parentElement;
            
            if (nudgeWrap) {
                if (hasAnyLink) {
                    nudgeWrap.innerHTML = `✅ Profiles Linked! <a href="#" id="DCM-LINK-PROFILES" style="color:#7c6fff; text-decoration:none; border-bottom:1px dashed #7c6fff;">Update links</a> or use 🚀 below:`;
                } else {
                    nudgeWrap.innerHTML = `💡 Tip: <a href="#" id="DCM-LINK-PROFILES" style="color:#7c6fff; text-decoration:none; border-bottom:1px dashed #7c6fff;">Link social profiles</a> for easier sharing`;
                }
                // Re-bind click since we replaced innerHTML
                const newNudge = document.getElementById('DCM-LINK-PROFILES');
                if (newNudge) {
                    newNudge.onclick = (e) => {
                        e.preventDefault();
                        this.hide();
                        window.openProfileModal();
                    }
                }
            }

            if (this.refreshBtn) {
                const multi = this.variants.length > 1;
                this.refreshBtn.style.display = multi ? 'flex' : 'none';
                console.log("ContentUI: Variant button visible:", multi, "Count:", this.variants.length);
            }
            _lastContentText = text;
            this.updatePhotoUI();
        }
    },
    updatePhotoUI() {
        const section = document.getElementById('DCM-IMAGE-SECTION');
        const preview = document.getElementById('DCM-PREVIEW');
        const placeholder = document.getElementById('DCM-PREVIEW-PLACEHOLDER');
        const removeBtn = document.getElementById('DCM-REMOVE-PHOTO');
        const galleryBtn = document.getElementById('DCM-OPEN-GALLERY');
        const aiBtn = document.getElementById('DCM-AI-GENERATE');
        const uploadBtn = document.getElementById('DCM-UPLOAD-PHOTO');
        const toggleIcon = document.getElementById('DCM-PHOTO-ICON');
        const toggleText = document.getElementById('DCM-PHOTO-TEXT');
        const downloadWrap = document.getElementById('DCM-DOWNLOAD-WRAP');

        if (!section || !preview || !placeholder || !removeBtn || !galleryBtn || !aiBtn || !uploadBtn || !toggleIcon || !toggleText || !downloadWrap) {
            console.warn("ContentUI: Some photo UI elements missing from DOM");
            return;
        }

        if (this.withPhoto) {
            section.style.display = 'block';
            aiBtn.style.display = 'flex';
            galleryBtn.style.display = 'flex';
            uploadBtn.style.display = 'flex';
            toggleIcon.textContent = '🖼️';
            toggleText.textContent = 'With Photo';
            
            if (this.selectedImage) {
                preview.src = getApiUrl(this.selectedImage);
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                downloadWrap.style.display = 'block';
                removeBtn.style.display = 'flex';
            } else {
                preview.style.display = 'none';
                placeholder.style.display = 'block';
                downloadWrap.style.display = 'none';
                removeBtn.style.display = 'none';
            }
        } else {
            section.style.display = 'none';
            galleryBtn.style.display = 'none';
            uploadBtn.style.display = 'none';
            removeBtn.style.display = 'none';
            toggleIcon.textContent = '🚫';
            toggleText.textContent = 'No Photo';
            downloadWrap.style.display = 'none';
        }
    },
    showFeedback(msg, duration = 4000) {
        const fb = document.getElementById('DCM-FEEDBACK');
        if (fb) {
            fb.innerHTML = msg;
            fb.style.opacity = '1';
            if (this._fbTimeout) clearTimeout(this._fbTimeout);
            this._fbTimeout = setTimeout(() => fb.style.opacity = '0', duration);
        }
    },
    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
};

let _lastContentText = '';

function buildHashtags(ev) {
    const base = [
        '#' + ev.name.replace(/[^a-zA-Z0-9]/g, ''),
        '#' + ev.category.replace(/[^a-zA-Z0-9]/g, ''),
        '#ImportantDays',
        '#Awareness',
    ];
    if (ev.category === 'Festival' || ev.category === 'Religious') base.push('#Celebration');
    if (ev.category === 'Health') base.push('#HealthAwareness');
    if (ev.category === 'Environment') base.push('#EcoAwareness');
    if (ev.category === 'India-National') base.push('#India', '#ProudIndian');
    return [...new Set(base)].slice(0, 5);
}

function buildCTA(ev) {
    const ctas = {
        'Health': '💙 Take one healthy step today — your body will thank you. Share to inspire someone you love!',
        'Environment': '🌱 Our planet needs us now. Pledge one green action and share to inspire others!',
        'India-National': '🇮🇳 Proud to be Indian! Share this with every patriot in your circle.',
        'Festival': '🎉 Spread the joy! Tag a friend you\'d love to celebrate this with.',
        'Religious': '🙏 Let peace and blessings reach everyone today. Share the spirit!',
        'International': '🌍 Awareness starts with you. Share this to make a global impact!',
        'World-Day': '🤝 One share can reach thousands. Be the voice this cause deserves!',
        'Cultural': '🎨 Celebrate culture\'s richness — share and keep traditions alive!',
        'Science-Tech': '🚀 Knowledge is power. Share this and spark curiosity in your network!',
        'Human-Rights': '✊ Stand up for what\'s right. Share to amplify this important cause.',
        'Education': '📚 Education transforms lives. Share this to champion learning today!',
    };
    const key = ev.category.replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');
    return ctas[key] || '✨ Share this moment and help spread the word — every share matters!';
}

function trimTo50Words(text) {
    const words = text.trim().split(/\s+/);
    if (words.length <= 50) return text.trim();
    return words.slice(0, 50).join(' ') + '…';
}

async function fetchWikiSummary(name) {
    const slug = encodeURIComponent(name.replace(/\s+/g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data = await res.json();
        return data.extract || null;
    } catch {
        return null;
    }
}

// ── Subscription gate helpers ────────────────────────
function isUserSubscribed() {
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    const subKey = user.phone ? `importantDays_subscription_${user.phone}` : 'importantDays_subscription';
    const sub = JSON.parse(localStorage.getItem(subKey) || 'null');
    const approvedSubs = JSON.parse(localStorage.getItem('importantDays_approvedSubs') || '{}');
    const now = new Date();

    // Admin-approved
    if (user.phone && approvedSubs[user.phone]) return true;

    // Active paid subscription
    if (sub && sub.status === 'active' && new Date(sub.expiry) > now) return true;

    // Still in 10-day trial
    if (user.createdAt) {
        const diffDays = Math.ceil(Math.abs(now - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
        if (diffDays <= 10) return true;
    }

    return false;
}

function isPaidSubscriber() {
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    const subKey = user.phone ? `importantDays_subscription_${user.phone}` : 'importantDays_subscription';
    const sub = JSON.parse(localStorage.getItem(subKey) || 'null');
    const approvedSubs = JSON.parse(localStorage.getItem('importantDays_approvedSubs') || '{}');
    const now = new Date();

    if (user.phone && approvedSubs[user.phone]) return true;
    if (sub && sub.status === 'active' && new Date(sub.expiry) > now) return true;

    return false;
}

// ── Subscribe Gate Modal (full-screen, for expired users) ──
function showSubscribeFlash() {
    const existing = document.getElementById('subscribe-gate-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'subscribe-gate-modal';
    overlay.innerHTML = `
      <div class="sgm-box">
        <div class="sgm-icon">🔒</div>
        <h3 class="sgm-title">Unlock Full Content</h3>
        <p class="sgm-desc">
          Your <strong>free trial has ended</strong>.<br>
          Subscribe now to get rich daily content, hashtags &amp; social post copy for every celebration!
        </p>
        <div class="sgm-features">
          <span>📝 Daily Content</span>
          <span>🔖 Hashtags</span>
          <span>📋 Copy &amp; Share</span>
        </div>
        <button class="sgm-subscribe-btn" id="sgm-subscribe-btn">
          💎 Subscribe Now — Click Here!
        </button>
        <button onclick="confirmSubscription()" class="pay-submit-btn">
          🔒 Submit UTR &amp; Activate
        </button>
        <button class="sgm-cancel-btn" id="sgm-cancel-btn">Maybe Later</button>
      </div>
    `;
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:99998',
        'background:rgba(10,12,30,0.88)', 'backdrop-filter:blur(8px)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:20px', 'animation:sgmFadeIn 0.25s ease'
    ].join(';');
    document.body.appendChild(overlay);

    document.getElementById('sgm-subscribe-btn').addEventListener('click', () => {
        overlay.remove();
        showSubscriptionModal(false);
    });
    document.getElementById('sgm-cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const escH = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escH); } };
    document.addEventListener('keydown', escH);
}

// ── Subscribe Snackbar (bottom toast, for trial users — instant upsell) ──
function showSubscribeSnackbar() {
    const existing = document.getElementById('sub-snackbar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'sub-snackbar';
    bar.innerHTML = `
      <span class="snk-dot"></span>
      <span class="snk-msg">💎 <strong>Subscribe</strong> for unlimited content access!</span>
      <button class="snk-btn" id="snk-sub-btn">Subscribe Now</button>
      <button class="snk-close" id="snk-close-btn" aria-label="Close">✕</button>
    `;
    bar.style.cssText = [
        'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
        'z-index:99997', 'display:flex', 'align-items:center', 'gap:10px',
        'background:linear-gradient(135deg,#1e1b4b,#2d1b4e)',
        'border:1.5px solid rgba(124,111,255,0.5)',
        'color:#fff', 'border-radius:50px', 'padding:10px 16px 10px 14px',
        'box-shadow:0 8px 36px rgba(124,111,255,0.45)',
        'font-size:0.86rem', 'font-weight:600',
        'animation:snkSlideUp 0.4s cubic-bezier(.22,1.4,.36,1)',
        'max-width:92vw', 'white-space:nowrap'
    ].join(';');
    document.body.appendChild(bar);

    document.getElementById('snk-sub-btn').addEventListener('click', () => {
        bar.remove();
        showSubscriptionModal(false);
    });
    document.getElementById('snk-close-btn').addEventListener('click', () => bar.remove());

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
        bar.style.transition = 'opacity 0.4s, transform 0.4s';
        bar.style.opacity = '0';
        bar.style.transform = 'translateX(-50%) translateY(12px)';
        setTimeout(() => bar.remove(), 400);
    }, 6000);
}


async function openContentModal(mmdd, eventName, category) {
    console.log("openContentModal called with:", mmdd, eventName);
    if (!mmdd) return;

    const events = importantDays.filter(d => d.date === mmdd);
    if (!events.length) {
        console.warn("No events found for date:", mmdd);
        return;
    }

    // Unescape eventName if it came from HTML
    const unescapedName = eventName ? eventName.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : null;

    let ev = null;
    if (unescapedName) {
        const target = unescapedName.trim().toLowerCase();
        ev = events.find(d => d.name.trim().toLowerCase() === target);
        
        // Final fallback: partial match
        if (!ev) {
            ev = events.find(d => d.name.toLowerCase().includes(target) || target.includes(d.name.toLowerCase()));
        }
    }
    
    if (!ev) ev = events[0];

    console.log("Found event:", ev.name);

    // Force-close subscription modal if open
    document.getElementById('fixed-sub-modal')?.setAttribute('hidden', '');

    // Trial Expiration Restriction Logic
    if (!isUserSubscribed()) {
        const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
        const regDate = new Date(user.createdAt || new Date());
        const diffDays = Math.ceil(Math.abs(new Date() - regDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 10) {
            ContentUI.show(ev.name, false); 
            ContentUI.body.innerHTML = `
                <div style="text-align:center; padding:40px 20px;">
                    <div style="font-size:3rem; margin-bottom:20px;">🔒</div>
                    <div class="blink-text" style="font-size:1.1rem; line-height:1.6; margin-bottom:30px; text-transform:uppercase;">
                        FREE TRAIL PERIOD IS OVER.<br>DO SUBSCRIBE FOR CONTENT EXTRACTION AND POSTING
                    </div>
                    <button onclick="showSubscriptionModal()" style="background:linear-gradient(135deg, #7c6fff, #43d08a); color:#fff; border:none; padding:14px 30px; border-radius:12px; font-weight:800; font-size:1rem; cursor:pointer; box-shadow:0 10px 20px rgba(124,111,255,0.3); width:100%;">
                        💎 Subscribe Now — Get Access!
                    </button>
                    <p style="margin-top:20px; font-size:0.85rem; color:#9ca3af; opacity:0.8;">
                        Keep your social presence alive with premium awareness content.
                    </p>
                </div>
            `;
            // Hide premium UI elements
            if (ContentUI.refreshBtn) ContentUI.refreshBtn.style.display = 'none';
            document.getElementById('DCM-X')?.parentElement?.style.setProperty('display', 'none', 'important');
            document.getElementById('DCM-AUTO-POST-WRAP')?.style.setProperty('display', 'none', 'important');
            return;
        }
    }

    ContentUI.variants = [];
    ContentUI.currentIndex = 0;
    ContentUI.show(ev.name, true);

    try {
        let tags, cta;
        let backendOk = false;

        ContentUI._currentIsAi = false; // Reset to false

        try {
            const apiPath = `/api/content?date=${mmdd}&name=${encodeURIComponent(ev.name)}&category=${encodeURIComponent(category || ev.category)}`;
            
            // No longer need the manual protocol check here as getApiUrl handles it
            const response = await fetch(getApiUrl(apiPath));
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.variants && data.variants.length > 0) {
                    ContentUI.variants = data.variants;
                    ContentUI._currentIsAi = data.isAi || false;
                    tags = data.hashtags || buildHashtags(ev).join(' ');
                    cta = data.cta || buildCTA(ev);
                    backendOk = true;
                }
            } else if (response.status === 503) {
                console.warn("Backend DB disconnected, but server is up.");
                // We'll proceed to fallback logic below but maybe show a subtle hint
                this.showFeedback("💡 Using offline cached knowledge (DB disconnected)");
            }
        } catch (beErr) { console.warn("Backend fail:", beErr); }

        if (!backendOk) {
            console.log("Backend failed or no variants, falling back to local wikipedia fetch");
            const wikiText = await fetchWikiSummary(ev.name);
            const rawText = wikiText || ev.description;
            ContentUI.variants = [trimToWords(rawText, 50, 70)];
            tags = buildHashtags(ev).join(' ');
            cta = buildCTA(ev);
        }

        // Add hashtags and CTA to variants
        ContentUI.variants = ContentUI.variants.map(v => {
            return `${ev.emoji} ${v}\n\n${cta}\n\n${tags}`;
        });

        ContentUI.updateContent(ContentUI._currentIsAi);

    } catch (err) {
        console.error("openContentModal fail:", err);
        ContentUI.body.innerHTML = `
          <div style="text-align:center; padding:30px; color:#f87171;">
            <span style="font-size:2rem;">⚠️</span>
            <p style="margin-top:10px;">Content extraction failed. Please try again later.</p>
          </div>`;
    }
}

function trimToWords(text, min, max) {
    if (!text) return "";
    const words = text.trim().split(/\s+/);
    if (words.length < min) return text.trim();
    if (words.length > max) return words.slice(0, max).join(' ') + '…';
    return text.trim();
}

async function fetchWikiSummary(name) {
    try {
        const slug = encodeURIComponent(name.replace(/ /g, '_'));
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.extract;
    } catch (e) {
        console.warn('Wiki fetch error', e);
        return null;
    }
}

// ── Content Modal Legacy cleanup ────────────────
// All interactions are now handled via ContentUI object.
// ── Subscription Actions ──────────────────
const UPI_ID = '8878923337@ybl';
const UPI_NAME = 'Important Days App';

window.initiatePayment = function (amount, type) {
    const note = `Subscription-${type}`;
    const label = type === 'monthly' ? `Monthly \u2013 \u20b9${amount}` : `Annual \u2013 \u20b9${amount}`;
    const upiParams = `pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    const genericUpi = `upi://pay?${upiParams}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(genericUpi)}&color=0b0e1a&bgcolor=ffffff`;

    // Populate UI
    document.getElementById('upi-qr-img').src = qrUrl;
    document.getElementById('pay-plan-label').textContent = label;
    document.getElementById('txn-id').value = '';

    // Add Deep Link Buttons for Mobile Users with Premium Styling
    const upiAppButtons = `
        <style>
            .upi-app-btn { transition: all 0.3s ease; border: 1px solid rgba(255,255,255,0.1) !important; background: rgba(255,255,255,0.05) !important; color: white !important; }
            .upi-app-btn:hover { transform: translateY(-3px); background: rgba(255,255,255,0.1) !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); border-color: var(--accent-main) !important; }
            .gpay-btn:hover { color: #4285f4 !important; }
            .phonepe-btn:hover { color: #5f259f !important; }
            .paytm-btn:hover { color: #00b9f1 !important; }
        </style>
        <div class="upi-app-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
            <a href="googlepay://pay?${upiParams}" class="upi-app-btn gpay-btn" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; border-radius:16px; font-weight:700; font-size:0.9rem;">
                <img src="https://www.gstatic.com/images/branding/product/1x/gpay_512dp.png" width="20" height="20"> GPay
            </a>
            <a href="phonepe://pay?${upiParams}" class="upi-app-btn phonepe-btn" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; border-radius:16px; font-weight:700; font-size:0.9rem;">
                <img src="https://vignette.wikia.nocookie.net/logopedia/images/e/e3/PhonePe_Logo.png/revision/latest?cb=20200325173007" width="20" height="20"> PhonePe
            </a>
            <a href="paytmmp://pay?${upiParams}" class="upi-app-btn paytm-btn" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; border-radius:16px; font-weight:700; font-size:0.9rem;">
                <img src="https://logodix.com/logo/1818161.png" width="20" height="20"> Paytm
            </a>
            <a href="${genericUpi}" class="upi-app-btn other-upi-btn" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; border-radius:16px; font-weight:700; font-size:0.9rem;">
                 <span style="font-size:1.1rem;">⚡</span> Other UPI
            </a>
        </div>
        <p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; margin-bottom:20px; opacity:0.8;">Tap an app to open it with the details pre-filled.</p>
    `;

    // Target the specific area before the UTR input
    let upiActions = document.getElementById('upi-app-actions');
    if (!upiActions) {
        upiActions = document.createElement('div');
        upiActions.id = 'upi-app-actions';
        const qrContainer = document.querySelector('.pay-qr-container');
        if (qrContainer) qrContainer.parentNode.insertBefore(upiActions, qrContainer.nextSibling);
    }
    upiActions.innerHTML = upiAppButtons;

    // Hide plan grid, show payment gateway
    document.querySelector('.sub-plans-grid').style.display = 'none';
    const introEl = document.querySelector('.sub-intro');
    if (introEl) introEl.style.display = 'none';
    document.getElementById('upi-section').style.display = 'block';
    
    window.pendingSub = { type, amount };
};

window.closePayGateway = function () {
    document.getElementById('upi-section').style.display = 'none';
    document.querySelector('.sub-plans-grid').style.display = 'grid';
    document.querySelector('.sub-intro').style.display = 'block';
};

window.copyUpiId = function () {
    navigator.clipboard.writeText(UPI_ID).then(() => {
        const fb = document.getElementById('upi-copy-feedback');
        fb.textContent = '✅ Copied!';
        setTimeout(() => { fb.textContent = ''; }, 2000);
    });
};

window.confirmSubscription = async function () {
    if (!window.pendingSub) return;

    const btn = document.querySelector('#upi-section .pay-submit-btn');
    const txnId = document.getElementById('txn-id').value.trim();
    // Validate 12-digit UTR
    const utrRegex = /^\d{12}$/;
    if (!utrRegex.test(txnId)) {
        alert("⚠️ Please enter a valid 12-digit UTR / Reference number.");
        document.getElementById('txn-id').focus();
        document.getElementById('txn-id').style.borderColor = '#f72585';
        setTimeout(() => { document.getElementById('txn-id').style.borderColor = ''; }, 3000);
        return;
    }

    const originalBtnText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⌛ Saving Transaction...";

    const now = new Date();
    let expiry = new Date();
    if (window.pendingSub.type === 'monthly') expiry.setDate(now.getDate() + 30);
    else expiry.setFullYear(now.getFullYear() + 1);

    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    const subData = {
        type: window.pendingSub.type,
        expiry: expiry.toISOString(),
        status: 'pending',
        paidAt: now.toISOString(),
        txnId: txnId,
        mobile: user.phone || 'Unknown',
        email: user.email || '',
        userName: user.name || 'User',
        amount: window.pendingSub.amount
    };

    try {
        // 1. SAVE TO BACKEND FIRST (AWAIT SUCCESS)
        const response = await fetch(getApiUrl('/api/notify-payment'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subData)
        });

        if (response.ok) {
            // 2. SYNC TO LOCAL ONLY AFTER BACKEND CONFIRMS
            const subKey = user.phone ? `importantDays_subscription_${user.phone}` : 'importantDays_subscription';
            localStorage.setItem(subKey, JSON.stringify(subData));

            const ledger = JSON.parse(localStorage.getItem('importantDays_paymentLedger') || '[]');
            ledger.push(subData);
            localStorage.setItem('importantDays_paymentLedger', JSON.stringify(ledger));

            // 3. SHOW SUCCESS UI
            document.getElementById('upi-section').innerHTML = `
                <div class="pay-success">
                    <div class="pay-success-icon">🎉</div>
                    <div class="pay-success-title">UTR Submitted Successfully!</div>
                    <p class="pay-success-msg">Your transaction is now <strong>Pending Approval</strong>.<br>
                    Activation usually takes less than 24 hours.</p>
                    <div style="margin: 16px 0; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 12px; font-size: 0.8rem; color: #10b981;">
                        UTR: <strong>${txnId}</strong><br>
                        Confirmation email will be sent within 5 mins.
                    </div>
                    <button onclick="document.getElementById('fixed-sub-modal').hidden=true; window.location.reload();"
                        class="pay-submit-btn">Close & Continue</button>
                </div>`;

            // 4. WhatsApp Backup Notification
            const waMsg = `Hello Admin, New Payment Received!%0AUser: ${user.name}%0APhone: ${user.phone}%0APlan: ${window.pendingSub.type.toUpperCase()}%0AAmount: ₹${window.pendingSub.amount}%0AUTR: ${txnId}%0APlease approve.`;
            window.open(`https://wa.me/918878923337?text=${waMsg}`, '_blank');
        } else {
            throw new Error("Server rejected the payment data.");
        }
    } catch (err) {
        console.error("Payment notification failed", err);
        alert("⚠️ Connection Error. Your payment info was NOT saved on the server. Please check your internet and click 'Confirm Payment' again.");
        btn.disabled = false;
        btn.textContent = originalBtnText;
    }
};

// ── Pincode → State Auto-Fill (Profile Modal) ──
window.profPincodeChange = function(val) {
    val = val.replace(/\D/g, '');
    if (val.length === 6) {
        const prefix = parseInt(val.substring(0, 2), 10);
        let state = '';
        if (prefix === 11) state = 'Delhi';
        else if (prefix >= 12 && prefix <= 13) state = 'Haryana';
        else if (prefix >= 14 && prefix <= 15) state = 'Punjab';
        else if (prefix === 16) state = 'Chandigarh';
        else if (prefix === 17) state = 'Himachal Pradesh';
        else if (prefix >= 18 && prefix <= 19) state = 'Jammu & Kashmir';
        else if (prefix >= 20 && prefix <= 28) state = 'Uttar Pradesh';
        else if (prefix >= 30 && prefix <= 34) state = 'Rajasthan';
        else if (prefix >= 36 && prefix <= 39) state = 'Gujarat';
        else if (prefix >= 40 && prefix <= 44) state = 'Maharashtra';
        else if (prefix >= 45 && prefix <= 48) state = 'Madhya Pradesh';
        else if (prefix === 49) state = 'Chhattisgarh';
        else if (prefix >= 50 && prefix <= 53) state = 'Andhra Pradesh / Telangana';
        else if (prefix >= 56 && prefix <= 59) state = 'Karnataka';
        else if (prefix >= 60 && prefix <= 64) state = 'Tamil Nadu';
        else if (prefix >= 67 && prefix <= 69) state = 'Kerala';
        else if (prefix >= 70 && prefix <= 74) state = 'West Bengal';
        else if (prefix >= 75 && prefix <= 77) state = 'Odisha';
        else if (prefix === 78) state = 'Assam';
        else if (prefix === 79) state = 'North East';
        else if (prefix >= 80 && prefix <= 85) state = 'Bihar / Jharkhand';
        if (state) {
            const el = document.getElementById('prof-state');
            if (el) el.value = state;
        }
    }
};

// ── Profile Management ────────────────────────
window.openProfileModal = function() {
    console.log("Global openProfileModal called with fixed IDs");
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    if (!user.phone) {
        alert("Please login first.");
        return;
    }

    const profModal = document.getElementById('fixed-profile-modal');
    if (!profModal) {
        console.error("Fixed profile modal not found!");
        return;
    }

    document.getElementById('prof-phone').value = user.phone;
    document.getElementById('prof-name').value = user.name || '';
    document.getElementById('prof-email').value = user.email || '';
    document.getElementById('prof-address').value = user.address || '';
    if (document.getElementById('prof-city')) document.getElementById('prof-city').value = user.city || '';
    document.getElementById('prof-pin').value = user.pincode || '';
    if (document.getElementById('prof-state')) document.getElementById('prof-state').value = user.state || '';

    // Social Links & Toggles
    if (document.getElementById('prof-x-link')) document.getElementById('prof-x-link').value = user.xLink || '';
    if (document.getElementById('prof-x-auto')) document.getElementById('prof-x-auto').checked = user.xAuto === true;
    
    if (document.getElementById('prof-fb-link')) document.getElementById('prof-fb-link').value = user.fbLink || '';
    if (document.getElementById('prof-fb-auto')) document.getElementById('prof-fb-auto').checked = user.fbAuto === true;

    if (document.getElementById('prof-li-link')) document.getElementById('prof-li-link').value = user.liLink || '';
    if (document.getElementById('prof-li-auto')) document.getElementById('prof-li-auto').checked = user.liAuto === true;

    if (document.getElementById('prof-ig-link')) document.getElementById('prof-ig-link').value = user.igLink || '';
    if (document.getElementById('prof-ig-auto')) document.getElementById('prof-ig-auto').checked = user.igAuto === true;

    // Load Payment History
    updatePaymentHistoryUI();

    if (document.getElementById('prof-show-teaser')) {
        document.getElementById('prof-show-teaser').checked = user.showTeaser !== false;
    }

    // Payment Status in Profile
    const statusDiv = document.getElementById('profile-pay-status');
    if (statusDiv) {
        const subKey = user.phone ? `importantDays_subscription_${user.phone}` : 'importantDays_subscription';
        const sub = JSON.parse(localStorage.getItem(subKey) || 'null');
        const regDate = new Date(user.createdAt || new Date());
        const diffDays = Math.ceil(Math.abs(new Date() - regDate) / (1000 * 60 * 60 * 24));
        const remaining = Math.max(0, 10 - diffDays);

        if (sub?.status === 'active') {
            statusDiv.textContent = '💎 PRO Multi-Site';
            statusDiv.style.color = '#10b981';
        } else if (sub?.status === 'pending') {
            statusDiv.textContent = '⏳ Payment Pending Approval';
            statusDiv.style.color = '#f59e0b';
        } else if (remaining > 0) {
            statusDiv.textContent = `🎁 Trial - ${remaining} days left`;
            statusDiv.style.color = '#3b82f6';
        } else {
            statusDiv.textContent = '🔒 Expired - Upgrade needed';
            statusDiv.style.color = '#ef4444';
        }
    }

    profModal.hidden = false;
    document.getElementById('prof-msg').textContent = '';
};

document.getElementById('profile-close-btn')?.addEventListener('click', () => {
    document.getElementById('fixed-profile-modal').hidden = true;
});

document.getElementById('prof-save-btn')?.addEventListener('click', () => {
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    if (!user.phone) return;

    user.name = document.getElementById('prof-name').value.trim();
    user.email = document.getElementById('prof-email').value.trim();
    user.address = document.getElementById('prof-address').value.trim();
    if (document.getElementById('prof-city')) user.city = document.getElementById('prof-city').value.trim();
    user.pincode = document.getElementById('prof-pin').value.trim();
    // Cannot edit offline-calculated state, so we pass it through unchanged

    // New social links & toggles
    user.xLink = document.getElementById('prof-x-link')?.value.trim() || '';
    user.xAuto = document.getElementById('prof-x-auto')?.checked || false;

    user.fbLink = document.getElementById('prof-fb-link')?.value.trim() || '';
    user.fbAuto = document.getElementById('prof-fb-auto')?.checked || false;

    user.liLink = document.getElementById('prof-li-link')?.value.trim() || '';
    user.liAuto = document.getElementById('prof-li-auto')?.checked || false;

    user.igLink = document.getElementById('prof-ig-link')?.value.trim() || '';
    user.igAuto = document.getElementById('prof-ig-auto')?.checked || false;
    user.showTeaser = document.getElementById('prof-show-teaser')?.checked ?? true;

    if (!user.name) {
        alert("Name is required.");
        return;
    }

    localStorage.setItem('importantDays_user', JSON.stringify(user));
    
    // Update allUsers db
    const allUsers = JSON.parse(localStorage.getItem('importantDays_allUsers') || '[]');
    const idx = allUsers.findIndex(u => u.phone === user.phone);
    if (idx !== -1) {
        allUsers[idx] = { ...allUsers[idx], ...user };
        localStorage.setItem('importantDays_allUsers', JSON.stringify(allUsers));
    }

    // Sync to Server
    fetch(getApiUrl('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    }).catch(() => {});

    const msg = document.getElementById('prof-msg');
    if (msg) {
        msg.textContent = '✅ Profile saved! Redirecting...';
        msg.style.color = '#43d08a';
    }
    setTimeout(() => {
        window.location.replace('landing.html');
    }, 1200);
});

document.getElementById('prof-reset-pwd-btn')?.addEventListener('click', () => {
    const newPwd = prompt("Enter your new password (min 4 chars):");
    if (!newPwd || newPwd.length < 4) return alert("Invalid password.");

    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    const allUsers = JSON.parse(localStorage.getItem('importantDays_allUsers') || '[]');
    const idx = allUsers.findIndex(u => u.phone === user.phone);
    if (idx !== -1) {
        allUsers[idx].password = newPwd;
        localStorage.setItem('importantDays_allUsers', JSON.stringify(allUsers));
    }
    // Sync to server - NO OTP REQUIRED FOR LOGGED IN USER
    fetch(getApiUrl('/api/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, newPassword: newPwd })
    }).then(res => res.json()).then(data => {
        if (data.status === 'success') {
            alert("Password updated! Please log in again.");
            localStorage.removeItem('importantDays_session_active');
            localStorage.removeItem('importantDays_user');
            window.location.replace('login.html');
        } else {
            alert("Password update failed: " + (data.message || "Unknown error"));
        }
    }).catch(err => {
        console.error("Reset error", err);
        alert("Connection error. Could not update password.");
    });
});

// ── Payment History & Receipt Logic ────────────────
window.updatePaymentHistoryUI = function() {
    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    const container = document.getElementById('prof-payment-list');
    if (!container || !user.phone) return;

    // We check local ledger first, then can potentially fetch from server if needed
    const ledger = JSON.parse(localStorage.getItem('importantDays_paymentLedger') || '[]');
    const userPayments = ledger.filter(p => normPhone(p.mobile) === normPhone(user.phone));

    if (userPayments.length === 0) {
        container.innerHTML = `<p style="font-size:0.75rem; color:var(--text-secondary); opacity:0.6; text-align:center; padding:10px;">No payment history found.</p>`;
        return;
    }

    container.innerHTML = userPayments.reverse().map(p => {
        const dateStr = new Date(p.paidAt || Date.now()).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
        const statusClass = `badge-${p.status || 'pending'}`;
        const canPrint = p.status === 'approved' || p.status === 'active';
        
        return `
            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                <div>
                    <div style="font-size:0.8rem; font-weight:600; color:#fff;">${(p.type||'plan').toUpperCase()} - ₹${p.amount}</div>
                    <div style="font-size:0.65rem; color:var(--text-secondary);">${dateStr} • UTR: ${(p.txnId || 'N/A').substring(0,8)}...</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="welcome-badge ${statusClass}" style="margin:0; padding:2px 8px; font-size:0.6rem;">${(p.status||'pending').toUpperCase()}</span>
                    ${canPrint ? `<button onclick="viewReceipt('${p.txnId}')" style="background:none; border:none; color:var(--accent-main); cursor:pointer; font-size:0.7rem; font-weight:700; text-decoration:underline;">Receipt 📄</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
};

window.viewReceipt = function(txnId) {
    const ledger = JSON.parse(localStorage.getItem('importantDays_paymentLedger') || '[]');
    const p = ledger.find(pay => pay.txnId === txnId);
    if (!p) return;

    const user = JSON.parse(localStorage.getItem('importantDays_user') || '{}');
    
    // Populate receipt template
    document.getElementById('r-no').textContent = `REC-${p.txnId.substring(0,8).toUpperCase()}`;
    document.getElementById('r-date').textContent = new Date(p.paidAt || Date.now()).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    document.getElementById('r-name').textContent = user.name || 'Valued Subscriber';
    document.getElementById('r-phone').textContent = user.phone;
    document.getElementById('r-desc').textContent = `${(p.type||'subscription').toUpperCase()} Subscription - Important Days App`;
    document.getElementById('r-amount').textContent = p.amount;

    // Trigger Print
    window.print();
};

// ── Side Scroll Ribbon Logic ──────────────────
(function initScrollRibbon() {
    const ribbon = document.getElementById('scroll-ribbon');
    const thumb = document.getElementById('scroll-thumb');
    if (!ribbon || !thumb) return;

    function updateThumb() {
        const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        if (height <= 0) {
            ribbon.style.display = 'none';
            return;
        }
        ribbon.style.display = 'block';
        const scrolled = (winScroll / height) * 100;
        
        const ribbonHeight = ribbon.clientHeight;
        const thumbHeight = 30; // Min thumb height
        const maxTop = ribbonHeight - thumbHeight;
        
        const topPos = (scrolled / 100) * maxTop;
        thumb.style.top = Math.max(0, Math.min(topPos, maxTop)) + 'px';
    }

    window.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);
    
    // Initial call
    setTimeout(updateThumb, 500);

    // Click to scroll logic
    ribbon.addEventListener('click', (e) => {
        const rect = ribbon.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const percentage = y / rect.height;
        const targetScroll = percentage * (document.documentElement.scrollHeight - document.documentElement.clientHeight);
        
        window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    });
})();

// ── Category Chips Scroll Hint ──────────────────
(function initChipsScrollHint() {
    const wrap = document.getElementById('category-chips');
    if (!wrap) return;

    // Add hint element if it doesn't exist
    let hint = wrap.parentElement.querySelector('.chips-scroll-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.className = 'chips-scroll-hint';
        wrap.parentElement.appendChild(hint);
    }

    function checkScroll() {
        const hasScroll = wrap.scrollWidth > wrap.clientWidth;
        const isAtEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 10;
        hint.style.display = (hasScroll && !isAtEnd) ? 'block' : 'none';
    }

    wrap.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    
    // Check after a short delay for initial render
    setTimeout(checkScroll, 1000);
})();
