/* ============================= PWA ============================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered: ', reg.scope);
    }).catch(err => {
      console.error('SW registration failed: ', err);
    });
  });
}

/* ============================= HELPERS ============================= */
function nowText(){ return new Date().toISOString(); }
function fmtDate(iso){ const d=new Date(iso); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function fmtTime(iso){ const d=new Date(iso); return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}); }
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Pretty-print a TN phone: 21622333444 → +216 22 333 444
function formatPhone(p){
  if (!p) return '';
  const d = String(p).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('216')) {
    return '+216 ' + d.slice(3, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8);
  }
  if (d.length === 8) return d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5);
  return p;
}

// Owner/coach view: WhatsApp action buttons for this member. Returns empty if no phone.
async function whatsappButtons(member){
  if (!member.phone) return '';
  // We fetch all four templates upfront so the buttons can deep-link without round-tripping on click.
  const types = ['checkin', 'expiring', 'renewal', 'review'];
  const links = await Promise.all(types.map(async type => {
    try { return [type, await api.get(`/api/members/${member.id}/whatsapp-link?type=${type}`)]; }
    catch (e) { return [type, null]; }
  }));
  const byType = Object.fromEntries(links);
  return `
    <div class="card whatsapp-actions">
      <h3 style="margin-top:0;">💬 Message on WhatsApp</h3>
      <p class="hint">One-tap chat with pre-written French templates.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${byType.checkin ? `<a class="btn small" target="_blank" rel="noopener" href="${byType.checkin.url}">👋 Check-in nudge</a>` : ''}
        ${byType.expiring ? `<a class="btn small warn" target="_blank" rel="noopener" href="${byType.expiring.url}">⏳ Expiring soon</a>` : ''}
        ${byType.renewal ? `<a class="btn small bad" target="_blank" rel="noopener" href="${byType.renewal.url}">🔁 Renewal</a>` : ''}
        ${byType.review ? `<a class="btn small ghost" target="_blank" rel="noopener" href="${byType.review.url}">⭐ Weekly check-in</a>` : ''}
      </div>
    </div>
  `;
}
function initials(name){ return (name||'?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join(''); }

const GYM_COLORS = ['#06B6D4','#5B9BC4','#7FBF6A','#C79BF0','#E8B84B','#E06B9C','#6E9BFF'];
function gymColor(gymId){
  let h=0; for(let i=0;i<gymId.length;i++) h = (h*31 + gymId.charCodeAt(i)) >>> 0;
  return GYM_COLORS[h % GYM_COLORS.length];
}
function gymLogo(gym, size=''){
  if(gym && gym.logo){
    const sizes = { '':40, sm:28, lg:56 };
    const px = sizes[size] || 40;
    return `<img class="gym-logo-img ${size}" src="${escapeHtml(gym.logo)}" alt="${escapeHtml(gym.name)}" style="width:${px}px;height:${px}px;border-radius:${size==='lg'?12:size==='sm'?7:9}px;object-fit:cover;flex-shrink:0;" />`;
  }
  return `<div class="gym-logo ${size}" style="background:${gymColor(gym.id)};">${initials(gym.name)}</div>`;
}
function starHtml(avg, big=false){
  if(avg==null) return `<span class="${big?'stars big':'stars'}" style="color:var(--dimmer)">No ratings yet</span>`;
  const full = Math.round(avg);
  let s='';
  for(let i=1;i<=5;i++){ s += i<=full ? '★' : '<span class="off">★</span>'; }
  return `<span class="${big?'stars big':'stars'}">${s}</span> <span class="mono" style="color:var(--dim);font-size:12px;">${avg.toFixed(1)}</span>`;
}

/* ============================= GLOBAL STATE ============================= */
let CURRENT_USER = null;
let VIEW = 'dashboard';
let VIEW_PARAMS = {};
let authTab = 'login';
let authRole = 'client';
let signupGyms = [];
let selectedGymId = null;
let UNREAD_NOTIFS = 0;

function toast(msg, ok=true){
  const el = document.createElement('div');
  el.className = 'toast' + (ok?' ok':' err');
  el.innerHTML = (ok?ICONS.check:'') + `<span>${escapeHtml(msg)}</span>`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 2800);
}

// Animates the freshly rendered page: staggers grid items and counts up stat-num
// numbers. Safe to call multiple times — uses requestAnimationFrame and dedupes.
function animatePageIn(){
  const main = document.getElementById('mainContent');
  if (!main) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Stagger: any direct child that looks like a card/row gets the stagger class
  const grids = main.querySelectorAll('.grid');
  grids.forEach(g => g.classList.add('stagger'));

  // Number count-up: replace text on each .stat-num with an eased 0→target animation
  const nums = main.querySelectorAll('.stat-num');
  nums.forEach(el => {
    const raw = (el.textContent || '').trim();
    // Parse "1,234 DT" / "$3.5K" / "75%" / plain number. Strip everything but digits, commas, dots.
    const cleaned = raw.replace(/[^0-9.,]/g, '');
    if (!cleaned) return;
    const target = Number(cleaned.replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;
    const suffix = raw.slice(raw.replace(/[0-9.,]/g, '').length ? 0 : 0).replace(/[0-9.,]/g, '');
    const decimals = (cleaned.split('.')[1] || '').length;
    const duration = 700;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      el.textContent = (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function go(view, params={}){ VIEW = view; VIEW_PARAMS = params; render(); window.scrollTo(0,0); }

/* ============================= BOOT ============================= */
async function boot(){
  const app = document.getElementById('app');
  const token = localStorage.getItem('ironlog_token');
  if(token){
    try{ CURRENT_USER = await api.get('/api/auth/me'); }
    catch(e){ localStorage.removeItem('ironlog_token'); CURRENT_USER = null; }
  }
  render();
}
window.addEventListener('error', e => {
  console.error('[IRONLOG window error]', e.message, e.filename + ':' + e.lineno);
  var a = document.getElementById('app');
  if(a) a.innerHTML = '<div style="padding:24px;color:#fff;background:#1D2026;font-family:sans-serif;min-height:100vh"><h2 style="color:#06B6D4">JS Error</h2><pre style="background:#000;padding:16px;border-radius:8px;color:#ff5555;white-space:pre-wrap">' + (e.error && (e.error.stack||e.error.message)||e.message) + '\n\nat ' + e.filename + ':' + e.lineno + '</pre></div>';
});
window.addEventListener('unhandledrejection', e => {
  console.error('[IRONLOG promise rejection]', e.reason);
  var a = document.getElementById('app');
  if(a) a.innerHTML = '<div style="padding:24px;color:#fff;background:#1D2026;font-family:sans-serif;min-height:100vh"><h2 style="color:#06B6D4">Promise Rejection</h2><pre style="background:#000;padding:16px;border-radius:8px;color:#ff5555;white-space:pre-wrap">' + (e.reason && (e.reason.stack||e.reason.message)||String(e.reason)) + '</pre></div>';
});
try { boot(); } catch(e){ console.error('[IRONLOG boot sync throw]', e); }
console.log('[boot] boot() called (async)');

/* ============================= ROOT RENDER ============================= */
async function render(){
  const app = document.getElementById('app');
  try {
    if(!CURRENT_USER){
      app.innerHTML = await renderAuth();
      attachAuthHandlers();
      return;
    }
    // Fetch unread count in the background (don't block render)
    if (CURRENT_USER.role !== 'super_admin') {
      api.get('/api/notifications').then(r => { UNREAD_NOTIFS = r.unread || 0; updateNotifBadge(); }).catch(()=>{});
    }
    // Subscription paywall: if this gym is locked, render a full-screen paywall instead of the shell.
    if (CURRENT_USER.role !== 'super_admin') {
      try {
        const subStatus = await api.get('/api/payments/status');
        if (subStatus && subStatus.subscription && subStatus.subscription.status === 'locked') {
          app.innerHTML = await renderPaywall(subStatus);
          attachPaywallHandlers();
          return;
        }
      } catch (e) {
        // 402 = locked (server-side gate fired). Render paywall with whatever info we have.
        if (e && e.status === 402) {
          app.innerHTML = await renderPaywall({ subscription: { status: 'locked' }, monthlyPriceDT: 400 });
          attachPaywallHandlers();
          return;
        }
      }
    }
    app.innerHTML = renderShell();
    attachShellNavHandlers();
    const mainEl = document.getElementById('mainContent');
    try{
      mainEl.innerHTML = await renderPage();
    }catch(e){
      mainEl.innerHTML = `<div class="empty"><b>Couldn't load this page</b>${escapeHtml(e.message || 'Something went wrong talking to the server.')}</div>`;
    }
    attachPageHandlers();
    animatePageIn();
  } catch(err){
    console.error('[render] failed:', err);
    if(app) app.innerHTML = '<div style="padding:24px;color:#fff;background:#1D2026;font-family:sans-serif"><h2 style="color:#06B6D4">Render failed</h2><pre style="background:#000;padding:16px;border-radius:8px;color:#ff5555;white-space:pre-wrap">' + (err.stack||err.message||String(err)) + '</pre></div>';
  }
}

function updateNotifBadge(){
  const b = document.getElementById('notifBadge');
  if (!b) return;
  b.textContent = UNREAD_NOTIFS > 99 ? '99+' : UNREAD_NOTIFS;
  b.style.display = UNREAD_NOTIFS > 0 ? 'flex' : 'none';
}

/* ============================= AUTH SCREENS ============================= */
let landingTab = 'browse';
let landingGyms = [];
let selectedLandingGym = null;

function renderAppLogo(){
  return `<svg viewBox="0 0 100 100" width="60" height="60" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));">
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:var(--accent);stop-opacity:1" />
        <stop offset="100%" style="stop-color:#8B0000;stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="none" stroke="url(#logoGrad)" stroke-width="4" stroke-dasharray="10 4" />
    <circle cx="50" cy="50" r="42" fill="var(--surface)" stroke="var(--border)" stroke-width="1" />
    <g fill="url(#logoGrad)">
      <rect x="25" y="42" width="12" height="16" rx="2" />
      <rect x="63" y="42" width="12" height="16" rx="2" />
      <rect x="37" y="47" width="26" height="6" rx="1" />
      <rect x="28" y="38" width="8" height="4" rx="1" />
      <rect x="64" y="38" width="8" height="4" rx="1" />
      <rect x="28" y="54" width="8" height="4" rx="1" />
      <rect x="64" y="54" width="8" height="4" rx="1" />
    </g>
    <path d="M40 65 L50 75 L60 65" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

async function renderAuth(){
  try{ landingGyms = await api.get('/api/gyms'); }catch(e){ landingGyms = []; }
  return `
  <div class="auth-wrap">
    <div class="auth-side">
      <div class="auth-side-head" style="text-align:center;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border);">
        <div class="app-logo-stage" style="background:none;border:none;margin-bottom:10px;display:flex;justify-content:center;">${renderAppLogo()}</div>
        <h1 style="font-size:26px;margin:0;">IRON<span style="color:var(--signal)">LOG</span></h1>
        <p style="color:var(--dim);font-size:12px;margin-top:6px;">Pick your gym to begin</p>
      </div>
      <div class="auth-gym-list" style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;padding-right:4px;">
        ${landingGyms.length===0 ? `<div class="empty">No gyms available</div>` : landingGyms.map(g=>`
          <div class="auth-gym-item ${selectedLandingGym && selectedLandingGym.id===g.id?'active':''}" data-pick-gym="${g.id}" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius-sm);background:var(--surface);border:1px solid var(--border);cursor:pointer;transition:all .15s ease;">
            ${gymLogo(g,'sm')}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(g.name)}</div>
              <div style="font-size:11px;color:var(--text-dim);">${g.location || 'Tunisia'}</div>
            </div>
            <div style="font-size:11px;color:var(--accent);font-weight:700;">${g.memberCount}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:auto;padding-top:24px;text-align:center;">
        <button class="btn ghost small" data-landing-tab="signup" style="width:100%;">Create a new gym →</button>
      </div>
    </div>
    <div class="auth-form-wrap">
      ${selectedLandingGym ? `
        <div class="tabs">
          <button class="tab-btn ${landingTab==='login'?'active':''}" data-landing-tab="login">Log In</button>
          <button class="tab-btn ${landingTab==='signup'?'active':''}" data-landing-tab="signup">Sign Up</button>
          <button class="tab-btn" data-landing-tab="browse" style="margin-left:auto;color:var(--dim);">← Change Gym</button>
        </div>
        <div class="landing-gym-pill" style="margin-bottom:20px;">${ICONS.building}<span>${escapeHtml(selectedLandingGym.name)}</span>S electing this gym</span></div>
        ${landingTab==='login' ? renderLoginForm() : renderSignupForm()}
      ` : `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;gap:20px;opacity:.8;">
          <div style="font-size:50px;">🏢</div>
          <h2 style="font-size:24px;margin:0;">Welcome to IRONLOG</h2>
          <p style="color:var(--text-dim);font-size:14px;max-width:300px;line-height:1.6;">Please select your gym from the list on the left to log in or create an account.</p>
          <button class="btn" data-landing-tab="signup">I am a Gym Owner</button>
        </div>
      `}
      <div id="authErr"></div>
    </div>
  </div>`;
}

function renderLoginForm(){
  return `
    <form id="loginForm">
      <h2 style="font-size:20px;margin-bottom:4px;">Welcome back</h2>
      <p style="color:var(--dim);font-size:13px;margin-bottom:10px;">${selectedLandingGym ? `Logging into <b style="color:var(--chalk)">${escapeHtml(selectedLandingGym.name)}</b>.` : 'Log in to your account.'}</p>
      <label>Email</label>
      <input type="email" name="email" required placeholder="you@example.com">
      <label>Password</label>
      <input type="password" name="password" required placeholder="••••••••">
      <button class="btn" type="submit" style="width:100%;justify-content:center;margin-top:20px;">Log In</button>
    </form>`;
}

function renderSignupForm(){
  return `
    <form id="signupForm">
      <h2 style="font-size:20px;margin-bottom:4px;">Create your account</h2>
      <p style="color:var(--dim);font-size:13px;margin-bottom:6px;">Choose the role that fits you.</p>
      <div class="role-select">
        <div class="role-opt ${authRole==='owner'?'active':''}" data-role="owner">${ICONS.building}<div class="role-opt-label">Gym Owner</div></div>
        <div class="role-opt ${authRole==='trainer'?'active':''}" data-role="trainer">${ICONS.dumbbell}<div class="role-opt-label">Coach</div></div>
        <div class="role-opt ${authRole==='client'?'active':''}" data-role="client">${ICONS.users}<div class="role-opt-label">Member</div></div>
      </div>

      <label>Full name</label>
      <input type="text" name="name" required placeholder="Jordan Lee">
      <label>Email</label>
      <input type="email" name="email" required placeholder="you@example.com">
      <label>Password</label>
      <input type="password" name="password" required placeholder="At least 6 characters" minlength="6">

      ${authRole==='owner' ? `
        <label>Gym name</label>
        <input type="text" name="gymName" required placeholder="e.g. Iron District Gym">
        <label>Location <span style="color:var(--dimmer);font-weight:400;">(optional)</span></label>
        <input type="text" name="location" placeholder="e.g. Brooklyn, NY">
        <label>Description <span style="color:var(--dimmer);font-weight:400;">(optional)</span></label>
        <textarea name="description" rows="2" placeholder="What makes your gym special?" style="resize:vertical;"></textarea>
        <p class="hint">After signing up, go to Gym Settings to upload your logo and edit these.</p>
      ` : ''}

      ${authRole!=='owner' ? `
        <label>Which gym are you joining?</label>
        <input type="hidden" name="gymId" id="gymIdHidden" required value="${selectedLandingGym ? selectedLandingGym.id : ''}">
        ${signupGyms.length===0 ? `<p class="hint">No gyms exist yet — ask a gym owner to sign up first, or sign up as an owner yourself.</p>` : `
        <div class="gym-picker-grid">
          ${signupGyms.map(g=>`<button type="button" class="gym-card ${selectedLandingGym && selectedLandingGym.id===g.id?'active':''}" data-gym-card="${g.id}">
              ${gymLogo(g)}
              <div><div class="gym-card-name">${escapeHtml(g.name)}</div><div class="gym-card-sub">${g.coachCount} coach${g.coachCount===1?'':'es'} · ${g.memberCount} member${g.memberCount===1?'':'s'}</div></div>
            </button>`).join('')}
        </div>
        <p class="hint">Tap a gym to join it.</p>
        `}
      ` : ''}

      ${authRole==='client' ? `
        <label>Pick a coach (optional — can be assigned later)</label>
        <select name="trainerId" id="trainerSelect">
          <option value="">Pick a gym first, or skip</option>
        </select>
      ` : ''}

      <button class="btn" type="submit" style="width:100%;justify-content:center;margin-top:20px;">Create Account</button>
    </form>`;
}

function attachAuthHandlers(){
  document.querySelectorAll('[data-landing-tab]').forEach(b=>{
    b.onclick = ()=>{ landingTab = b.dataset.landingTab; if(landingTab==='browse') selectedLandingGym=null; render(); };
  });
  document.querySelectorAll('[data-pick-gym-login]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.pickGymLogin;
      selectedLandingGym = landingGyms.find(g=>g.id===id);
      landingTab = 'login'; authTab = 'login'; signupGyms = landingGyms; render();
    };
  });
  document.querySelectorAll('[data-pick-gym-join]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.pickGymJoin;
      selectedLandingGym = landingGyms.find(g=>g.id===id);
      selectedGymId = id;
      landingTab = 'signup'; authTab = 'signup'; signupGyms = landingGyms; render();
      // Auto-load coaches for this gym if member role
      setTimeout(()=>{
        const trainerSelect = document.getElementById('trainerSelect');
        if(trainerSelect){
          trainerSelect.innerHTML = `<option value="">Loading coaches…</option>`;
          api.get(`/api/gyms/${id}/coaches`).then(coaches=>{
            trainerSelect.innerHTML = `<option value="">No coach yet</option>` + coaches.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
          }).catch(()=>{ trainerSelect.innerHTML = `<option value="">No coach yet</option>`; });
        }
      }, 50);
    };
  });
  document.querySelectorAll('[data-pick-gym]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.pickGym;
      selectedLandingGym = landingGyms.find(g=>g.id===id);
      selectedGymId = id;
      landingTab = 'login'; authTab = 'login'; signupGyms = landingGyms; render();
    };
  });
  document.querySelectorAll('.tab-btn[data-tab]').forEach(b=>{
    b.onclick = ()=>{ authTab = b.dataset.tab; render(); };
  });
  document.querySelectorAll('.role-opt').forEach(b=>{
    b.onclick = ()=>{ authRole = b.dataset.role; render(); };
  });
  document.querySelectorAll('[data-gym-card]').forEach(card=>{
    card.onclick = async ()=>{
      const gymId = card.dataset.gymCard;
      selectedGymId = gymId;
      selectedLandingGym = landingGyms.find(g=>g.id===gymId) || { id: gymId, name: '' };
      document.querySelectorAll('[data-gym-card]').forEach(c=>c.classList.toggle('active', c===card));
      const hidden = document.getElementById('gymIdHidden');
      if(hidden) hidden.value = gymId;
      const trainerSelect = document.getElementById('trainerSelect');
      if(trainerSelect){
        trainerSelect.innerHTML = `<option value="">Loading coaches…</option>`;
        try{
          const coaches = await api.get(`/api/gyms/${gymId}/coaches`);
          trainerSelect.innerHTML = `<option value="">No coach yet</option>` + coaches.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        }catch(e){ trainerSelect.innerHTML = `<option value="">No coach yet</option>`; }
      }
    };
  });

  const loginForm = document.getElementById('loginForm');
  if(loginForm){
    loginForm.onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(loginForm);
      try{
        const { token, user } = await api.post('/api/auth/login', { email: fd.get('email'), password: fd.get('password') });
        localStorage.setItem('ironlog_token', token);
        CURRENT_USER = user;
        VIEW = 'dashboard';
        render();
      }catch(err){ showAuthErr(err.message); }
    };
  }
  const signupForm = document.getElementById('signupForm');
  if(signupForm){
    signupForm.onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(signupForm);
      const payload = {
        name: fd.get('name'), email: fd.get('email'), password: fd.get('password'), role: authRole
      };
      if(authRole==='owner'){
        payload.gymName = fd.get('gymName');
        payload._location = fd.get('location') || '';
        payload._description = fd.get('description') || '';
      } else {
        payload.gymId = fd.get('gymId');
        if(!payload.gymId){ showAuthErr('Please tap a gym to join.'); return; }
        if(authRole==='client') payload.trainerId = fd.get('trainerId') || null;
      }
      try{
        const { token, user } = await api.post('/api/auth/signup', payload);
        // For owners, immediately patch their gym with location/description
        if(authRole==='owner' && (payload._location || payload._description)){
          try{ await api.patch(`/api/gyms/${user.gymId}`, { location: payload._location, description: payload._description }); }catch(_){}
        }
        localStorage.setItem('ironlog_token', token);
        CURRENT_USER = user;
        toast('Account created — welcome to IRONLOG.');
        VIEW = 'dashboard';
        render();
      }catch(err){ showAuthErr(err.message); }
    };
  }
}
function showAuthErr(msg){
  const el = document.getElementById('authErr');
  if(el) el.innerHTML = `<div class="err-msg">${escapeHtml(msg)}</div>`;
}

/* ============================= SHELL ============================= */
function navItemsForRole(role){
  if(role==='super_admin') return [
    ['dashboard','Platform','home'],
    ['adminPayments','Payments (Review)','receipt'],
    ['adminSubscriptions','Subscriptions','calendar'],
    ['adminRevenue','Revenue','chart'],
    ['adminGyms','All Gyms','building'],
    ['adminUsers','All Users','users'],
    ['adminSuspensions','Suspensions','ban'],
    ['aichat','AI Assistant','chat'],
  ];
  if(role==='owner' || role==='manager') return [
    ['dashboard','Overview','home'],
    ['trainers','Coaches','dumbbell'],
    ['clients','Members','users'],
    ['programs','All Programs','clipboard'],
    ['leaderboard','Leaderboard','trophy'],
    ['gymsettings','Gym Settings','building'],
    ['billing','Subscription / 400 DT','receipt'],
    ['aichat','AI Assistant','chat'],
  ];
  if(role==='receptionist') return [
    ['dashboard','Overview','home'],
    ['clients','Members','users'],
    ['aichat','AI Assistant','chat'],
  ];
  if(role==='trainer') return [
    ['dashboard','Overview','home'],
    ['clients','My Clients','users'],
    ['programs','My Programs','clipboard'],
    ['meals','Meal Check-ins','camera'],
    ['messages','Messages','chat'],
    ['browsegym','This Gym','building'],
  ];
  return [
    ['dashboard','Today','home'],
    ['checkin','Check In','camera'],
    ['myplans','My Plans','clipboard'],
    ['meals','Log a Meal','food'],
    ['messages','Messages','chat'],
    ['coach','My Coach','dumbbell'],
    ['progress','Progress','chart'],
    ['leaderboard','Leaderboard','trophy'],
    ['achievements','Achievements','star'],
    ['membership','Membership','card'],
    ['browsegym','This Gym','building'],
  ];
}

function renderShell(){
  const nav = navItemsForRole(CURRENT_USER.role);
  return `
  <div class="shell">
    <div class="sidebar">
      <div class="brand">
        <div class="brand-mark">${ICONS.dumbbell}</div>
        <div class="brand-name">IRON<span>LOG</span></div>
      </div>
      <div id="sidebarGymTag"></div>
      ${nav.map(([key,label,icon])=>`
        <button class="nav-item ${VIEW===key?'active':''}" data-view="${key}">
          ${ICONS[icon]}<span>${label}</span>
        </button>`).join('')}
      <div class="notif-area" style="position:relative;margin-top:auto;">
        <button class="notif-bell" id="notifBell" aria-label="Notifications">
          🔔 <span class="notif-badge" id="notifBadge" style="display:none;">0</span>
        </button>
        <div class="notif-panel" id="notifPanel">
          <div class="notif-head"><b>Notifications</b><button id="notifMarkAll" class="link-btn">Mark all read</button></div>
          <div id="notifList"></div>
        </div>
      </div>
      <div class="side-footer">
        <div class="lang-switch" style="margin-bottom:10px;">
          <button class="lang-btn ${CURRENT_LANG==='ar'?'active':''}" data-lang="ar">عربي</button>
          <button class="lang-btn ${CURRENT_LANG==='fr'?'active':''}" data-lang="fr">FR</button>
          <button class="lang-btn ${CURRENT_LANG==='en'?'active':''}" data-lang="en">EN</button>
        </div>
        <div class="who">
          <div class="avatar">${initials(CURRENT_USER.name)}</div>
          <div class="who-txt">
            <div class="who-name">${escapeHtml(CURRENT_USER.name)}</div>
            <div class="who-role">${CURRENT_USER.role}</div>
          </div>
        </div>
        <button class="logout-btn" id="logoutBtn">${t('nav.logout')}</button>
      </div>
    </div>
    <div class="main">
      <div id="mainContent"><div class="loader" style="min-height:200px;">${t('common.loading')}</div></div>
    </div>
  </div>`;
}

function attachShellNavHandlers(){
  document.querySelectorAll('.nav-item').forEach(b=>{
    b.onclick = ()=> go(b.dataset.view);
  });
  document.querySelectorAll('.lang-btn').forEach(b=>{
    b.onclick = ()=> setLang(b.dataset.lang);
  });
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.onclick = ()=>{
    localStorage.removeItem('ironlog_token');
    CURRENT_USER = null;
    VIEW = 'dashboard';
    render();
  };
  api.get(`/api/gyms/${CURRENT_USER.gymId}`).then(gym=>{
    const tag = document.getElementById('sidebarGymTag');
    if(tag) tag.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:0 8px 16px;">${gymLogo(gym,'sm')}<span style="color:var(--dim);font-size:12.5px;font-weight:600;">${escapeHtml(gym.name)}</span></div>`;
  }).catch(()=>{
    if(CURRENT_USER.role === 'super_admin'){
      const tag = document.getElementById('sidebarGymTag');
      if(tag) tag.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:0 8px 16px;">${ICONS.sparkle}<span style="color:var(--warn);font-size:12.5px;font-weight:700;">SUPER ADMIN</span></div>`;
    }
  });
}

/* ============================= PAGE ROUTER ============================= */
async function renderPage(){
  const role = CURRENT_USER.role;
  if(VIEW==='dashboard'){
    if(role==='super_admin') return renderAdminDashboard();
    if(role==='owner') return renderOwnerDashboard();
    if(role==='trainer') return renderTrainerDashboard();
    return renderClientDashboard();
  }
  if(VIEW==='aichat') return renderAIChat();
  if(role==='super_admin'){
    if(VIEW==='adminGyms') return renderAdminGyms();
    if(VIEW==='adminUsers') return renderAdminUsers();
    if(VIEW==='adminSuspensions') return renderAdminSuspensions();
    if(VIEW==='adminPayments') return renderAdminPayments();
    if(VIEW==='adminSubscriptions') return renderAdminSubscriptions();
    if(VIEW==='adminRevenue') return renderAdminRevenue();
  }
  if(role==='owner'){
    if(VIEW==='trainers') return renderOwnerTrainers();
    if(VIEW==='clients') {
      if (VIEW_PARAMS.memberId) return renderOwnerMemberDetail(VIEW_PARAMS.memberId);
      return renderOwnerClients();
    }
    if(VIEW==='programs') return renderOwnerPrograms();
    if(VIEW==='gymsettings') return renderOwnerGymSettings();
    if(VIEW==='billing') return renderBilling();
    if(VIEW==='leaderboard') return renderLeaderboard();
  }
  if(role==='trainer'){
    if(VIEW==='clients') return renderTrainerClients();
    if(VIEW==='programs') return renderTrainerPrograms();
    if(VIEW==='meals') return renderTrainerMeals();
    if(VIEW==='messages') return renderMessages();
    if(VIEW==='clientDetail') return renderTrainerClientDetail(VIEW_PARAMS.clientId);
    if(VIEW==='browsegym') return renderBrowseGym();
  }
  if(role==='client'){
    if(VIEW==='myplans') return renderClientPlans();
    if(VIEW==='meals') return renderClientMeals();
    if(VIEW==='messages') return renderMessages();
    if(VIEW==='coach') return renderClientCoach();
    if(VIEW==='browsegym') return renderBrowseGym();
    if(VIEW==='checkin') return renderCheckIn();
    if(VIEW==='progress') return renderClientProgress();
    if(VIEW==='leaderboard') return renderLeaderboard();
    if(VIEW==='achievements') return renderAchievements();
    if(VIEW==='membership') return renderClientMembership();
  }
  return `<div class="empty"><b>Nothing here yet</b>Try another tab in the sidebar.</div>`;
}

/* ============================= OWNER VIEWS ============================= */
async function renderOwnerDashboard(){
  const [ov, today, peak, subStatus] = await Promise.all([
    api.get(`/api/gyms/${CURRENT_USER.gymId}/overview`),
    api.get('/api/attendance/today'),
    api.get('/api/attendance/peak-hours'),
    api.get('/api/payments/status').catch(()=>null),
  ]);
  const topCoach = ov.trainers.slice().sort((a,b) => (b.avgRating || 0) - (a.avgRating || 0))[0];
  const peakMax = Math.max(1, ...peak.buckets);
  const peakBars = peak.buckets.map((v, i) => {
    const h = Math.round((v / peakMax) * 70);
    return `<div class="ph-bar" style="height:${h}px" title="${i}:00 — ${v} check-ins"><span class="ph-num">${v||''}</span></div>`;
  }).join('');

  // Trial / overdue banner
  let banner = '';
  if (subStatus && subStatus.subscription) {
    const s = subStatus.subscription;
    if (s.status === 'trialing') {
      const d = s.trialDaysLeft || 0;
      banner = `<div class="trial-banner"><div class="trial-emoji">🎁</div>
        <div style="flex:1;"><b>Free trial</b> — <b>${d} day${d===1?'':'s'}</b> left.
        ${d <= 3 ? 'Upgrade now to keep your gym running smoothly.' : 'Add a payment method anytime to upgrade.'}</div>
        <button class="btn small accent" data-goto="billing">Manage subscription →</button>
      </div>`;
    } else if (s.status === 'overdue') {
      banner = `<div class="trial-banner overdue"><div class="trial-emoji">⏰</div>
        <div style="flex:1;"><b>Payment overdue</b> — ${s.daysOverdue} day${s.daysOverdue===1?'':'s'} past due. Your gym will be locked in ${7 - s.daysOverdue} day${7 - s.daysOverdue===1?'':'s'} if not paid.</div>
        <button class="btn small" style="background:#f59e0b;color:#000;" data-goto="billing">Pay now →</button>
      </div>`;
    } else if (s.status === 'expired') {
      banner = `<div class="trial-banner overdue"><div class="trial-emoji">⌛</div>
        <div style="flex:1;"><b>Trial expired</b> — submit a payment to reactivate your gym.</div>
        <button class="btn small" style="background:#f59e0b;color:#000;" data-goto="billing">Pay now →</button>
      </div>`;
    }
  }

  return `
    <div class="topline">
      <div>
        <div class="eyebrow">${t('owner.dashboardTitle')}</div>
        <h1 class="page-title">${escapeHtml(ov.gym.name)}</h1>
        <p class="page-sub">${t('owner.dashboardSub')}</p>
      </div>
      <div>
        <div class="hero-pill">
          <span class="dot"></span>
          ${t('owner.gymActive')}
        </div>
      </div>
    </div>

    ${banner}

    <div class="grid cols-4">
      <div class="card stat-card">
        ${ICONS.dumbbell}
        <div class="stat-num">${ov.trainerCount}</div>
        <div class="stat-label">${t('owner.coaches')}</div>
      </div>
      <div class="card stat-card">
        ${ICONS.users}
        <div class="stat-num">${ov.clientCount}</div>
        <div class="stat-label">${t('owner.activeMembers')}</div>
      </div>
      <div class="card stat-card">
        ${ICONS.clipboard}
        <div class="stat-num">${ov.programCount}</div>
        <div class="stat-label">${t('owner.programs')}</div>
      </div>
      <div class="card stat-card">
        ${ICONS.trophy}
        <div class="stat-num">${ov.assignmentCount}</div>
        <div class="stat-label">${t('owner.activePlans')}</div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:18px;">
      <div class="card">
        <h3 style="margin-top:0;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);">Today at the gym</h3>
        <div class="big-num">${today.uniqueMembers}</div>
        <div style="color:var(--dim);font-size:13px;margin-top:-6px;">checked-in members · ${today.openCount} still inside</div>
        ${today.entries.length > 0 ? `<div style="margin-top:14px;display:flex;flex-direction:column;gap:6px;">${today.entries.slice(0,5).map(e=>`<div class="kv" style="border:none;"><span class="k">${escapeHtml(e.memberName)}</span><span>${fmtTime(e.checkInAt)}${e.checkOutAt?'':' <span style="color:var(--ok)">●</span>'}</span></div>`).join('')}</div>` : `<div class="empty" style="border:none;padding:14px 0 0;color:var(--dim);">No check-ins yet today.</div>`}
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);">Peak hours · last 30 days</h3>
        <div class="peak-hours">${peakBars}</div>
        <div class="peak-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
      </div>
    </div>

    ${topCoach && topCoach.avgRating ? `
    <div class="top-coach-card">
      <div class="top-coach-label">⭐ ${t('owner.topCoach')}</div>
      <div class="top-coach-body">
        <div class="avatar avatar-lg">${initials(topCoach.name)}</div>
        <div>
          <div class="top-coach-name">${escapeHtml(topCoach.name)}</div>
          <div class="top-coach-meta">${topCoach.clientCount} · ${topCoach.programCount}</div>
          <div style="margin-top:6px;">${starHtml(topCoach.avgRating, true)} <span style="color:var(--dim);font-size:12px;margin-left:6px;">${topCoach.reviewCount} ${t('owner.reviewsOne')}</span></div>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="section-title">${t('owner.coaches')}</div>
    ${ov.trainers.length===0 ? `<div class="empty"><b>${t('owner.noCoaches')}</b></div>` : `
    <div class="grid cols-3">
      ${ov.trainers.sort((a,b) => (b.clientCount||0) - (a.clientCount||0)).map(t=>`<div class="card coach-card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div class="avatar">${initials(t.name)}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;">${escapeHtml(t.name)}</div>
              <div class="who-role">${escapeHtml(t.specialty || t.email)}</div>
            </div>
          </div>
          <div class="kv"><span class="k">${t('owner.programs')}</span><span><b>${t.programCount}</b></span></div>
          <div class="kv"><span class="k">${t('owner.membersCoached')}</span><span><b style="color:var(--signal)">${t.clientCount}</b></span></div>
          <div class="kv"><span class="k">${t('owner.avgRating')}</span><span>${starHtml(t.avgRating)}</span></div>
        </div>`).join('')}
    </div>`}

    <div class="section-title">${t('owner.recentPrograms')}</div>
    ${ov.recentPrograms.length===0 ? `<div class="empty"><b>${t('owner.noPrograms')}</b></div>` :
      ov.recentPrograms.map(p=>`<div class="list-row">
          <div class="list-row-main">
            <div class="avatar" style="background:${p.type==='diet'?'#2e3b23':'#1e3a4a'};color:${p.type==='diet'?'var(--ok)':'var(--steel)'};">${p.type==='diet'?'🥗':'🏋'}</div>
            <div>
              <div class="list-row-title">${escapeHtml(p.title)}</div>
              <div class="list-row-sub">${escapeHtml(p.trainerName)} · ${p.useCount}</div>
            </div>
          </div>
          <span class="pill ${p.type==='diet'?'client':'trainer'}">${p.type==='diet'?t('role.client'):t('role.trainer')}</span>
        </div>`).join('')}

    <div class="owner-help-card">
      <div>
        <h3 style="margin:0 0 6px;">${t('owner.needHelp')}</h3>
        <p style="margin:0;color:var(--dim);font-size:14px;">${t('owner.needHelpSub')}</p>
      </div>
      <a href="https://wa.me/21625424728" class="btn">WhatsApp</a>
    </div>
  `;
}

/* ============================= SUPER ADMIN VIEWS ============================= */
async function renderAdminDashboard(){
  const stats = await api.get('/api/admin/stats');
  const [pending, subs] = await Promise.all([
    api.get('/api/payments/pending').catch(() => []),
    api.get('/api/admin/subscriptions').catch(() => []),
  ]);
  const overdueCount = subs.filter(s => s.status === 'overdue' || s.status === 'locked').length;
  return `
    <div class="topline">
      <div>
        <div class="eyebrow">Super Admin</div>
        <h1 class="page-title">IRONLOG Platform</h1>
        <p class="page-sub">Every gym, every user, every program — across the whole platform.</p>
      </div>
      <div class="hero-pill"><span class="dot"></span>${stats.gyms.count} active gyms</div>
    </div>

    <div class="grid cols-4">
      <div class="card stat-card">
        ${ICONS.receipt}
        <div class="stat-num">${stats.revenue.monthlyDT.toLocaleString()} <span style="font-size:14px;color:var(--dim);">DT</span></div>
        <div class="stat-label">MRR · ${stats.revenue.activeGyms} × ${stats.revenue.pricePerGymDT} DT</div>
      </div>
      <div class="card stat-card" style="${stats.payments.pending>0?'border-color:var(--warn);':''}">
        ${ICONS.clipboard}
        <div class="stat-num" style="color:${stats.payments.pending>0?'var(--warn)':'var(--chalk)'};">${stats.payments.pending}</div>
        <div class="stat-label">Payments to review</div>
      </div>
      <div class="card stat-card">
        ${ICONS.building}
        <div class="stat-num">${stats.gyms.count}</div>
        <div class="stat-label">Gyms (${stats.gyms.newThisMonth} new / 30d)</div>
      </div>
      <div class="card stat-card" style="${overdueCount>0?'border-color:var(--warn);':''}">
        ${ICONS.users}
        <div class="stat-num" style="color:${overdueCount>0?'var(--warn)':'var(--chalk)'};">${overdueCount}</div>
        <div class="stat-label">Overdue / locked gyms</div>
      </div>
    </div>

    ${pending.length > 0 ? `<div class="section-title">Needs your attention · ${pending.length} payment${pending.length===1?'':'s'} waiting</div>
    <div class="card" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:10px 12px;">Gym</th><th>Submitted</th><th>Method</th><th>Amount</th><th>Receipt</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${pending.slice(0, 5).map(p=>`<tr style="border-top:1px solid var(--panel-line);">
            <td style="padding:10px 12px;font-weight:600;font-size:13px;">${escapeHtml(p.gymName||'—')}</td>
            <td style="font-size:13px;">${fmtDate(p.submittedAt)}</td>
            <td style="font-size:13px;">${escapeHtml(paymentMethodLabel(p.method))}</td>
            <td style="font-size:13px;"><b>${p.amount}</b> DT</td>
            <td>${p.receiptUrl ? `<a href="${escapeHtml(p.receiptUrl)}" target="_blank" style="color:var(--signal);">View</a>` : '—'}</td>
            <td><button class="btn small" data-approve-payment="${p.id}">Approve</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="padding:12px;border-top:1px solid var(--panel-line);"><button class="btn ghost small" data-goto="adminPayments">Open review queue →</button></div>
    </div>` : ''}

    <div class="section-title">Gyms on the platform</div>
    <div class="grid cols-3">
      ${stats.gyms.list.map(g => `
        <div class="card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            ${gymLogo(g, 'sm')}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(g.name)}</div>
              <div class="who-role">${g.location ? escapeHtml(g.location) : 'No location'}</div>
            </div>
          </div>
          <div class="kv"><span class="k">Coaches</span><span><b>${g.trainers}</b></span></div>
          <div class="kv"><span class="k">Members</span><span><b>${g.clients}</b></span></div>
          <div class="kv"><span class="k">Programs</span><span><b>${g.programs}</b></span></div>
          <div class="kv"><span class="k">MRR</span><span><b style="color:var(--ok)">${stats.revenue.pricePerGymDT} DT</b></span></div>
          ${g.suspended ? `<div style="margin-top:10px;"><span class="pill pending">Suspended</span></div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function renderAdminGyms(){
  const stats = await api.get('/api/admin/stats');
  return `
    <div class="topline"><div><div class="eyebrow">All Gyms</div><h1 class="page-title">Platform Directory</h1></div></div>
    <div class="card">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:8px 6px;">Gym</th><th>Location</th><th>Coaches</th><th>Members</th><th>Programs</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${stats.gyms.list.map(g => `
            <tr style="border-top:1px solid var(--panel-line);">
              <td style="padding:10px 6px;"><div style="display:flex;align-items:center;gap:8px;">${gymLogo(g,'sm')}<span style="font-weight:600;">${escapeHtml(g.name)}</span></div></td>
              <td style="color:var(--dim);">${g.location ? escapeHtml(g.location) : '—'}</td>
              <td>${g.trainers}</td>
              <td>${g.clients}</td>
              <td>${g.programs}</td>
              <td>${g.suspended ? '<span class="pill pending">Suspended</span>' : '<span class="pill done">Active</span>'}</td>
              <td><button class="btn small ${g.suspended ? 'secondary' : 'ghost'}" data-toggle-suspend="${g.id}" data-current="${g.suspended?1:0}">${g.suspended ? 'Re-activate' : 'Suspend'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderAdminUsers(){
  const [users, stats] = await Promise.all([api.get('/api/admin/users'), api.get('/api/admin/stats')]);
  const gymById = {};
  stats.gyms.list.forEach(g => gymById[g.id] = g);
  return `
    <div class="topline"><div><div class="eyebrow">All Users</div><h1 class="page-title">Platform Users</h1></div></div>
    <div class="card">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:8px 6px;">Name</th><th>Email</th><th>Role</th><th>Gym</th><th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr style="border-top:1px solid var(--panel-line);">
              <td style="padding:10px 6px;font-weight:600;">${escapeHtml(u.name)}</td>
              <td style="color:var(--dim);">${escapeHtml(u.email)}</td>
              <td><span class="pill ${u.role==='owner'?'owner':u.role==='trainer'?'trainer':u.role==='super_admin'?'pending':'client'}">${u.role}</span></td>
              <td>${u.gymName ? escapeHtml(u.gymName) : '<span style="color:var(--dimmer)">—</span>'}</td>
              <td style="color:var(--dim);">${fmtDate(u.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderAdminSuspensions(){
  const stats = await api.get('/api/admin/stats');
  const suspended = stats.gyms.list.filter(g => g.suspended);
  return `
    <div class="topline"><div><div class="eyebrow">Suspensions</div><h1 class="page-title">Suspended Gyms</h1><p class="page-sub">Hiding these gyms from the public browser and blocking their users from logging in.</p></div></div>
    ${suspended.length === 0 ? `<div class="empty"><b>No gyms are currently suspended</b>Use "All Gyms" to suspend one.</div>` :
      suspended.map(g => `
        <div class="list-row">
          <div class="list-row-main">
            ${gymLogo(g, 'sm')}
            <div>
              <div class="list-row-title">${escapeHtml(g.name)}</div>
              <div class="list-row-sub">${g.trainers} coaches · ${g.clients} members</div>
            </div>
          </div>
          <button class="btn small secondary" data-toggle-suspend="${g.id}" data-current="1">Re-activate</button>
        </div>
      `).join('')}
  `;
}

/* ============================= PAYWALL + BILLING ============================= */

const PAYMENT_METHODS = [
  { value: 'd17', labelKey: 'billing.methodD17' },
  { value: 'flouci', labelKey: 'billing.methodFlouci' },
  { value: 'ccp', labelKey: 'billing.methodCcp' },
  { value: 'bank', labelKey: 'billing.methodBank' },
  { value: 'cash', labelKey: 'billing.methodCash' },
];

function paymentMethodLabel(method) {
  const m = PAYMENT_METHODS.find(x => x.value === method);
  return m ? t(m.labelKey) : method;
}

function statusBadgeHtml(sub) {
  if (!sub) return `<span class="pill pending">${t('billing.statusUnknown')}</span>`;
  if (sub.status === 'active') return `<span class="pill done">${t('billing.statusActive')}</span>`;
  if (sub.status === 'overdue') return `<span class="pill pending">${t('billing.statusOverdue')} — ${sub.daysOverdue}d</span>`;
  if (sub.status === 'locked') return `<span class="pill pending" style="background:#7a1f1f;color:#fff;">${t('billing.statusLocked')}</span>`;
  return `<span class="pill pending">${sub.status}</span>`;
}

async function renderPaywall(subStatus) {
  const price = subStatus.monthlyPriceDT || 400;
  const sub = subStatus.subscription || {};
  return `
    <div style="min-height:100vh;background:#0e1115;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit;">
      <div style="max-width:520px;width:100%;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:22px;letter-spacing:.04em;">IRON<span style="color:#06B6D4">LOG</span></div>
          <p style="color:#8a93a3;margin:6px 0 0;font-size:13px;">Plateforme de gestion pour salles de sport · Tunisie</p>
        </div>
        <div style="background:#1a1f27;border:1px solid #2a313c;border-radius:14px;padding:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div style="width:36px;height:36px;border-radius:50%;background:#7a1f1f;display:flex;align-items:center;justify-content:center;color:#fff;">🔒</div>
            <h1 style="margin:0;font-size:20px;">${t('billing.paywallTitle')}</h1>
          </div>
          <p style="color:#b6bcc8;line-height:1.6;margin:0 0 18px;font-size:14px;">${t('billing.paywallMsg')}</p>
          ${statusBadgeHtml(sub)}
          <div style="margin-top:18px;font-weight:700;font-size:18px;color:#06B6D4;">${price} DT <span style="color:#8a93a3;font-weight:400;font-size:13px;">/ mois</span></div>

          <form id="paywallPaymentForm" style="margin-top:22px;display:flex;flex-direction:column;gap:12px;">
            <label style="font-size:12px;color:#8a93a3;text-transform:uppercase;letter-spacing:.06em;">${t('billing.uploadMethod')}</label>
            <select name="method" required style="background:#0e1115;border:1px solid #2a313c;color:#fff;padding:10px;border-radius:8px;">
              ${PAYMENT_METHODS.map(m=>`<option value="${m.value}">${paymentMethodLabel(m.value)}</option>`).join('')}
            </select>
            <label style="font-size:12px;color:#8a93a3;text-transform:uppercase;letter-spacing:.06em;">${t('billing.uploadDate')}</label>
            <input type="date" name="periodStart" required value="${new Date().toISOString().slice(0,10)}" style="background:#0e1115;border:1px solid #2a313c;color:#fff;padding:10px;border-radius:8px;">
            <label style="font-size:12px;color:#8a93a3;text-transform:uppercase;letter-spacing:.06em;">${t('billing.uploadTitle')}</label>
            <input type="file" name="receipt" accept="image/*" required style="background:#0e1115;border:1px solid #2a313c;color:#fff;padding:10px;border-radius:8px;font-size:13px;">
            <label style="font-size:12px;color:#8a93a3;text-transform:uppercase;letter-spacing:.06em;">${t('billing.uploadNote')}</label>
            <input type="text" name="note" placeholder="…" style="background:#0e1115;border:1px solid #2a313c;color:#fff;padding:10px;border-radius:8px;">
            <button type="submit" style="background:#06B6D4;color:#fff;border:none;padding:12px;border-radius:8px;font-weight:700;cursor:pointer;margin-top:6px;">${t('billing.uploadSubmit')}</button>
          </form>

          <div style="margin-top:20px;padding-top:18px;border-top:1px solid #2a313c;text-align:center;">
            <a href="https://wa.me/21625424728" style="color:#25D366;text-decoration:none;font-weight:600;font-size:14px;">💬 ${t('billing.paywallContact')}</a>
          </div>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <button id="paywallLogoutBtn" style="background:transparent;border:1px solid #2a313c;color:#8a93a3;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">${t('nav.logout')}</button>
        </div>
      </div>
    </div>`;
}

function attachPaywallHandlers() {
  const form = document.getElementById('paywallPaymentForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await api.upload('/api/payments', fd);
        toast('Reçu envoyé — en attente de vérification.');
        render();
      } catch (err) {
        toast(err.message || 'Échec de l\'envoi', false);
      }
    };
  }
  const logoutBtn = document.getElementById('paywallLogoutBtn');
  if (logoutBtn) logoutBtn.onclick = () => {
    localStorage.removeItem('ironlog_token');
    CURRENT_USER = null;
    VIEW = 'dashboard';
    render();
  };
}

async function renderBilling() {
  let status, history = [];
  try {
    [status, history] = await Promise.all([
      api.get('/api/payments/status'),
      api.get('/api/payments/mine'),
    ]);
  } catch (e) {
    return `<div class="empty"><b>Couldn't load billing info</b>${escapeHtml(e.message)}</div>`;
  }
  const sub = status.subscription || {};
  const price = status.monthlyPriceDT || 400;
  const statusCard = (() => {
    if (sub.status === 'locked') {
      return `<div style="border-left:4px solid #06B6D4;background:rgba(6,182,212,0.08);padding:14px 18px;border-radius:6px;">
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">🔒 ${t('billing.statusLocked')}</div>
        <div style="color:#d6dadf;font-size:13px;">${t('billing.statusLockedMsg')}</div>
      </div>`;
    }
    if (sub.status === 'overdue') {
      const msg = t('billing.statusOverdueDays').replace('{n}', sub.daysOverdue);
      return `<div style="border-left:4px solid #E8B84B;background:#3a341a;padding:14px 18px;border-radius:6px;">
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">⚠️ ${t('billing.statusOverdue')} — ${sub.daysOverdue}d</div>
        <div style="color:#d6dadf;font-size:13px;">${msg}</div>
      </div>`;
    }
    if (sub.status === 'active') {
      return `<div style="border-left:4px solid #7FBF6A;background:#1f3a23;padding:14px 18px;border-radius:6px;">
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">✓ ${t('billing.statusActive')}</div>
        <div style="color:#d6dadf;font-size:13px;">${t('billing.statusActiveUntil')} <b style="color:#fff;">${sub.paidThrough ? fmtDate(sub.paidThrough) : '—'}</b></div>
      </div>`;
    }
    return `<div style="border-left:4px solid #8a93a3;background:#1a1f27;padding:14px 18px;border-radius:6px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${t('billing.statusUnknown')}</div>
    </div>`;
  })();

  return `
    <div class="topline">
      <div>
        <div class="eyebrow">${t('billing.title')}</div>
        <h1 class="page-title">${escapeHtml(status.gymName || '')}</h1>
        <p class="page-sub">${t('billing.priceHint')}</p>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;">${t('billing.priceLabel').split(' /')[0]}</div>
        <div style="font-size:30px;font-weight:800;color:var(--signal);">${price} <span style="font-size:14px;color:var(--dim);font-weight:500;">DT / mois</span></div>
      </div>
    </div>

    ${statusCard}

    <div class="grid cols-2" style="margin-top:20px;">
      <div class="card">
        <h3 style="margin-top:0;">${t('billing.methodsTitle')}</h3>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;">
          ${PAYMENT_METHODS.map(m=>`<li style="padding:10px 12px;background:var(--panel-raised);border-radius:8px;font-size:13px;display:flex;align-items:center;gap:8px;"><span style="color:var(--signal);">●</span>${paymentMethodLabel(m.value)}</li>`).join('')}
        </ul>
        <div style="margin-top:14px;padding:12px;background:var(--panel-raised);border-radius:8px;font-size:12.5px;color:var(--dim);">
          <b style="color:var(--chalk);">${t('billing.bankDetails')}</b><br>
          WhatsApp: <a href="https://wa.me/21625424728" style="color:var(--signal);text-decoration:none;">+216 25 424 728</a><br>
          D17 / Flouci: numéro ci-dessus sur demande.
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">${t('billing.uploadTitle')}</h3>
        <form id="paymentUploadForm">
          <label>${t('billing.uploadMethod')}</label>
          <select name="method" required>
            ${PAYMENT_METHODS.map(m=>`<option value="${m.value}">${paymentMethodLabel(m.value)}</option>`).join('')}
          </select>
          <label>${t('billing.uploadDate')}</label>
          <input type="date" name="periodStart" required value="${new Date().toISOString().slice(0,10)}">
          <label>${t('billing.uploadTitle')}</label>
          <input type="file" name="receipt" accept="image/*" required>
          <label>${t('billing.uploadNote')}</label>
          <input type="text" name="note" placeholder="…">
          <button class="btn" type="submit" style="width:100%;justify-content:center;margin-top:14px;">${t('billing.uploadSubmit')}</button>
          <p class="hint" style="margin-top:8px;">${t('billing.uploadHint')}</p>
        </form>
      </div>
    </div>

    <div class="section-title">${t('billing.historyTitle')}</div>
    ${history.length === 0 ? `<div class="empty"><b>${t('billing.empty')}</b></div>` : `
    <div class="card" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:10px 12px;">Date</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          ${history.map(p=>`<tr style="border-top:1px solid var(--panel-line);">
            <td style="padding:10px 12px;font-size:13px;">${fmtDate(p.submittedAt)}</td>
            <td style="font-size:13px;">${escapeHtml(paymentMethodLabel(p.method))}</td>
            <td style="font-size:13px;"><b>${p.amount}</b> DT</td>
            <td><span class="pill ${p.status==='approved'?'done':p.status==='rejected'?'pending':'trainer'}">${p.status}</span></td>
            <td>${p.receiptUrl ? `<a href="${escapeHtml(p.receiptUrl)}" target="_blank" style="color:var(--signal);font-size:13px;">View</a>` : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}`;
}

/* ============================= SUPER ADMIN BILLING VIEWS ============================= */

async function renderAdminPayments() {
  let pending, all;
  try {
    [pending, all] = await Promise.all([api.get('/api/payments/pending'), api.get('/api/payments/all')]);
  } catch (e) {
    return `<div class="empty"><b>Couldn't load payments</b>${escapeHtml(e.message)}</div>`;
  }
  return `
    <div class="topline"><div><div class="eyebrow">Payments</div><h1 class="page-title">Review queue</h1><p class="page-sub">Approve receipts to extend a gym's subscription, or reject with a reason.</p></div></div>

    <div class="section-title">Pending (${pending.length})</div>
    ${pending.length === 0 ? `<div class="empty"><b>No payments waiting for review</b></div>` : `
    <div class="card" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:10px 12px;">Gym</th>
            <th>Submitted</th>
            <th>Method</th>
            <th>Period</th>
            <th>Receipt</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${pending.map(p=>`<tr style="border-top:1px solid var(--panel-line);">
            <td style="padding:10px 12px;"><div style="font-weight:700;font-size:13px;">${escapeHtml(p.gymName||'—')}</div><div style="color:var(--dim);font-size:11px;">${escapeHtml(p.submittedByName||'—')}</div></td>
            <td style="font-size:13px;">${fmtDate(p.submittedAt)}</td>
            <td style="font-size:13px;">${escapeHtml(paymentMethodLabel(p.method))}</td>
            <td style="font-size:13px;">${fmtDate(p.periodStart)} → ${fmtDate(p.periodEnd)}</td>
            <td>${p.receiptUrl ? `<a href="${escapeHtml(p.receiptUrl)}" target="_blank" style="color:var(--signal);">View</a>` : '<span style="color:var(--dimmer)">—</span>'}</td>
            <td style="display:flex;gap:6px;padding:10px 12px;">
              <button class="btn small" data-approve-payment="${p.id}">Approve</button>
              <button class="btn ghost small" data-reject-payment="${p.id}">Reject</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}

    <div class="section-title">All payments (${all.length})</div>
    <div class="card" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:10px 12px;">Date</th><th>Gym</th><th>Method</th><th>Amount</th><th>Status</th><th>Reviewed by</th>
          </tr>
        </thead>
        <tbody>
          ${all.slice(0, 30).map(p=>`<tr style="border-top:1px solid var(--panel-line);">
            <td style="padding:8px 12px;font-size:12.5px;">${fmtDate(p.submittedAt)}</td>
            <td style="font-size:12.5px;">${escapeHtml(p.gymName||'—')}</td>
            <td style="font-size:12.5px;">${escapeHtml(paymentMethodLabel(p.method))}</td>
            <td style="font-size:12.5px;"><b>${p.amount}</b> DT</td>
            <td><span class="pill ${p.status==='approved'?'done':p.status==='rejected'?'pending':'trainer'}">${p.status}</span></td>
            <td style="font-size:12.5px;color:var(--dim);">${escapeHtml(p.reviewedByName||'—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function renderAdminSubscriptions() {
  let rows;
  try { rows = await api.get('/api/admin/subscriptions'); } catch (e) {
    return `<div class="empty"><b>Couldn't load subscriptions</b>${escapeHtml(e.message)}</div>`;
  }
  return `
    <div class="topline"><div><div class="eyebrow">Subscriptions</div><h1 class="page-title">All gyms</h1><p class="page-sub">Effective status computed from each gym's paidThrough date + 7-day grace period.</p></div></div>
    <div class="card" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:10px 12px;">Gym</th><th>Owner</th><th>Paid through</th><th>Status</th><th>Overdue</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r=>`<tr style="border-top:1px solid var(--panel-line);">
            <td style="padding:10px 12px;font-weight:600;">${escapeHtml(r.gymName)}</td>
            <td style="font-size:13px;">${escapeHtml(r.ownerEmail||'—')}</td>
            <td style="font-size:13px;">${r.paidThrough ? fmtDate(r.paidThrough) : '<span style="color:var(--dimmer)">never</span>'}</td>
            <td>${statusBadgeHtml(r)}</td>
            <td style="font-size:13px;color:${r.daysOverdue>0?'var(--warn)':'var(--dim)'};">${r.daysOverdue || 0}d</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function renderAdminRevenue() {
  let rev;
  try { rev = await api.get('/api/admin/revenue'); } catch (e) {
    return `<div class="empty"><b>Couldn't load revenue</b>${escapeHtml(e.message)}</div>`;
  }
  const maxBar = Math.max(1, ...rev.last30Days.map(d => d.amount));
  return `
    <div class="topline"><div><div class="eyebrow">Revenue</div><h1 class="page-title">Money in</h1><p class="page-sub">From approved payment receipts.</p></div></div>
    <div class="grid cols-4">
      <div class="card stat-card">
        <div class="stat-num">${rev.mrr.toLocaleString()} <span style="font-size:14px;color:var(--dim);">DT</span></div>
        <div class="stat-label">MRR · ${rev.activeGyms} active × ${rev.pricePerGymDT} DT</div>
      </div>
      <div class="card stat-card">
        <div class="stat-num">${rev.ytd.toLocaleString()} <span style="font-size:14px;color:var(--dim);">DT</span></div>
        <div class="stat-label">Year-to-date</div>
      </div>
      <div class="card stat-card">
        <div class="stat-num">${rev.pendingAmount.toLocaleString()} <span style="font-size:14px;color:var(--dim);">DT</span></div>
        <div class="stat-label">Pending review (${rev.pendingCount})</div>
      </div>
      <div class="card stat-card">
        <div class="stat-num" style="color:${rev.overdueCount>0?'var(--warn)':'var(--ok)'};">${rev.overdueCount}</div>
        <div class="stat-label">Overdue gyms</div>
      </div>
    </div>

    ${rev.overdueGyms.length > 0 ? `<div class="section-title">Overdue gyms</div>
    <div class="card">${rev.overdueGyms.map(g=>`<div class="list-row"><div class="list-row-main"><div class="list-row-title">${escapeHtml(g.gymName)}</div><div class="list-row-sub">${g.daysOverdue} day${g.daysOverdue===1?'':'s'} overdue</div></div><span class="pill pending">${g.daysOverdue}d</span></div>`).join('')}</div>` : ''}

    <div class="section-title">Last 30 days</div>
    <div class="card">
      <div style="display:flex;align-items:flex-end;gap:3px;height:140px;">
        ${rev.last30Days.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;" title="${d.date}: ${d.amount} DT">
          <div style="background:var(--signal);width:100%;min-height:2px;border-radius:3px 3px 0 0;height:${Math.max(2, (d.amount/maxBar)*100)}px;"></div>
        </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;color:var(--dim);font-size:11px;margin-top:6px;">
        <span>${rev.last30Days[0].date.slice(5)}</span>
        <span>${rev.last30Days[rev.last30Days.length-1].date.slice(5)}</span>
      </div>
    </div>`;
}

/* ============================= AI ASSISTANT ============================= */
let chatHistory = [];
async function renderAIChat(){
  if(chatHistory.length === 0){
    chatHistory = [{ role:'assistant', text: CURRENT_USER.role==='super_admin'
      ? "Hello! I'm the IRONLOG platform assistant. Ask me anything — for example: \"Which gym has the most active members?\" or \"Show me gyms with no reviews this month\"."
      : "Bonjour ! Je suis votre assistant IRONLOG. Par exemple : dites \"La leg press est en panne\" et je trouverai des remplacements pour vos programmes touchés." }];
  }
  return `
    <div class="topline">
      <div>
        <div class="eyebrow">AI Assistant</div>
        <h1 class="page-title">Chat with IRONLOG</h1>
        <p class="page-sub">${CURRENT_USER.role==='super_admin' ? 'Full platform access. Ask about any gym, user, or program.' : 'Scoped to your gym. Try: "the leg press is broken" or "who has the most reviews".'}</p>
      </div>
      <span class="hero-pill"><span class="dot"></span>${CURRENT_USER.role==='super_admin' ? 'Platform scope' : 'Gym scope'}</span>
    </div>

    <div class="grid" style="grid-template-columns:1fr 280px;gap:18px;align-items:start;">
      <div class="card" style="padding:0;display:flex;flex-direction:column;height:560px;">
        <div id="chatScroll" style="flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:10px;">
          ${chatHistory.map(m=>`<div class="bubble ${m.role==='user'?'me':'them'}" style="white-space:pre-wrap;">${escapeHtml(m.text)}${m.substitution ? renderSubstitutionCard(m.substitution, m.affectedPrograms) : ''}</div>`).join('')}
        </div>
        <form id="chatForm" style="display:flex;gap:10px;padding:14px;border-top:1px solid var(--panel-line);">
          <input id="chatInput" type="text" placeholder="Type your message…" autocomplete="off" style="flex:1;">
          <button class="btn" type="submit">Send</button>
        </form>
      </div>
      <div>
        <div class="card">
          <h3 style="margin-top:0;font-size:14px;">Quick prompts</h3>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button class="btn ghost small" data-quick-prompt="The leg press is broken">"Leg press is broken"</button>
            <button class="btn ghost small" data-quick-prompt="The bench press is broken">"Bench press is broken"</button>
            <button class="btn ghost small" data-quick-prompt="The lat pulldown cable is snapped">"Lat pulldown cable snapped"</button>
            <button class="btn ghost small" data-quick-prompt="Which coach has the highest rating?">"Best-rated coach?"</button>
            <button class="btn ghost small" data-quick-prompt="Show me the most active members">"Most active members?"</button>
          </div>
        </div>
        <div class="card" style="margin-top:12px;">
          <h3 style="margin-top:0;font-size:14px;">${CURRENT_USER.role==='super_admin' ? 'Platform' : 'Tips'}</h3>
          <p style="font-size:12px;color:var(--dim);margin:0;">
            ${CURRENT_USER.role==='super_admin'
              ? 'You have full visibility. Ask anomalies: which gyms aren\'t growing, which coaches are inactive.'
              : 'Mention equipment by name (e.g. "leg press broken") and I\'ll find replacement exercises AND list every program affected.'}
          </p>
        </div>
      </div>
    </div>
  `;
}

async function applyAISubstitution(brokenId, subId, count){
  if(!confirm(`Replace all occurrences of the broken machine with this substitute in ${count} program(s)?`)) return;
  try {
    const res = await api.post('/api/chat/apply-substitution', { brokenExerciseId: brokenId, substituteExerciseId: subId });
    if(res.success) {
      alert(`Successfully updated ${res.updatedCount} programs!`);
      // Refresh the AI chat view to clear the substitution card or update history
      if(VIEW==='aichat') renderPage();
    }
  } catch(e) {
    alert('Error applying substitution: ' + e.message);
  }
}

function renderSubstitutionCard(sub, affected){
  if(!sub || !sub.candidates || sub.candidates.length === 0) return '';
  return `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.15);">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.8;margin-bottom:6px;">Replacements for "${escapeHtml(sub.broken.name)}" (${escapeHtml(sub.broken.primary)})</div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${sub.candidates.slice(0,3).map(c => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;">
            <div>→ <b>${escapeHtml(c.name)}</b> <span style="opacity:.7;">(${escapeHtml(c.equipment)})</span></div>
            <button onclick="applyAISubstitution('${sub.broken.id}', '${c.id}', ${affected?.length || 0})" style="font-size:10px;padding:2px 6px;cursor:pointer;background:var(--accent);border:none;border-radius:4px;color:white;font-weight:bold;">Fix All</button>
          </div>`).join('')}
      </div>
      ${affected && affected.length > 0 ? `
        <div style="margin-top:8px;font-size:11px;opacity:.8;">
          ${affected.length} program${affected.length===1?'':'s'} affected: ${affected.slice(0,3).map(p => escapeHtml(p.title)).join(', ')}${affected.length>3?` +${affected.length-3} more`:''}
        </div>` : ''}
    </div>`;
}

async function renderOwnerTrainers(){
  const ov = await api.get(`/api/gyms/${CURRENT_USER.gymId}/overview`);
  return `
    <div class="topline"><div><div class="eyebrow">${t('owner.coaches')}</div><h1 class="page-title">${t('owner.trainingStaff')}</h1></div></div>
    ${ov.trainers.length===0 ? `<div class="empty"><b>${t('owner.noCoaches')}</b>${t('owner.noCoaches')}</div>` :
    ov.trainers.map(t=>`<div class="card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="avatar" style="width:44px;height:44px;">${initials(t.name)}</div>
            <div>
              <div style="font-weight:700;font-size:16px;">${escapeHtml(t.name)}</div>
              <div class="who-role">${escapeHtml(t.email)}</div>
            </div>
          </div>
          <div style="text-align:right;">${starHtml(t.avgRating,true)}<div class="who-role">${t.reviewCount} ${t('owner.reviewsOne')}</div></div>
        </div>
        <div class="grid cols-3" style="margin-top:14px;">
          <div class="kv" style="border:none;"><span class="k">${t('owner.programs')}</span><span>${t.programCount}</span></div>
          <div class="kv" style="border:none;"><span class="k">${t('owner.membersCoached')}</span><span>${t.clientCount}</span></div>
          <div class="kv" style="border:none;"><span class="k">${t('owner.joined')}</span><span>${fmtDate(t.createdAt)}</span></div>
        </div>
        ${t.recentReviews && t.recentReviews.length>0 ? `<div class="section-title" style="margin:16px 0 8px;">${t('owner.recentFeedback')}</div>` + t.recentReviews.map(r=>`
          <div style="font-size:13px;color:var(--dim);padding:6px 0;border-top:1px solid var(--panel-line);">
            ${starHtml(r.rating)} — "${escapeHtml(r.comment||'No comment')}" <span style="color:var(--dimmer)">· ${escapeHtml(r.clientName)}</span>
          </div>`).join('') : ''}
      </div>`).join('')}
  `;
}

async function renderOwnerClients(){
  const members = await api.get(`/api/gyms/${CURRENT_USER.gymId}/members`);
  // Pull billing 360 in parallel for each member (small gyms, OK to N+1 here)
  const billings = await Promise.all(members.map(m =>
    api.get(`/api/members/${m.id}/billing`).catch(() => null)
  ));
  return `
    <div class="topline"><div><div class="eyebrow">${t('owner.membersCoached')}</div><h1 class="page-title">${t('owner.everyone')}</h1><p class="page-sub">Click a member to view their full billing 360°.</p></div></div>
    ${members.length===0 ? `<div class="empty"><b>${t('owner.noMembers')}</b></div>` :
    members.map((c, i) => {
      const b = billings[i] || {};
      const sub = b.subscription;
      const plan = b.plan;
      let subPill = '';
      if (!sub) subPill = `<span class="pill bad">No plan</span>`;
      else if (sub.status === 'active' && !sub.isExpiring) subPill = `<span class="pill ok">Active</span>`;
      else if (sub.status === 'active' && sub.isExpiring) subPill = `<span class="pill warn">Expires in ${sub.daysToEnd}d</span>`;
      else if (sub.status === 'trialing') subPill = `<span class="pill warn">Pending payment</span>`;
      else if (sub.status === 'frozen') subPill = `<span class="pill warn">Frozen</span>`;
      else if (sub.status === 'cancelled') subPill = `<span class="pill bad">Cancelled</span>`;
      else if (sub.isExpired) subPill = `<span class="pill bad">Expired</span>`;
      else subPill = `<span class="pill">${escapeHtml(sub.status)}</span>`;
      const subLine = plan
        ? `${escapeHtml(plan.name)} · ${plan.priceDT} DT · ${sub ? sub.daysToEnd + 'd left' : 'no sub'}`
        : (c.planCount > 0 ? `${c.planCount} workout plan${c.planCount===1?'':'s'} assigned` : 'No plan yet');
      return `<div class="list-row" data-open-member="${c.id}" style="cursor:pointer;">
        <div class="list-row-main">
          <div class="avatar">${initials(c.name)}</div>
          <div>
            <div class="list-row-title">${escapeHtml(c.name)}</div>
            <div class="list-row-sub">${subLine}</div>
          </div>
        </div>
        ${subPill}
      </div>`;
    }).join('')}
  `;
}

async function renderOwnerMemberDetail(memberId){
  const [member, billing] = await Promise.all([
    api.get(`/api/users/${memberId}`),
    api.get(`/api/members/${memberId}/billing`),
  ]);
  // Pull this gym's plans for the assign dropdown
  const gym = await api.get(`/api/gyms/${CURRENT_USER.gymId}/membership-plans`).catch(()=>({plans:[]}));
  const plans = gym.plans || [];
  const sub = billing.subscription;
  const plan = billing.plan;
  const status = sub ? sub.status : 'none';

  // Status badge
  const statusBadge = {
    active: `<span class="pill ok">Active</span>`,
    trialing: `<span class="pill warn">Pending payment</span>`,
    frozen: `<span class="pill warn">Frozen</span>`,
    cancelled: `<span class="pill bad">Cancelled</span>`,
    expired: `<span class="pill bad">Expired</span>`,
    none: `<span class="pill">No plan</span>`
  }[status] || `<span class="pill">${escapeHtml(status)}</span>`;

  // Last payment summary
  const lastPay = billing.lastPayment;
  const lastPayRow = lastPay ? `
    <div class="kv-row"><span>Last payment</span><b>${lastPay.amount} DT · ${lastPay.method} · ${lastPay.status}</b></div>
    <div class="kv-row"><span>Period</span><b>${fmtDate(lastPay.periodStart)} → ${fmtDate(lastPay.periodEnd)}</b></div>
  ` : `<div class="kv-row"><span>Last payment</span><b style="color:var(--dim);">none</b></div>`;

  // Plan section: assign form (if no active sub) or renewal/freeze controls (if active)
  const noActive = !sub || ['cancelled','expired'].includes(sub.status);
  const planPanel = noActive ? `
    <div class="card">
      <h3 style="margin-top:0;">Assign a plan</h3>
      <p class="hint">Pick a plan, set the start date, and record payment.</p>
      <form id="assignPlanForm">
        <label>Plan</label>
        <select name="planId" required>
          ${plans.length===0 ? '<option value="">— no plans yet —</option>' :
            plans.filter(p=>!p.archived).map(p=>`<option value="${p.id}">${escapeHtml(p.name)} — ${p.priceDT} DT / ${p.durationDays}d</option>`).join('')}
        </select>
        <label>Payment method</label>
        <select name="method">
          <option value="cash">Cash</option>
          <option value="d17">D17</option>
          <option value="flouci">Flouci</option>
          <option value="ccp">CCP</option>
          <option value="bank">Bank transfer</option>
        </select>
        <label>Start date (optional)</label>
        <input type="date" name="startAt">
        <label>Note (optional)</label>
        <input type="text" name="note" placeholder="e.g. Welcome to the gym!">
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input type="checkbox" name="collectedNow" checked> Payment collected now
        </label>
        <button class="btn" type="submit" style="margin-top:14px;">Assign &amp; start</button>
      </form>
    </div>` : `
    <div class="card">
      <h3 style="margin-top:0;">Manage subscription</h3>
      <div class="kv-row"><span>Plan</span><b>${plan ? escapeHtml(plan.name) : '—'}</b></div>
      <div class="kv-row"><span>Cycle</span><b>${plan ? plan.durationDays + ' days' : '—'}</b></div>
      <div class="kv-row"><span>Period</span><b>${fmtDate(sub.startAt)} → ${fmtDate(sub.endAt)}</b></div>
      <div class="kv-row"><span>Status</span><b>${escapeHtml(sub.status)}${sub.daysToEnd !== undefined ? ' · ' + (sub.daysToEnd < 0 ? Math.abs(sub.daysToEnd) + 'd ago' : sub.daysToEnd + 'd left') : ''}</b></div>
      ${lastPayRow}
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        ${sub.status !== 'frozen' && sub.status !== 'cancelled' ? `<button class="btn small" id="freezeBtn">❄️ Freeze (30d)</button>` : ''}
        ${sub.status === 'frozen' ? `<button class="btn small" id="unfreezeBtn">▶️ Unfreeze</button>` : ''}
        ${sub.status !== 'cancelled' ? `<button class="btn small ghost" id="cancelBtn">Cancel</button>` : `<button class="btn small" id="reactivateBtn">↻ Reactivate</button>`}
      </div>
    </div>`;

  // Switch-plan + assign-new (for renewals)
  const renewalPanel = !noActive && plans.length > 0 ? `
    <div class="card">
      <h3 style="margin-top:0;">Renew or change plan</h3>
      <form id="renewForm">
        <label>New plan</label>
        <select name="planId" required>
          ${plans.filter(p=>!p.archived).map(p=>`<option value="${p.id}" ${plan && p.id===plan.id?'selected':''}>${escapeHtml(p.name)} — ${p.priceDT} DT / ${p.durationDays}d</option>`).join('')}
        </select>
        <label>Payment method</label>
        <select name="method">
          <option value="cash">Cash</option>
          <option value="d17">D17</option>
          <option value="flouci">Flouci</option>
          <option value="ccp">CCP</option>
          <option value="bank">Bank transfer</option>
        </select>
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input type="checkbox" name="collectedNow" checked> Payment collected now
        </label>
        <button class="btn secondary" type="submit" style="margin-top:14px;">Renew / switch</button>
      </form>
    </div>` : '';

  return `
    <div class="topline">
      <div>
        <div class="eyebrow"><a href="#" data-go-back="clients">← Back to members</a></div>
        <h1 class="page-title">${escapeHtml(member.name)}</h1>
        <p class="page-sub">${escapeHtml(member.email)}${member.phone ? ' · ' + formatPhone(member.phone) : ' · no phone'}${member.trainerId ? ' · Assigned to a coach' : ' · No coach'}</p>
      </div>
      ${statusBadge}
    </div>

    ${whatsappButtons(member)}

    <div class="grid cols-2">
      ${planPanel}
      ${renewalPanel}
    </div>

    <div class="section-title" style="margin-top:24px;">Member snapshot</div>
    <div class="grid cols-3">
      <div class="card stat-card"><div class="stat-num">${billing.totalPaidDT} <span style="font-size:14px;color:var(--dim);">DT</span></div><div class="stat-label">Lifetime revenue</div></div>
      <div class="card stat-card"><div class="stat-num">${billing.paymentCount}</div><div class="stat-label">Payments on record</div></div>
      <div class="card stat-card"><div class="stat-num">${plan ? plan.durationDays : '—'}</div><div class="stat-label">Days per cycle</div></div>
    </div>
  `;
}

async function renderOwnerPrograms(){
  const programs = await api.get(`/api/gyms/${CURRENT_USER.gymId}/programs`);
  return `
    <div class="topline"><div><div class="eyebrow">${t('owner.programs')}</div><h1 class="page-title">${t('owner.allPlans')}</h1></div></div>
    ${programs.length===0 ? `<div class="empty"><b>${t('owner.nothingBuilt')}</b></div>` :
    programs.map(p=>`<div class="list-row">
        <div class="list-row-main">
          <div class="avatar" style="background:${p.type==='diet'?'#2e3b23':'#1e3a4a'};color:${p.type==='diet'?'var(--ok)':'var(--steel)'};">${p.type==='diet'?'D':'W'}</div>
          <div>
            <div class="list-row-title">${escapeHtml(p.title)}</div>
            <div class="list-row-sub">by ${escapeHtml(p.trainerName||'—')} · ${p.items.length} item${p.items.length===1?'':'s'} · ${p.useCount} assigned</div>
          </div>
        </div>
        <span class="pill ${p.type==='diet'?'client':'trainer'}">${p.type}</span>
      </div>`).join('')}
  `;
}

/* ============================= TRAINER VIEWS ============================= */
async function loadTrainerClientsWithCounts(){
  const [clients, meals] = await Promise.all([
    api.get('/api/users/clients/mine'),
    api.get('/api/meallogs/for-coach')
  ]);
  const counts = {};
  await Promise.all(clients.map(async c=>{
    try{ counts[c.id] = (await api.get(`/api/assignments/for-client/${c.id}`)).length; }
    catch(e){ counts[c.id] = 0; }
  }));
  return clients.map(c=>({
    ...c,
    planCount: counts[c.id]||0,
    pendingMeals: meals.filter(m=>m.clientId===c.id && m.status==='pending').length
  }));
}
function renderClientRow(c){
  return `<div class="list-row">
    <div class="list-row-main">
      <div class="avatar">${initials(c.name)}</div>
      <div>
        <div class="list-row-title">${escapeHtml(c.name)}</div>
        <div class="list-row-sub">${c.planCount} plan${c.planCount===1?'':'s'} assigned${c.pendingMeals>0?` · ${c.pendingMeals} meal${c.pendingMeals===1?'':'s'} to review`:''}</div>
      </div>
    </div>
    <button class="btn small secondary" data-open-client="${c.id}">View</button>
  </div>`;
}

async function renderOwnerGymSettings(){
  const gym = await api.get(`/api/gyms/${CURRENT_USER.gymId}`);
  return `
    <div class="topline"><div><div class="eyebrow">${t('nav.gymSettings')}</div><h1 class="page-title">${escapeHtml(gym.name)}</h1><p class="page-sub">${t('owner.profileLabel')}</p></div></div>

    <div class="grid cols-2">
      <div class="card">
        <h3 style="margin-top:0;">${t('owner.logoLabel')}</h3>
        <div id="gymLogoPreview" style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
          ${gymLogo(gym,'lg')}
          <div style="color:var(--dim);font-size:13px;">${gym.logo ? t('owner.currentLogo') : t('owner.noLogo')}</div>
        </div>
        <form id="logoUploadForm">
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" required>
          <button class="btn small" type="submit" style="margin-top:10px;">${t('owner.uploadLogo')}</button>
        </form>
        <p class="hint" style="margin-top:10px;">PNG, JPEG, WEBP, SVG, or GIF. Max 2MB.</p>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">${t('owner.profileLabel')}</h3>
        <form id="gymProfileForm">
          <label>${t('auth.gymName')}</label>
          <input type="text" name="name" required value="${escapeHtml(gym.name)}">
          <label>${t('auth.location')}</label>
          <input type="text" name="location" value="${escapeHtml(gym.location||'')}" placeholder="e.g. Brooklyn, NY">
          <label>${t('auth.description')}</label>
          <textarea name="description" rows="3" placeholder="What makes your gym special?" style="resize:vertical;">${escapeHtml(gym.description||'')}</textarea>
          <button class="btn" type="submit" style="margin-top:14px;">${t('common.save')}</button>
        </form>
      </div>
    </div>

    <div class="section-title">${t('owner.publicPreview')}</div>
    <div class="card">
      <p class="hint" style="margin-top:0;">${t('owner.publicPreviewHint')}</p>
      <div class="landing-gym-card" style="max-width:380px;margin-top:14px;">
        <div class="landing-gym-card-head">
          ${gymLogo(gym,'lg')}
          <div>
            <div class="landing-gym-card-name">${escapeHtml(gym.name)}</div>
            ${gym.location ? `<div class="landing-gym-card-loc">${ICONS.building}<span>${escapeHtml(gym.location)}</span></div>` : ''}
          </div>
        </div>
        ${gym.description ? `<p class="landing-gym-card-desc">${escapeHtml(gym.description)}</p>` : ''}
      </div>
    </div>
  `;
}

async function renderTrainerDashboard(){
  const clients = await loadTrainerClientsWithCounts();
  const [programs, meals, reviews] = await Promise.all([
    api.get('/api/programs/mine'),
    api.get('/api/meallogs/for-coach'),
    api.get(`/api/reviews/for/${CURRENT_USER.id}`)
  ]);
  const pendingMeals = meals.filter(m=>m.status==='pending');
  const avg = reviews.length ? reviews.reduce((s,r)=>s+r.rating,0)/reviews.length : null;
  return `
    <div class="topline">
      <div><div class="eyebrow">${t('coach.overview')}</div><h1 class="page-title">${t('coach.heyYou')} ${escapeHtml(CURRENT_USER.name.split(' ')[0])}</h1><p class="page-sub">${t('coach.whatsMoving')}</p></div>
      <button class="btn" id="openCreateProgram">${ICONS.plus} ${t('coach.newProgram')}</button>
    </div>
    <div class="grid cols-4">
      <div class="card stat-card">${ICONS.users}<div class="stat-num">${clients.length}</div><div class="stat-label">${t('coach.clientsStat')}</div></div>
      <div class="card stat-card">${ICONS.clipboard}<div class="stat-num">${programs.length}</div><div class="stat-label">${t('coach.programsBuilt')}</div></div>
      <div class="card stat-card">${ICONS.camera}<div class="stat-num">${pendingMeals.length}</div><div class="stat-label">${t('coach.mealsToReview')}</div></div>
      <div class="card stat-card">${ICONS.star}<div class="stat-num">${avg?avg.toFixed(1):'—'}</div><div class="stat-label">${t('coach.avgRating')}</div></div>
    </div>

    ${pendingMeals.length>0 ? `<div class="section-title">${t('coach.pendingMeals')}</div>
      ${pendingMeals.slice(0,4).map(m=>renderMealRowGeneric(m,clients)).join('')}` : ''}

    <div class="section-title">${t('coach.members')}</div>
    ${clients.length===0 ? `<div class="empty"><b>${t('coach.noClients')}</b>${t('coach.noClientsDetail')}</div>` :
    clients.map(c=>renderClientRow(c)).join('')}
    <div id="programModalHolder"></div>
  `;
}
function renderMealRowGeneric(m, clients){
  const c = clients.find(x=>x.id===m.clientId);
  return `<div class="list-row">
    <div class="list-row-main">
      <img src="${m.photo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">
      <div><div class="list-row-title">${escapeHtml(c?c.name:'Client')}</div><div class="list-row-sub">${fmtDate(m.date)} · ${escapeHtml(m.caption||'No caption')}</div></div>
    </div>
    <span class="pill ${m.status==='pending'?'pending':'done'}">${m.status}</span>
  </div>`;
}

async function renderTrainerClients(){
  const clients = await loadTrainerClientsWithCounts();
  return `
    <div class="topline"><div><div class="eyebrow">${t('coach.roster')}</div><h1 class="page-title">${t('coach.myClients')}</h1></div></div>
    ${clients.length===0 ? `<div class="empty"><b>${t('coach.noClientsRoster')}</b>${t('coach.noClientsRosterDetail')}</div>` :
    clients.map(c=>renderClientRow(c)).join('')}
  `;
}

async function renderTrainerClientDetail(clientId){
  const [c, asgRaw, meals] = await Promise.all([
    api.get(`/api/users/${clientId}`),
    api.get(`/api/assignments/for-client/${clientId}`),
    api.get(`/api/meallogs/for-client/${clientId}`)
  ]);
  return `
    <div class="topline">
      <div>
        <button class="btn ghost small" data-back-to="clients" style="margin-bottom:10px;">&larr; ${t('coach.backToClients')}</button>
        <div class="eyebrow">${t('coach.clientProfile')}</div>
        <h1 class="page-title">${escapeHtml(c.name)}</h1>
      </div>
      <button class="btn" id="openAssignProgram" data-client="${c.id}">${ICONS.plus} ${t('coach.assignProgram')}</button>
    </div>

    <div class="section-title">${t('coach.assignedPlans')}</div>
    ${asgRaw.length===0 ? `<div class="empty"><b>${t('coach.noPlans')}</b>${t('coach.noPlansDetail')}</div>` :
    asgRaw.map(a=>`<div class="list-row">
      <div class="list-row-main">
        <div class="avatar" style="background:${a.program.type==='diet'?'#2e3b23':'#1e3a4a'};color:${a.program.type==='diet'?'var(--ok)':'var(--steel)'};">${a.program.type==='diet'?'D':'W'}</div>
        <div><div class="list-row-title">${escapeHtml(a.program.title)}</div><div class="list-row-sub">${a.progress||0}%</div></div>
      </div>
      <span class="pill ${a.program.type==='diet'?'client':'trainer'}">${a.program.type}</span>
    </div>`).join('')}

    <div class="section-title">${t('coach.mealCheckins')}</div>
    ${meals.length===0 ? `<div class="empty"><b>${t('coach.noMeals')}</b></div>` : `<div class="meal-grid">${meals.map(m=>renderMealCard(m,true)).join('')}</div>`}

    <div class="section-title">${t('coach.messageClient')} ${escapeHtml(c.name.split(' ')[0])}</div>
    ${await renderChatWindow(c.id)}
    <div id="assignModalHolder"></div>
  `;
}

async function renderTrainerPrograms(){
  const all = await api.get(`/api/gyms/${CURRENT_USER.gymId}/programs`);
  const programs = all.filter(p=>p.trainerId===CURRENT_USER.id);
  return `
    <div class="topline">
      <div><div class="eyebrow">${t('coach.programsTab')}</div><h1 class="page-title">${t('coach.programsPageHeader')}</h1></div>
      <button class="btn" id="openCreateProgram">${ICONS.plus} ${t('coach.newProgram')}</button>
    </div>
    ${programs.length===0 ? `<div class="empty"><b>${t('coach.nothingBuilt')}</b>${t('coach.nothingBuiltDetail')}</div>` :
    programs.map(p=>`<div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <span class="pill ${p.type==='diet'?'client':'trainer'}">${p.type}</span>
            <div style="font-weight:700;font-size:16px;margin-top:8px;">${escapeHtml(p.title)}</div>
            <div class="who-role" style="margin-top:2px;">${p.useCount} client${p.useCount===1?'':'s'} ${t('coach.usingPlan')}</div>
          </div>
        </div>
        <div style="margin-top:12px;">
          ${p.items.map(it=>`<div class="checklist-item"><span class="cl-text">${escapeHtml(it.name)} — ${escapeHtml(it.detail||'')}</span></div>`).join('')}
        </div>
      </div>`).join('')}
    <div id="programModalHolder"></div>
  `;
}

function renderMealCard(m, withFeedbackForm){
  const photoSrc = m.photo || 'https://via.placeholder.com/300?text=No+Photo';
  return `<div class="meal-card">
    <img class="meal-photo" src="${photoSrc}">
    <div class="meal-card-body">
      <div class="mc-date">${fmtDate(m.date)} · <span class="pill ${m.status==='pending'?'pending':'done'}" style="padding:1px 7px;">${m.status}</span></div>
      <div style="font-size:12.5px;margin-top:5px;">${escapeHtml(m.caption||'')}</div>
      ${m.trainerFeedback ? `<div style="font-size:12px;color:var(--steel);margin-top:6px;border-top:1px solid var(--panel-line);padding-top:6px;">Coach note: ${escapeHtml(m.trainerFeedback)}</div>` : ''}
      ${withFeedbackForm ? `
        <form class="feedback-form" data-meal="${m.id}">
          <textarea name="feedback" placeholder="Leave a note for your client…" rows="2">${escapeHtml(m.trainerFeedback||'')}</textarea>
          <button class="btn small" type="submit" style="width:100%;justify-content:center;margin-top:6px;">Save Note</button>
        </form>` : ''}
    </div>
  </div>`;
}

async function renderTrainerMeals(){
  const meals = await api.get('/api/meallogs/for-coach');
  const pending = meals.filter(m=>m.status==='pending');
  const reviewed = meals.filter(m=>m.status!=='pending');
  return `
    <div class="topline"><div><div class="eyebrow">${t('coach.mealCheckinsHeader')}</div><h1 class="page-title">${t('coach.clientNutrition')}</h1></div></div>
    <div class="section-title">${t('coach.needsReview')} (${pending.length})</div>
    ${pending.length===0 ? `<div class="empty"><b>${t('coach.allCaughtUp')}</b>${t('coach.noMealPhotos')}</div>` : `<div class="meal-grid">${pending.map(m=>renderMealCard(m,true)).join('')}</div>`}
    <div class="section-title">${t('coach.alreadyReviewed')}</div>
    ${reviewed.length===0 ? `<div class="empty"><b>${t('coach.nothingReviewed')}</b></div>` : `<div class="meal-grid">${reviewed.map(m=>renderMealCard(m,true)).join('')}</div>`}
  `;
}

/* ============================= PROGRAM MODALS ============================= */
let programDraft = { type:'workout', items:[] };

function openCreateProgramModal(){
  programDraft = { type:'workout', items:[] };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'programModalBackdrop';
  document.body.appendChild(backdrop);
  renderProgramModalInner(backdrop);
}
function renderProgramModalInner(backdrop){
  const groups = {};
  EXERCISES.forEach(ex => {
    const g = (ex.primary || 'Other').split(',')[0].trim();
    if (!groups[g]) groups[g] = [];
    groups[g].push(ex);
  });
  const groupKeys = Object.keys(groups).sort();
  const exerciseLibraryHTML = `
    <div style="margin-top:8px;">
      <input type="text" id="exSearch" placeholder="Search ${EXERCISES.length} exercises..." style="margin-bottom:10px;">
      <div id="exLibraryScroll" style="max-height:340px;overflow-y:auto;padding-right:4px;">
        ${groupKeys.map(g => `
          <div class="ex-group" data-group="${escapeHtml(g)}">
            <div style="font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin:12px 0 8px;">${escapeHtml(g)} <span style="opacity:.5;">(${groups[g].length})</span></div>
            <div class="ex-cards">
                ${groups[g].map(ex => `
                  <div class="ex-card" data-ex-id="${ex.id}">
                    <div class="ex-card-media">
                      ${ex.gif ? `<img src="/videos/${escapeHtml(ex.gif)}" alt="${escapeHtml(ex.name)}" loading="lazy">` :
                        ex.video ? `<video src="/videos/${escapeHtml(ex.video)}" muted loop playsinline preload="metadata"></video>` :
                        `<div class="exanim-stage" style="margin:0;">${exerciseAnimSVG(ex.anim)}</div>`}
                      <div class="ex-card-overlay">
                        <button type="button" class="btn ghost small" data-preview-ex="${ex.id}">${ICONS.play} Preview</button>
                      </div>
                    </div>
                    <div class="ex-card-body">
                      <div class="ex-card-title">${escapeHtml(ex.name)}</div>
                      <div class="ex-card-meta">${escapeHtml(ex.equipment||'')}${ex.level?' · '+escapeHtml(ex.level):''}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="field-row" style="margin-top:14px;">
      <input type="text" id="exerciseDetail" placeholder="3 sets x 10 reps @ 70% 1RM">
    </div>
    <button type="button" class="btn secondary small" id="addItemBtn" style="margin-top:10px;">${ICONS.plus} Add to program</button>
  `;
  const mealFieldsHTML = `
    <div class="field-row">
      <div><input type="text" id="mealName" placeholder="Meal name, e.g. Breakfast"></div>
      <div><input type="text" id="mealDetail" placeholder="e.g. Oats, eggs, banana — 520 kcal"></div>
    </div>
    <button type="button" class="btn secondary small" id="addItemBtn" style="margin-top:10px;">${ICONS.plus} Add meal</button>
  `;
  backdrop.innerHTML = `
    <div class="modal" style="max-width:780px;max-height:90vh;overflow-y:auto;">
      <div class="modal-head"><h2 style="font-size:18px;">Build a Program</h2><button class="modal-close" id="closeProgramModal">&times;</button></div>
      <label>Plan type</label>
      <div class="role-select" style="grid-template-columns:1fr 1fr;">
        <div class="role-opt ${programDraft.type==='workout'?'active':''}" data-ptype="workout">${ICONS.dumbbell}<div class="role-opt-label">Workout</div></div>
        <div class="role-opt ${programDraft.type==='diet'?'active':''}" data-ptype="diet">${ICONS.food}<div class="role-opt-label">Diet</div></div>
      </div>
      <label>Plan title</label>
      <input type="text" id="ptitle" placeholder="${programDraft.type==='diet'?'e.g. Lean Cut — Week 1':'e.g. Push/Pull/Legs — Beginner'}">

      <label>${programDraft.type==='diet' ? 'Meals in this plan' : 'Exercises in this plan'}</label>
      <div id="itemsList">${renderItemsListHTML()}</div>

      <label style="margin-top:18px;">${programDraft.type==='diet' ? 'Add a meal' : 'Pick exercises from the library'}</label>
      ${programDraft.type==='workout' ? exerciseLibraryHTML : mealFieldsHTML}

      <div style="margin-top:22px;display:flex;gap:10px;">
        <button class="btn" id="saveProgramBtn" style="flex:1;justify-content:center;">Save Program</button>
        <button class="btn ghost" id="cancelProgramBtn">Cancel</button>
      </div>
    </div>`;
  wireProgramModal(backdrop);
}
function renderItemsListHTML(){
  if(programDraft.items.length===0) return `<p class="hint">No items added yet.</p>`;
  return programDraft.items.map((it,i)=>`
    <div class="list-row" style="padding:8px 10px;">
      <div class="list-row-main"><div class="list-row-title" style="font-size:13px;">${escapeHtml(it.name)}</div><div class="list-row-sub">${escapeHtml(it.detail||'')}</div></div>
      <button type="button" class="btn ghost small" data-remove-item="${i}">Remove</button>
    </div>`).join('');
}
function wireProgramModal(backdrop){
  document.getElementById('closeProgramModal').onclick = ()=> backdrop.remove();
  document.getElementById('cancelProgramBtn').onclick = ()=> backdrop.remove();
  document.querySelectorAll('[data-ptype]').forEach(el=>{
    el.onclick = ()=>{ programDraft.type = el.dataset.ptype; renderProgramModalInner(backdrop); };
  });

  // Live preview videos on hover
  backdrop.querySelectorAll('.ex-card-media video').forEach(v => {
    v.parentElement.addEventListener('mouseenter', () => { v.play().catch(()=>{}); });
    v.parentElement.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
  });

  // Preview button -> open the full exercise modal
  backdrop.querySelectorAll('[data-preview-ex]').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); openExerciseModal(b.dataset.previewEx); };
  });

  // Tap a card to select it (highlight); "Add" button pushes the selected card
  backdrop.querySelectorAll('.ex-card').forEach(card => {
    card.onclick = () => {
      backdrop.querySelectorAll('.ex-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
  });

  const search = document.getElementById('exSearch');
  if (search) {
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      backdrop.querySelectorAll('.ex-card').forEach(card => {
        const name = (card.querySelector('.ex-card-title').textContent || '').toLowerCase();
        card.style.display = (!q || name.includes(q)) ? '' : 'none';
      });
      backdrop.querySelectorAll('.ex-group').forEach(g => {
        const visible = Array.from(g.querySelectorAll('.ex-card')).some(c => c.style.display !== 'none');
        g.style.display = visible ? '' : 'none';
      });
    };
  }

  document.getElementById('addItemBtn').onclick = ()=>{
    if(programDraft.type==='workout'){
      const active = backdrop.querySelector('.ex-card.active');
      if(!active){ alert('Tap an exercise card to select it first.'); return; }
      const exId = active.dataset.exId;
      const ex = EXERCISES.find(e=>e.id===exId);
      const detail = document.getElementById('exerciseDetail').value.trim();
      programDraft.items.push({name: ex.name, detail, exerciseId: ex.id});
    } else {
      const name = document.getElementById('mealName').value.trim();
      const detail = document.getElementById('mealDetail').value.trim();
      if(!name) return;
      programDraft.items.push({name, detail});
    }
    document.getElementById('itemsList').innerHTML = renderItemsListHTML();
    wireRemoveButtons(backdrop);
    // Auto-play the next card's preview to keep things fast
    const detailEl = document.getElementById('exerciseDetail');
    if (detailEl) detailEl.value = '';
  };
  wireRemoveButtons(backdrop);
  document.getElementById('saveProgramBtn').onclick = async ()=>{
    const title = document.getElementById('ptitle').value.trim();
    if(!title){ alert('Give the program a title.'); return; }
    if(programDraft.items.length===0){ alert('Add at least one item.'); return; }
    try{
      await api.post('/api/programs', { title, type: programDraft.type, items: programDraft.items });
      backdrop.remove();
      toast('Program saved.');
      render();
    }catch(e){ alert(e.message); }
  };
}
function wireRemoveButtons(backdrop){
  backdrop.querySelectorAll('[data-remove-item]').forEach(b=>{
    b.onclick = ()=>{ programDraft.items.splice(+b.dataset.removeItem,1); document.getElementById('itemsList').innerHTML = renderItemsListHTML(); wireRemoveButtons(backdrop); };
  });
}

async function openAssignProgramModal(clientId){
  let programs = [];
  try{ programs = await api.get('/api/programs/mine'); }catch(e){}
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'assignModalBackdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h2 style="font-size:18px;">Assign a Program</h2><button class="modal-close" id="closeAssignModal">&times;</button></div>
      ${programs.length===0 ? `<p class="hint">You haven't built any programs yet. Close this and create one from "My Programs".</p>` : `
      <label>Choose a program</label>
      <select id="assignProgramSelect">${programs.map(p=>`<option value="${p.id}">${escapeHtml(p.title)} (${p.type})</option>`).join('')}</select>
      <button class="btn" id="doAssignBtn" style="width:100%;justify-content:center;margin-top:18px;">Assign to Client</button>
      `}
    </div>`;
  document.body.appendChild(backdrop);
  document.getElementById('closeAssignModal').onclick = ()=> backdrop.remove();
  const doAssign = document.getElementById('doAssignBtn');
  if(doAssign){
    doAssign.onclick = async ()=>{
      const programId = document.getElementById('assignProgramSelect').value;
      try{
        await api.post('/api/assignments', { programId, clientId });
        backdrop.remove();
        toast('Plan assigned.');
        render();
      }catch(e){ alert(e.message); }
    };
  }
}

/* ============================= MESSAGES ============================= */
async function renderChatWindow(partnerId){
  if(!partnerId) return `<div class="empty"><b>${t('coach.noCoachLinked')}</b>${t('coach.pickCoachMsg')}</div>`;
  let partner, thread;
  try{
    [partner, thread] = await Promise.all([
      api.get(`/api/users/${partnerId}`),
      api.get(`/api/messages/with/${partnerId}`)
    ]);
  }catch(e){
    return `<div class="empty"><b>Couldn't load messages</b>${escapeHtml(e.message)}</div>`;
  }
  return `
    <div class="chat-window">
      <div class="chat-msgs" id="chatMsgs">
        ${thread.length===0 ? `<div class="empty" style="border:none;">Say hello to ${escapeHtml(partner.name)}.</div>` :
        thread.map(m=>`<div class="bubble ${m.fromId===CURRENT_USER.id?'me':'them'}">${escapeHtml(m.text)}<div class="bubble-meta">${fmtTime(m.timestamp)}</div></div>`).join('')}
      </div>
      <form class="chat-input-row" id="chatForm" data-partner="${partnerId}">
        <input type="text" id="chatInput" placeholder="Message ${escapeHtml(partner.name)}…" autocomplete="off">
        <button class="btn small" type="submit">Send</button>
      </form>
    </div>`;
}
async function renderMessages(){
  let partnerId, contacts;
  if(CURRENT_USER.role==='client'){
    partnerId = CURRENT_USER.trainerId;
    contacts = partnerId ? [await api.get(`/api/users/${partnerId}`)] : [];
  } else {
    contacts = await api.get('/api/users/clients/mine');
    partnerId = VIEW_PARAMS.partnerId || (contacts[0] && contacts[0].id);
  }
  return `
    <div class="topline"><div><div class="eyebrow">Messages</div><h1 class="page-title">Conversations</h1></div></div>
    <div class="grid" style="grid-template-columns:220px 1fr;gap:16px;align-items:start;">
      <div class="card" style="padding:10px;">
        ${contacts.length===0 ? `<p class="hint" style="padding:6px;">No contacts yet.</p>` :
        contacts.map(c=>`<div class="nav-item ${c.id===partnerId?'active':''}" data-set-partner="${c.id}" style="cursor:pointer;">
          <div class="avatar" style="width:26px;height:26px;font-size:11px;">${initials(c.name)}</div><span>${escapeHtml(c.name)}</span>
        </div>`).join('')}
      </div>
      <div>${await renderChatWindow(partnerId)}</div>
    </div>
  `;
}

/* ============================= CLIENT VIEWS ============================= */
async function renderClientDashboard(){
  const [asg, meals, myAtt, today, ach] = await Promise.all([
    api.get('/api/assignments/mine'),
    api.get('/api/meallogs/mine'),
    api.get(`/api/attendance/member/${CURRENT_USER.id}`),
    api.get('/api/attendance/today'),
    api.get('/api/achievements/me').catch(()=>null),
  ]);
  const trainer = CURRENT_USER.trainerId ? await api.get(`/api/users/${CURRENT_USER.trainerId}`).catch(()=>null) : null;
  const reviews = CURRENT_USER.trainerId ? await api.get(`/api/reviews/for/${CURRENT_USER.trainerId}`).catch(()=>[]) : [];
  const avg = reviews.length ? reviews.reduce((s,r)=>s+r.rating,0)/reviews.length : null;
  const s = myAtt.streak;
  const open = myAtt.entries.find(e => !e.checkOutAt);
  const last7 = myAtt.entries.slice(0, 7);
  // Mini badges strip: show 3 most-recently-unlocked + "X of Y"
  let badgesHTML = '';
  if (ach) {
    const unlocked = ach.achievements.filter(a => a.unlocked);
    const recent = unlocked.slice(-3).reverse();
    const tierColors = { bronze: '#cd7f32', silver: '#cbd5e1', gold: '#f59e0b' };
    badgesHTML = `
      <div class="card" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);font-weight:600;">Badges</div>
          <div style="font-weight:700;font-size:14px;margin-top:2px;">${ach.unlockedCount} <span style="color:var(--dim);font-weight:400;">/ ${ach.total}</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-left:auto;">
          ${recent.length === 0
            ? `<span style="color:var(--dim);font-size:13px;">Check in to start earning</span>`
            : recent.map(a => `<div class="mini-badge" title="${escapeHtml(a.name)}" style="background:${tierColors[a.tier]}22;border-color:${tierColors[a.tier]};">${a.emoji}</div>`).join('')}
        </div>
        <button class="btn small secondary" data-go="achievements" style="margin-left:6px;">View all →</button>
      </div>`;
  }
  return `
    <div class="topline">
      <div><div class="eyebrow">Today</div><h1 class="page-title">${t('member.heyYou')} ${escapeHtml(CURRENT_USER.name.split(' ')[0])}</h1><p class="page-sub">${trainer? t('member.coachLine')+' '+escapeHtml(trainer.name) : t('member.noCoachLine')}</p></div>
    </div>

    <div class="streak-hero ${s.current>=3 ? 'on-fire' : ''}">
      <div class="streak-flame">🔥</div>
      <div class="streak-num">${s.current}</div>
      <div class="streak-label">day streak · longest ${s.longest}</div>
      <div class="streak-cta">
        ${open
          ? `<button class="btn big ghost" id="checkoutBtn">Checked in at ${fmtTime(open.checkInAt)} — Check out</button>`
          : `<button class="btn big" id="checkinBtn">${s.todayDone ? 'In the gym again' : s.current>0 ? 'Keep the streak alive' : 'Start your streak today'}</button>`}
      </div>
    </div>

    ${s.current>0 && !s.todayDone ? `<div class="risk-banner">⚠️ Your <b>${s.current}-day streak</b> expires at midnight. Hit the button above.</div>` : ''}

    ${badgesHTML ? `<div style="margin-top:18px;">${badgesHTML}</div>` : ''}

    <div class="grid cols-2" style="margin-top:18px;">
      <div class="card">
        <h3 style="margin-top:0;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);">This week</h3>
        <div class="week-strip">${weekStripHTML(last7)}</div>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);">Right now at the gym</h3>
        <div class="big-num">${today.uniqueMembers}</div>
        <div style="color:var(--dim);font-size:13px;margin-top:-6px;">members checked in</div>
        <div style="margin-top:8px;color:var(--dim);font-size:12.5px;">${today.openCount} still inside</div>
      </div>
    </div>

    <div class="section-title" style="margin-top:24px;">${t('member.yourPlans')}</div>
    ${asg.length===0 ? `<div class="empty"><b>${t('member.noPlans')}</b>${t('member.noPlansDetail')}</div>` :
    asg.map(a=>`<div class="list-row" data-open-plan="${a.id}" style="cursor:pointer;">
      <div class="list-row-main">
        <div class="avatar" style="background:${a.program.type==='diet'?'#2e3b23':'#1e3a4a'};color:${a.program.type==='diet'?'var(--ok)':'var(--steel)'};">${a.program.type==='diet'?'D':'W'}</div>
        <div><div class="list-row-title">${escapeHtml(a.program.title)}</div><div class="list-row-sub">${a.progress||0}% complete</div></div>
      </div>
      <span class="pill ${a.program.type==='diet'?'client':'trainer'}">${a.program.type}</span>
    </div>`).join('')}

    <div class="grid cols-3" style="margin-top:18px;">
      <div class="card stat-card">${ICONS.clipboard}<div class="stat-num">${asg.length}</div><div class="stat-label">Active plans</div></div>
      <div class="card stat-card">${ICONS.food}<div class="stat-num">${meals.length}</div><div class="stat-label">Meals logged</div></div>
      <div class="card stat-card">${ICONS.star}<div class="stat-num">${avg?avg.toFixed(1):'—'}</div><div class="stat-label">Coach rating</div></div>
    </div>
  `;
}

async function renderClientPlans(){
  const asg = await api.get('/api/assignments/mine');
  if(VIEW_PARAMS.planId){
    const a = asg.find(x=>x.id===VIEW_PARAMS.planId);
    if(a) return renderPlanDetail(a);
  }
  return `
    <div class="topline"><div><div class="eyebrow">${t('member.assignedBy')}</div><h1 class="page-title">${t('member.myPlansHeader')}</h1></div></div>
    ${asg.length===0 ? `<div class="empty"><b>${t('member.nothingAssigned')}</b></div>` :
    asg.map(a=>`<div class="list-row" data-open-plan="${a.id}" style="cursor:pointer;">
      <div class="list-row-main">
        <div class="avatar" style="background:${a.program.type==='diet'?'#2e3b23':'#1e3a4a'};color:${a.program.type==='diet'?'var(--ok)':'var(--steel)'};">${a.program.type==='diet'?'D':'W'}</div>
        <div><div class="list-row-title">${escapeHtml(a.program.title)}</div><div class="list-row-sub">${a.progress||0}%</div></div>
      </div>
      <button class="btn small secondary" data-open-plan="${a.id}">${t('member.openPlan')}</button>
    </div>`).join('')}
  `;
}

function renderPlanDetail(a){
  const p = a.program;
  const completed = a.completedItems || [];
  return `
    <div class="topline">
      <div>
        <button class="btn ghost small" data-back-to="myplans" style="margin-bottom:10px;">&larr; ${t('common.back')}</button>
        <div class="eyebrow">${p.type==='diet'?t('member.diet'):t('member.workout')}</div>
        <h1 class="page-title">${escapeHtml(p.title)}</h1>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--dim);margin-bottom:10px;">
        <span>${t('member.progress')}</span><span class="mono">${a.progress||0}%</span>
      </div>
      <div style="height:8px;background:var(--panel-raised);border-radius:6px;overflow:hidden;margin-bottom:16px;">
        <div style="height:100%;width:${a.progress||0}%;background:var(--signal);"></div>
      </div>
      ${p.items.map((it,i)=>{
        const done = completed.includes(i);
        return `<div class="checklist-item ${done?'checked':''}">
          <input type="checkbox" data-toggle-item="${i}" data-asg="${a.id}" ${done?'checked':''}>
          <div style="flex:1;">
            <div class="cl-text" style="font-weight:600;">${escapeHtml(it.name)}</div>
            <div style="font-size:12px;color:var(--dim);">${escapeHtml(it.detail||'')}</div>
            <div class="pr-inputs" style="display:flex;gap:8px;margin-top:8px;">
              <input type="number" min="0" step="0.5" placeholder="kg" data-pr-weight="${i}" data-asg="${a.id}" style="width:80px;font-size:12px;padding:6px 8px;">
              <input type="number" min="0" step="1" placeholder="reps" data-pr-reps="${i}" data-asg="${a.id}" style="width:80px;font-size:12px;padding:6px 8px;">
              <span style="color:var(--dim);font-size:11px;align-self:center;">← for PR tracking</span>
            </div>
          </div>
          ${it.exerciseId ? `<button type="button" class="btn ghost small" data-show-exercise="${it.exerciseId}">${ICONS.play} Demo</button>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

async function renderClientMeals(){
  const meals = await api.get('/api/meallogs/mine');
  return `
    <div class="topline"><div><div class="eyebrow">${t('member.nutrition')}</div><h1 class="page-title">${t('member.logMeal')}</h1><p class="page-sub">${t('member.logMealSub')}</p></div></div>
    <div class="card" style="margin-bottom:24px;">
      <form id="mealForm">
        <label>${t('member.photo')}</label>
        <input type="file" accept="image/*" id="mealPhotoInput" required>
        <label>${t('member.caption')}</label>
        <input type="text" id="mealCaption" placeholder="${t('member.captionPlaceholder')}">
        <button class="btn" type="submit" style="margin-top:16px;">${ICONS.camera} ${t('member.logBtn')}</button>
      </form>
    </div>
    <div class="section-title">${t('member.history')}</div>
    ${meals.length===0 ? `<div class="empty"><b>${t('member.nothingLogged')}</b></div>` : `<div class="meal-grid">${meals.map(m=>renderMealCard(m,false)).join('')}</div>`}
  `;
}

async function renderClientCoach(){
  const trainer = CURRENT_USER.trainerId ? await api.get(`/api/users/${CURRENT_USER.trainerId}`).catch(()=>null) : null;
  const gymTrainers = await api.get(`/api/gyms/${CURRENT_USER.gymId}/coaches`);
  const myReview = trainer ? await api.get(`/api/reviews/mine-for/${trainer.id}`).catch(()=>null) : null;
  return `
    <div class="topline"><div><div class="eyebrow">${t('member.coaching')}</div><h1 class="page-title">${t('member.myCoach')}</h1></div></div>
    ${trainer ? `
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="avatar" style="width:46px;height:46px;">${initials(trainer.name)}</div>
          <div><div style="font-weight:700;font-size:16px;">${escapeHtml(trainer.name)}</div><div class="who-role">${escapeHtml(trainer.email)}</div></div>
        </div>
        <div style="margin-top:10px;">${starHtml((gymTrainers.find(t=>t.id===trainer.id)||{}).avgRating,true)}</div>
      </div>
      <div class="section-title">${t('member.rateCoach')}</div>
      <div class="card">
        <div id="starPicker" class="stars big" data-value="${myReview?myReview.rating:0}">${[1,2,3,4,5].map(n=>`<span data-star="${n}" class="${myReview&&n<=myReview.rating?'':'off'}">★</span>`).join('')}</div>
        <textarea id="reviewComment" placeholder="${t('member.howCoach')}" style="margin-top:12px;">${myReview?escapeHtml(myReview.comment):''}</textarea>
        <button class="btn small" id="submitReviewBtn" style="margin-top:10px;">${t('member.submitRating')}</button>
      </div>
    ` : `
      <div class="section-title">${t('member.pickCoach')}</div>
      ${gymTrainers.length===0 ? `<div class="empty"><b>${t('member.noCoachAtGym')}</b></div>` :
      gymTrainers.map(t=>`<div class="list-row">
        <div class="list-row-main"><div class="avatar">${initials(t.name)}</div><div><div class="list-row-title">${escapeHtml(t.name)}</div><div class="list-row-sub">${starHtml(t.avgRating)}</div></div></div>
        <button class="btn small" data-pick-trainer="${t.id}">${t('member.choose')}</button>
      </div>`).join('')}
    `}
  `;
}

/* ============================= CHECK IN + STREAK ============================= */
async function renderCheckIn(){
  const [today, mine, streakInfo] = await Promise.all([
    api.get('/api/attendance/today'),
    api.get(`/api/attendance/member/${CURRENT_USER.id}`),
    Promise.resolve(mine => mine.streak),
  ]);
  const s = mine.streak;
  const open = mine.entries.find(e => !e.checkOutAt);
  const last7 = mine.entries.slice(0, 7);
  return `
    <div class="topline">
      <div><div class="eyebrow">Check In</div><h1 class="page-title">Welcome ${escapeHtml(CURRENT_USER.name.split(' ')[0])}</h1></div>
    </div>

    <div class="streak-hero ${s.current>=3 ? 'on-fire' : ''}">
      <div class="streak-flame">🔥</div>
      <div class="streak-num">${s.current}</div>
      <div class="streak-label">day streak</div>
      <div class="streak-sub">Longest: <b>${s.longest}</b> · Today: <b>${s.todayDone ? '✓ done' : 'pending'}</b></div>
      <div class="streak-cta">
        ${open
          ? `<button class="btn ghost" id="checkoutBtn">Check out (since ${fmtTime(open.checkInAt)})</button>`
          : `<button class="btn big" id="checkinBtn">${s.todayDone ? 'Already in — check in again?' : s.current>0 ? 'Keep the streak alive' : 'Start your streak'}</button>`}
      </div>
    </div>

    ${s.current>0 && !s.todayDone ? `
      <div class="risk-banner">
        ⚠️ Your <b>${s.current}-day streak</b> ends at midnight. Check in now to keep it.
      </div>` : ''}

    <div class="grid cols-2" style="margin-top:18px;">
      <div class="card">
        <h3 style="margin-top:0;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);">Last 7 days</h3>
        <div class="week-strip">${weekStripHTML(last7)}</div>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);">Today at the gym</h3>
        <div class="big-num">${today.uniqueMembers}</div>
        <div style="color:var(--dim);font-size:13px;margin-top:-6px;">members checked in</div>
        <div style="margin-top:10px;color:var(--dim);font-size:12.5px;">${today.openCount} still inside</div>
      </div>
    </div>
  `;
}

function weekStripHTML(entries){
  // Build a Mon..Sun strip for the current ISO week, marking days the user checked in
  const days = ['M','T','W','T','F','S','S'];
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(now);
  monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate() - dayOfWeek);
  const have = new Set(entries.map(e => {
    const d = new Date(e.checkInAt);
    d.setHours(0,0,0,0);
    return d.getTime();
  }));
  let out = '';
  for (let i=0; i<7; i++){
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const isToday = d.getTime() === new Date().setHours(0,0,0,0);
    const done = have.has(d.getTime());
    out += `<div class="week-day ${done?'done':''} ${isToday?'today':''}"><div class="d">${days[i]}</div><div class="n">${d.getDate()}</div>${done?'<div class="check">✓</div>':''}</div>`;
  }
  return out;
}

async function renderClientProgress(){
  const [mine, today, prs] = await Promise.all([
    api.get(`/api/attendance/member/${CURRENT_USER.id}`),
    api.get('/api/attendance/today'),
    api.get('/api/personal-records/me').catch(()=>null),
  ]);
  const s = mine.streak;
  // Build a 30-day attendance heatmap-ish: count by day for last 30
  const days = new Map();
  for (const e of mine.entries) {
    const d = new Date(e.checkInAt); d.setHours(0,0,0,0);
    days.set(d.getTime(), (days.get(d.getTime()) || 0) + 1);
  }
  const cells = [];
  for (let i=29; i>=0; i--){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    const c = days.get(d.getTime()) || 0;
    const intensity = c === 0 ? 0 : Math.min(4, c);
    cells.push(`<div class="heat-cell" data-l="${c>0?1:0}" title="${d.toISOString().slice(0,10)}: ${c} check-in${c===1?'':'s'}" style="--lvl:${intensity}"></div>`);
  }
  const last30 = mine.entries.filter(e => new Date(e.checkInAt) > new Date(Date.now() - 30*86400000));

  // PR section: show one card per exercise, each with current best
  const prCardsHTML = (prs && prs.exercises.length > 0) ? `
    <div class="section-title" style="margin-top:24px;">Personal records</div>
    <div class="pr-grid">
      ${prs.exercises.map(ex => {
        const heaviest = ex.records.find(r => r.kind === 'heaviest_weight');
        const reps = ex.records.filter(r => r.kind === 'max_reps_at_weight')
          .sort((a,b) => new Date(b.achievedAt) - new Date(a.achievedAt)).slice(0, 3);
        return `<div class="pr-card">
          <div class="pr-exercise">${escapeHtml(ex.exerciseName)}</div>
          ${heaviest ? `<div class="pr-record pr-record-best">
            <div class="pr-record-label">Heaviest</div>
            <div class="pr-record-num">${heaviest.value} <span class="pr-unit">kg</span></div>
            ${heaviest.repsAtValue ? `<div class="pr-record-sub">× ${heaviest.repsAtValue} reps</div>` : ''}
          </div>` : ''}
          ${reps.length > 0 ? `<div class="pr-record-list">
            ${reps.map(r => `<div class="pr-record-row">
              <span class="pr-rw-weight">${r.value}kg</span>
              <span class="pr-rw-times">×</span>
              <span class="pr-rw-reps"><b>${r.repsAtValue}</b></span>
            </div>`).join('')}
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>` : (prs ? `<div class="section-title" style="margin-top:24px;">Personal records</div>
    <div class="empty"><b>No PRs yet</b>Log a workout with weight + reps to track your best lifts.</div>` : '');

  return `
    <div class="topline">
      <div><div class="eyebrow">Progress</div><h1 class="page-title">Your 30 days</h1><p class="page-sub">Show up. That's the whole game.</p></div>
    </div>

    <div class="grid cols-3">
      <div class="card stat-card">
        <div class="stat-num">${s.current}</div>
        <div class="stat-label">Current streak</div>
      </div>
      <div class="card stat-card">
        <div class="stat-num">${s.longest}</div>
        <div class="stat-label">Longest streak</div>
      </div>
      <div class="card stat-card">
        <div class="stat-num">${last30.length}</div>
        <div class="stat-label">Visits last 30d</div>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h3 style="margin-top:0;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);">Last 30 days</h3>
      <div class="heat-strip">${cells.join('')}</div>
    </div>

    ${prCardsHTML}

    <div class="section-title" style="margin-top:24px;">History</div>
    ${mine.entries.length===0 ? `<div class="empty"><b>No check-ins yet</b>Hit Check In to start your streak.</div>` :
      `<div class="card" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="text-align:left;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:10px 12px;">When</th><th>Method</th><th>Duration</th>
          </tr></thead>
          <tbody>${mine.entries.slice(0,30).map(e=>`<tr style="border-top:1px solid var(--panel-line);">
            <td style="padding:10px 12px;font-size:13px;">${fmtDate(e.checkInAt)} · ${fmtTime(e.checkInAt)}</td>
            <td style="font-size:13px;">${escapeHtml(e.method||'—')}</td>
            <td style="font-size:13px;color:var(--dim);">${e.checkOutAt ? Math.round((new Date(e.checkOutAt)-new Date(e.checkInAt))/60000)+' min' : '<span style="color:var(--ok)">still inside</span>'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`}
  `;
}
async function renderAchievements(){
  const a = await api.get('/api/achievements/me');
  const list = a.achievements;
  const unlocked = list.filter(x => x.unlocked);
  const locked = list.filter(x => !x.unlocked).sort((x, y) => y.progress - x.progress);
  const tierColors = { bronze: '#cd7f32', silver: '#cbd5e1', gold: '#f59e0b' };

  const unlockedHTML = unlocked.length === 0
    ? `<div class="empty"><b>No achievements yet</b>Start checking in to earn your first badge.</div>`
    : `<div class="ach-grid">
        ${unlocked.map(ach => `
          <div class="ach-card unlocked tier-${ach.tier}" style="--tier-color:${tierColors[ach.tier]};">
            <div class="ach-emoji">${ach.emoji}</div>
            <div class="ach-name">${escapeHtml(ach.name)}</div>
            <div class="ach-desc">${escapeHtml(ach.description)}</div>
            <div class="ach-tier-pill">${ach.tier.toUpperCase()}</div>
          </div>
        `).join('')}
      </div>`;

  const lockedHTML = locked.length === 0
    ? ''
    : `<div class="section-title" style="margin-top:24px;">In progress</div>
      <div class="card" style="padding:0;">
        ${locked.map(ach => `
          <div class="ach-progress-row">
            <div class="ach-progress-emoji">${ach.emoji}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;">
                <div style="font-weight:700;font-size:13.5px;">${escapeHtml(ach.name)}</div>
                <div style="color:var(--dim);font-size:12px;">${ach.current}/${ach.target}</div>
              </div>
              <div class="ach-progress-desc">${escapeHtml(ach.description)}</div>
              <div class="ach-progress-bar">
                <div class="ach-progress-bar-fill" style="width:${ach.progress}%;background:${tierColors[ach.tier]};"></div>
              </div>
            </div>
            <div class="ach-tier-mini" style="color:${tierColors[ach.tier]};">${ach.tier.toUpperCase()}</div>
          </div>
        `).join('')}
      </div>`;

  return `
    <div class="topline">
      <div>
        <div class="eyebrow">Achievements</div>
        <h1 class="page-title">Your badges</h1>
        <p class="page-sub"><b>${a.unlockedCount}</b> of <b>${a.total}</b> unlocked. Show up. Earn them all.</p>
      </div>
    </div>

    ${unlockedHTML}
    ${lockedHTML}
  `;
}

async function renderLeaderboard(){
  const period = VIEW_PARAMS.period || 'week';
  const lb = await api.get('/api/leaderboard?period=' + period);

  // Podium = top 3 by check-ins
  const podium = lb.topByCheckins.slice(0, 3);
  // Reorder for visual: [2nd, 1st, 3rd]
  const visualOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
  const podiumHTML = visualOrder.length === 0
    ? `<div class="empty"><b>No activity yet</b>Start checking in to climb the ranks.</div>`
    : `<div class="podium">
        ${visualOrder.map((r, idx) => {
          const slot = idx === 1 ? 0 : idx === 0 ? 1 : 2; // reorder: idx 1 = 2nd, idx 0 = 1st, idx 2 = 3rd
          const place = slot + 1;
          const height = place === 1 ? 110 : place === 2 ? 80 : 60;
          const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
          const isMe = CURRENT_USER.role === 'client' && lb.me && r.memberId === lb.me.memberId;
          return `<div class="podium-slot place-${place} ${isMe ? 'me' : ''}">
            <div class="podium-medal">${medal}</div>
            <div class="podium-avatar">${escapeHtml(r.initials || r.name.slice(0,2))}</div>
            <div class="podium-name">${escapeHtml(r.name)}${isMe ? ' <span class="podium-you">YOU</span>' : ''}</div>
            <div class="podium-num"><b>${r.checkins}</b> check-in${r.checkins===1?'':'s'}</div>
            <div class="podium-bar" style="height:${height}px;">
              <div class="podium-bar-num">#${place}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`;

  // Ranked list (rank 4-10, or all if ≤ 10 members)
  const ranked = lb.topByCheckins.slice(3);
  const rankedHTML = ranked.length === 0
    ? ''
    : `<div class="card" style="padding:0;margin-top:18px;">
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${ranked.map(r => {
              const isMe = CURRENT_USER.role === 'client' && lb.me && r.memberId === lb.me.memberId;
              return `<tr style="border-top:1px solid var(--panel-line);${isMe?'background:rgba(6,182,212,.08);':''}">
                <td style="padding:12px 14px;font-weight:700;color:var(--dim);width:48px;">#${r.checkinRank}</td>
                <td style="padding:12px 14px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div class="avatar" style="width:32px;height:32px;font-size:12px;">${escapeHtml(r.initials || r.name.slice(0,2))}</div>
                    <div><div style="font-weight:600;font-size:13.5px;">${escapeHtml(r.name)}${isMe?' <span class="pill" style="margin-left:6px;font-size:10px;">YOU</span>':''}</div></div>
                  </div>
                </td>
                <td style="padding:12px 14px;text-align:right;font-weight:700;font-size:13.5px;">${r.checkins} <span style="color:var(--dim);font-weight:400;">check-in${r.checkins===1?'':'s'}</span></td>
                <td style="padding:12px 14px;text-align:right;color:var(--dim);font-size:12.5px;">🔥 ${r.streak}d</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

  // Streak kings (top 3 by current streak)
  const streakKingsHTML = lb.topByStreak.length === 0
    ? ''
    : `<div class="section-title" style="margin-top:24px;">🔥 Streak kings</div>
       <div class="grid cols-3">
         ${lb.topByStreak.map((r, i) => {
           const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
           const isMe = CURRENT_USER.role === 'client' && lb.me && r.memberId === lb.me.memberId;
           return `<div class="card streak-king ${isMe ? 'me' : ''}">
             <div class="streak-king-medal">${medal}</div>
             <div class="avatar" style="width:48px;height:48px;font-size:16px;margin:8px auto;">${escapeHtml(r.initials || r.name.slice(0,2))}</div>
             <div style="font-weight:700;font-size:14px;text-align:center;">${escapeHtml(r.name)}</div>
             <div class="streak-king-num">${r.streak} day${r.streak===1?'':'s'}</div>
           </div>`;
         }).join('')}
       </div>`;

  // "Where do I stand" sticky banner for members
  const myStandHTML = (CURRENT_USER.role === 'client' && lb.me)
    ? `<div class="my-rank-banner">
        <div class="my-rank-left">
          <div class="my-rank-label">Your rank</div>
          <div class="my-rank-num">#${lb.me.checkinRank}<span style="color:var(--dim);font-size:14px;font-weight:500;"> / ${lb.totalMembers}</span></div>
        </div>
        <div class="my-rank-mid">
          <div><b>${lb.me.checkins}</b> check-in${lb.me.checkins===1?'':'s'} this ${lb.period}</div>
          <div style="color:var(--dim);font-size:12px;">🔥 ${lb.me.streak}-day streak</div>
        </div>
        <div class="my-rank-cta">
          ${lb.me.checkinRank === 1
            ? '<span class="pill ok">👑 You\'re #1</span>'
            : `<span class="pill">Beat #${lb.me.checkinRank - 1}</span>`}
        </div>
      </div>` : '';

  // Empty-state for gym owner with no members yet
  const emptyState = lb.totalMembers === 0
    ? `<div class="empty"><b>No members yet</b>Add members to start the leaderboard.</div>`
    : '';

  // Period toggle
  const periodToggle = `
    <div class="period-toggle">
      <button class="period-btn ${period==='week'?'active':''}" data-period="week">Week</button>
      <button class="period-btn ${period==='month'?'active':''}" data-period="month">Month</button>
      <button class="period-btn ${period==='all'?'active':''}" data-period="all">All time</button>
    </div>`;

  return `
    <div class="topline">
      <div>
        <div class="eyebrow">Leaderboard</div>
        <h1 class="page-title">Top movers</h1>
        <p class="page-sub">${lb.totalCheckins} check-in${lb.totalCheckins===1?'':'s'} across ${lb.totalMembers} member${lb.totalMembers===1?'':'s'} this ${lb.period}.</p>
      </div>
      ${periodToggle}
    </div>

    ${emptyState || `
      ${myStandHTML}
      <div class="card" style="padding:24px 18px 0;">
        ${podiumHTML}
      </div>
      ${rankedHTML}
      ${streakKingsHTML}
    `}
  `;
}

async function renderClientMembership(){
  const b = await api.get('/api/members/me/billing');
  const sub = b.subscription;
  const plan = b.plan;
  const status = sub ? sub.status : 'none';
  const statusLabel = {
    active: 'Active', trialing: 'Trial', frozen: 'Frozen',
    cancelled: 'Cancelled', expired: 'Expired', none: 'No plan yet'
  }[status] || status;
  const accent = {
    active: 'ok', trialing: 'accent', frozen: 'warn',
    cancelled: 'bad', expired: 'bad', none: 'dim'
  }[status] || 'dim';

  const planName = plan ? escapeHtml(plan.name) : '—';
  const planPrice = plan ? plan.priceDT + ' DT' : '—';

  const rangeLabel = sub ? `${fmtDate(sub.startAt)} → ${fmtDate(sub.endAt)}` : 'No membership yet';
  const daysToEnd = sub ? sub.daysToEnd : null;

  const hero = !sub ? `
    <div class="card membership-empty">
      <div class="m-empty-emoji">🎫</div>
      <h2>You're not subscribed yet</h2>
      <p>Ask your gym's owner to set you up on a plan. Once you're in, your membership card, expiry, and renewal will all live here.</p>
    </div>` : `
    <div class="m-card ${accent}">
      <div class="m-card-top">
        <div class="m-card-gym">${escapeHtml((b.member && b.member.name) || 'Member')}</div>
        <div class="m-card-status">${statusLabel}</div>
      </div>
      <div class="m-card-plan">${planName}</div>
      <div class="m-card-price">${planPrice}</div>
      <div class="m-card-range">${rangeLabel}</div>
      <div class="m-card-bar">
        <div class="m-card-bar-fill" style="width:${Math.max(0, Math.min(100, daysToEnd !== null ? Math.round((daysToEnd / (plan.durationDays||30)) * 100) : 0))}%"></div>
      </div>
      <div class="m-card-foot">
        ${daysToEnd !== null
          ? (daysToEnd < 0
              ? `<span class="m-warn">Expired ${Math.abs(daysToEnd)} day${Math.abs(daysToEnd)===1?'':'s'} ago</span>`
              : (daysToEnd <= 5
                  ? `<span class="m-warn">⚠️ Expires in ${daysToEnd} day${daysToEnd===1?'':'s'}</span>`
                  : `<span class="m-ok">${daysToEnd} day${daysToEnd===1?'':'s'} left</span>`))
          : ''}
      </div>
    </div>`;

  const frozenNote = (sub && sub.status === 'frozen')
    ? `<div class="banner warn">❄️ <b>Membership frozen</b> until ${fmtDate(sub.frozenUntil)}. ${sub.freezeReason ? 'Reason: ' + escapeHtml(sub.freezeReason) : ''}</div>` : '';

  let pendingNote = '';
  if (sub && sub.status === 'trialing' && b.lastPayment && b.lastPayment.status === 'pending') {
    pendingNote = `<div class="banner warn">💳 Your last payment is <b>pending review</b> (${b.lastPayment.amount} DT, ${b.lastPayment.method}). Your gym owner will confirm shortly.</div>`;
  }

  return `
    <div class="topline">
      <div><div class="eyebrow">Membership</div><h1 class="page-title">Your card</h1><p class="page-sub">Plan, status, and renewals — all in one place.</p></div>
    </div>

    ${hero}
    ${frozenNote}
    ${pendingNote}

    <div class="grid cols-3" style="margin-top:18px;">
      <div class="card stat-card"><div class="stat-num">${b.paymentCount}</div><div class="stat-label">Payments made</div></div>
      <div class="card stat-card"><div class="stat-num">${b.totalPaidDT} <span style="font-size:14px;color:var(--dim);">DT</span></div><div class="stat-label">Total paid</div></div>
      <div class="card stat-card"><div class="stat-num">${plan ? plan.durationDays : '—'}</div><div class="stat-label">Days per cycle</div></div>
    </div>
  `;
}

async function renderBrowseGym(){
  const [gym, coaches, programs] = await Promise.all([
    api.get(`/api/gyms/${CURRENT_USER.gymId}`),
    api.get(`/api/gyms/${CURRENT_USER.gymId}/coaches`),
    api.get(`/api/gyms/${CURRENT_USER.gymId}/programs`)
  ]);
  const isClient = CURRENT_USER.role==='client';
  return `
    <div class="topline">
      <div>
        <div class="eyebrow">${t('member.browseGym')}</div>
        <div class="gym-header" style="margin-top:6px;">
          ${gymLogo(gym,'lg')}
          <div><h1 class="page-title" style="margin:0;">${escapeHtml(gym.name)}</h1><p class="page-sub" style="margin-top:4px;">${t('member.browseGymSub')}</p></div>
        </div>
      </div>
    </div>

    <div class="section-title">${t('member.coachesHere')}</div>
    ${coaches.length===0 ? `<div class="empty"><b>${t('owner.noCoaches')}</b></div>` :
    coaches.map(t=>`<div class="list-row">
        <div class="list-row-main">
          <div class="avatar">${initials(t.name)}</div>
          <div><div class="list-row-title">${escapeHtml(t.name)}</div><div class="list-row-sub">${t.programCount} program${t.programCount===1?'':'s'} · ${starHtml(t.avgRating)}</div></div>
        </div>
        ${isClient ? (CURRENT_USER.trainerId===t.id ? `<span class="pill done">${t('member.yourCoach')}</span>` : `<button class="btn small secondary" data-pick-trainer="${t.id}">${t('member.choose')}</button>`) : ''}
      </div>`).join('')}

    <div class="section-title">${t('member.programsHere')}</div>
    ${programs.length===0 ? `<div class="empty"><b>${t('member.noProgramsHere')}</b>${t('member.noProgramsHereDetail')}</div>` :
    programs.map(p=>`<div class="list-row">
        <div class="list-row-main">
          <div class="avatar" style="background:${p.type==='diet'?'#2e3b23':'#1e3a4a'};color:${p.type==='diet'?'var(--ok)':'var(--steel)'};">${p.type==='diet'?'D':'W'}</div>
          <div><div class="list-row-title">${escapeHtml(p.title)}</div><div class="list-row-sub">by ${escapeHtml(p.trainerName||'—')} · ${p.items.length} item${p.items.length===1?'':'s'}</div></div>
        </div>
        <span class="pill ${p.type==='diet'?'client':'trainer'}">${p.type}</span>
      </div>`).join('')}
  `;
}

/* ============================= EXERCISE DEMO MODAL ============================= */
function openExerciseModal(exerciseId){
  const ex = EXERCISES.find(e=>e.id===exerciseId);
  if(!ex) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const tags = [];
  if(ex.equipment) tags.push(`<span class="tag">${escapeHtml(ex.equipment)}</span>`);
  if(ex.mechanics) tags.push(`<span class="tag">${escapeHtml(ex.mechanics)}</span>`);
  if(ex.force) tags.push(`<span class="tag">${escapeHtml(ex.force)}</span>`);
  if(ex.level) tags.push(`<span class="tag">${escapeHtml(ex.level)}</span>`);
  const secondary = (ex.secondary && ex.secondary.length) ? ex.secondary.join(', ') : '—';
  const stepsHtml = (ex.steps || []).map((s,i) => `<li><b>Step ${i+1}.</b> ${escapeHtml(s)}</li>`).join('');
  const tipsHtml = (ex.tips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');
  const demoHtml = ex.gif
    ? `<img class="exvideo" src="/videos/${escapeHtml(ex.gif)}" alt="${escapeHtml(ex.name)} demo" />`
    : ex.video
    ? `<video class="exvideo" src="/videos/${escapeHtml(ex.video)}" controls preload="metadata" playsinline></video>`
    : `<div class="exanim-stage">${exerciseAnimSVG(ex.anim)}</div>`;
  backdrop.innerHTML = `
    <div class="modal" style="max-width:620px;">
      <div class="modal-head">
        <div>
          <h2 style="font-size:20px;margin:0;">${escapeHtml(ex.name)}</h2>
          <div style="color:var(--dim);font-size:12px;margin-top:4px;">
            <b style="color:var(--signal)">${escapeHtml(ex.primary || '')}</b>
            &nbsp;·&nbsp; Secondary: ${escapeHtml(secondary)}
          </div>
        </div>
        <button class="modal-close" id="closeExerciseModal">&times;</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px;">${tags.join('')}</div>
      ${demoHtml}
      ${stepsHtml ? `<div style="margin-top:18px;"><h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);margin:0 0 8px;">How to perform</h3><ol style="padding-left:20px;line-height:1.6;font-size:14px;color:var(--chalk);">${stepsHtml}</ol></div>` : ''}
      ${tipsHtml ? `<div style="margin-top:18px;"><h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);margin:0 0 8px;">Form tips</h3><ul style="padding-left:20px;line-height:1.6;font-size:13px;color:var(--dim);">${tipsHtml}</ul></div>` : ''}
    </div>`;
  document.body.appendChild(backdrop);
  document.getElementById('closeExerciseModal').onclick = ()=>{ const v=backdrop.querySelector('video'); if(v)v.pause(); backdrop.remove(); };
  backdrop.onclick = (e)=>{ if(e.target===backdrop){ const v=backdrop.querySelector('video'); if(v)v.pause(); backdrop.remove(); } };
}

/* ============================= PAGE EVENT WIRING ============================= */
function attachPageHandlers(){
  document.querySelectorAll('[data-open-client]').forEach(el=>{
    el.onclick = ()=> go('clientDetail', {clientId: el.dataset.openClient});
  });
  document.querySelectorAll('[data-back-to]').forEach(el=>{
    el.onclick = ()=> go(el.dataset.backTo);
  });
  document.querySelectorAll('[data-open-plan]').forEach(el=>{
    el.onclick = ()=> go('myplans', {planId: el.dataset.openPlan});
  });
  document.querySelectorAll('[data-open-member]').forEach(el=>{
    el.onclick = ()=> go('clients', {memberId: el.dataset.openMember});
  });
  document.querySelectorAll('[data-go-back]').forEach(el=>{
    el.onclick = (e)=>{ e.preventDefault(); go(el.dataset.goBack); };
  });
  document.querySelectorAll('[data-period]').forEach(el=>{
    el.onclick = ()=> go(VIEW, { ...VIEW_PARAMS, period: el.dataset.period });
  });
  document.querySelectorAll('[data-go]').forEach(el=>{
    el.onclick = ()=> go(el.dataset.go);
  });
  document.querySelectorAll('[data-set-partner]').forEach(el=>{
    el.onclick = ()=> go('messages', {partnerId: el.dataset.setPartner});
  });

  const openCreate = document.getElementById('openCreateProgram');
  if(openCreate) openCreate.onclick = openCreateProgramModal;

  const openAssign = document.getElementById('openAssignProgram');
  if(openAssign) openAssign.onclick = ()=> openAssignProgramModal(openAssign.dataset.client);

  const gymProfileForm = document.getElementById('gymProfileForm');
  if(gymProfileForm){
    gymProfileForm.onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(gymProfileForm);
      try{
        await api.patch(`/api/gyms/${CURRENT_USER.gymId}`, {
          name: fd.get('name'),
          location: fd.get('location') || '',
          description: fd.get('description') || ''
        });
        toast('Gym profile saved');
        render();
      }catch(err){ toast(err.message, false); }
    };
  }

  const logoUploadForm = document.getElementById('logoUploadForm');
  if(logoUploadForm){
    logoUploadForm.onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(logoUploadForm);
      if(!fd.get('logo') || !fd.get('logo').name){ toast('Pick a file first', false); return; }
      try{
        await api.upload(`/api/gyms/${CURRENT_USER.gymId}/logo`, fd);
        toast('Logo updated');
        render();
      }catch(err){ toast(err.message, false); }
    };
  }

  // Member detail (owner): assign / renew / freeze / cancel / unfreeze / reactivate
  const memberId = VIEW_PARAMS.memberId;
  const assignPlanForm = document.getElementById('assignPlanForm');
  if (assignPlanForm && memberId){
    assignPlanForm.onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(assignPlanForm);
      const body = {
        planId: fd.get('planId'),
        method: fd.get('method'),
        note: fd.get('note') || null,
        collectedNow: fd.get('collectedNow') === 'on',
      };
      if (fd.get('startAt')) body.startAt = fd.get('startAt');
      try{
        const res = await api.post(`/api/members/${memberId}/assign`, body);
        toast('Plan assigned — ' + (res.subscription.status==='active'?'activated':'pending payment'));
        render();
      }catch(err){ toast(err.message, false); }
    };
  }
  const renewForm = document.getElementById('renewForm');
  if (renewForm && memberId){
    renewForm.onsubmit = async (e)=>{
      e.preventDefault();
      const fd = new FormData(renewForm);
      try{
        await api.post(`/api/members/${memberId}/assign`, {
          planId: fd.get('planId'),
          method: fd.get('method'),
          collectedNow: fd.get('collectedNow') === 'on',
        });
        toast('Plan renewed');
        render();
      }catch(err){ toast(err.message, false); }
    };
  }
  const freezeBtn = document.getElementById('freezeBtn');
  if (freezeBtn && memberId){
    freezeBtn.onclick = async ()=>{
      const days = prompt('Freeze for how many days?', '30');
      if (!days) return;
      const reason = prompt('Reason (optional)?') || '';
      try{
        await api.post(`/api/members/${memberId}/freeze`, { days: Number(days), reason });
        toast('Frozen');
        render();
      }catch(err){ toast(err.message, false); }
    };
  }
  const unfreezeBtn = document.getElementById('unfreezeBtn');
  if (unfreezeBtn && memberId){
    unfreezeBtn.onclick = async ()=>{
      try{
        await api.post(`/api/members/${memberId}/unfreeze`, {});
        toast('Unfrozen');
        render();
      }catch(err){ toast(err.message, false); }
    };
  }
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn && memberId){
    cancelBtn.onclick = async ()=>{
      if (!confirm('Cancel this member\'s subscription?')) return;
      const reason = prompt('Reason (optional)?') || '';
      try{
        await api.post(`/api/members/${memberId}/cancel`, { reason });
        toast('Cancelled');
        render();
      }catch(err){ toast(err.message, false); }
    };
  }
  const reactivateBtn = document.getElementById('reactivateBtn');
  if (reactivateBtn && memberId){
    reactivateBtn.onclick = async ()=>{
      try{
        const res = await api.post(`/api/members/${memberId}/reactivate`, { collectedNow: true, method: 'cash' });
        toast('Reactivated — new sub until ' + new Date(res.subscription.endAt).toLocaleDateString());
        render();
      }catch(err){ toast(err.message, false); }
    };
  }

  document.querySelectorAll('[data-show-exercise]').forEach(el=>{
    el.onclick = ()=> openExerciseModal(el.dataset.showExercise);
  });

  document.querySelectorAll('[data-toggle-item]').forEach(el=>{
    el.onchange = async ()=>{
      const asgId = el.dataset.asg;
      const idx = +el.dataset.toggleItem;
      const asg = await api.get('/api/assignments/mine');
      const a = asg.find(x=>x.id===asgId);
      const program = a.program;
      const item = program && program.items ? program.items[idx] : null;

      // Always keep the legacy list in sync so progress% is right
      let completedItems = a.completedItems || [];
      if(el.checked){ if(!completedItems.includes(idx)) completedItems = [...completedItems, idx]; }
      else { completedItems = completedItems.filter(i=>i!==idx); }

      // Workout items with an exerciseId get the rich form too — enables PR detection.
      // Use idx-based week=1/day=1 by default; real schedule-aware UI lives elsewhere.
      const payload = { completedItems };
      if (item && item.exerciseId && el.checked) {
        const wInput = document.querySelector(`[data-pr-weight="${idx}"]`);
        const rInput = document.querySelector(`[data-pr-reps="${idx}"]`);
        const weight = wInput && wInput.value ? Number(wInput.value) : null;
        const reps   = rInput && rInput.value ? Number(rInput.value) : null;
        if (weight || reps) {
          // Attempt schedule-aware week/day (use 1/1 if no schedule)
          let weekNumber = 1, dayNumber = 1;
          if (Array.isArray(program.schedule)) {
            for (const s of program.schedule) {
              if ((s.exercises || []).find(e => e.exerciseId === item.exerciseId)) {
                weekNumber = s.weekNumber; dayNumber = s.dayNumber; break;
              }
            }
          }
          payload.exerciseCheckoff = {
            weekNumber, dayNumber,
            exerciseId: item.exerciseId,
            completed: true,
            weight, reps,
          };
        }
      }

      try{
        await api.patch(`/api/assignments/${asgId}/progress`, payload);
        render();
      }catch(e){ toast(e.message, false); }
    };
  });

  document.querySelectorAll('[data-toggle-suspend]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.toggleSuspend;
      btn.disabled = true;
      try {
        await api.post(`/api/admin/gyms/${id}/suspend`);
        toast('Gym status updated');
        render();
      } catch (e) { toast(e.message, false); btn.disabled = false; }
    };
  });

  // Owner: submit payment receipt
  const paymentUploadForm = document.getElementById('paymentUploadForm');
  if (paymentUploadForm) {
    paymentUploadForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(paymentUploadForm);
      try {
        await api.upload('/api/payments', fd);
        toast('Receipt sent — waiting for review.');
        render();
      } catch (err) { toast(err.message || 'Failed to send', false); }
    };
  }

  // Super admin: approve / reject payments
  document.querySelectorAll('[data-approve-payment]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api.post(`/api/payments/${btn.dataset.approvePayment}/approve`, {});
        toast('Payment approved — subscription extended.');
        render();
      } catch (e) { toast(e.message, false); btn.disabled = false; }
    };
  });
  document.querySelectorAll('[data-reject-payment]').forEach(btn => {
    btn.onclick = async () => {
      const reason = prompt('Reason for rejection (visible to the gym owner):');
      if (!reason) return;
      btn.disabled = true;
      try {
        await api.post(`/api/payments/${btn.dataset.rejectPayment}/reject`, { reason });
        toast('Payment rejected.');
        render();
      } catch (e) { toast(e.message, false); btn.disabled = false; }
    };
  });
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.onclick = () => go(btn.dataset.goto);
  });

  const chatForm = document.getElementById('chatForm');
  if (chatForm) {
    chatForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      chatHistory.push({ role: 'user', text });
      render();
      const scroll = document.getElementById('chatScroll');
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
      try {
        const res = await api.post('/api/chat', { messages: chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text })) });
        chatHistory.push({ role: 'assistant', text: res.reply, substitution: res.substitution, affectedPrograms: res.affectedPrograms });
      } catch (err) {
        chatHistory.push({ role: 'assistant', text: '⚠️ ' + (err.message || 'AI unavailable') });
      }
      render();
      const scroll2 = document.getElementById('chatScroll');
      if (scroll2) scroll2.scrollTop = scroll2.scrollHeight;
    };
  }

  document.querySelectorAll('[data-quick-prompt]').forEach(b => {
    b.onclick = () => {
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = b.dataset.quickPrompt;
        const btn = document.querySelector('#chatForm button[type="submit"], #chatForm button');
        if (btn) btn.click();
      }
    };
  });

  const mealForm = document.getElementById('mealForm');
  if(mealForm){
    mealForm.onsubmit = async (e)=>{
      e.preventDefault();
      const fileInput = document.getElementById('mealPhotoInput');
      const file = fileInput.files[0];
      if(!file) return;
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('caption', document.getElementById('mealCaption').value.trim());
      try{
        await api.upload('/api/meallogs', fd);
        toast('Meal logged — your coach will take a look.');
        go('meals');
      }catch(err){ toast(err.message, false); }
    };
  }

  document.querySelectorAll('.feedback-form').forEach(f=>{
    f.onsubmit = async (e)=>{
      e.preventDefault();
      const mealId = f.dataset.meal;
      const text = f.querySelector('textarea').value.trim();
      try{
        await api.patch(`/api/meallogs/${mealId}/feedback`, { feedback: text });
        toast('Note saved for client.');
        render();
      }catch(err){ toast(err.message, false); }
    };
  });

  const msgForm = document.getElementById('chatForm');
  if(msgForm){
    msgForm.onsubmit = async (e)=>{
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if(!text) return;
      const partnerId = msgForm.dataset.partner;
      try{
        await api.post('/api/messages', { toId: partnerId, text });
        input.value='';
        render();
      }catch(err){ toast(err.message, false); }
    };
  }

  document.querySelectorAll('[data-pick-trainer]').forEach(el=>{
    el.onclick = async ()=>{
      try{
        CURRENT_USER = await api.patch('/api/users/me/trainer', { trainerId: el.dataset.pickTrainer });
        toast('Coach linked.');
        render();
      }catch(err){ toast(err.message, false); }
    };
  });

  // Check in / out (client)
  const checkinBtn = document.getElementById('checkinBtn');
  if (checkinBtn) checkinBtn.onclick = async () => {
    checkinBtn.disabled = true;
    try {
      const res = await api.post('/api/attendance/checkin', {});
      if (res.alreadyOpen) {
        toast('You\'re already checked in.', true);
      } else if (res.streak && res.streak.justExtended) {
        toast(`🔥 ${res.streak.current}-day streak. Nice.`, true);
      } else {
        toast('Checked in. Let\'s go.', true);
      }
      render();
    } catch (e) { toast(e.message, false); checkinBtn.disabled = false; }
  };
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) checkoutBtn.onclick = async () => {
    checkoutBtn.disabled = true;
    try { await api.post('/api/attendance/checkout', {}); render(); }
    catch (e) { toast(e.message, false); checkoutBtn.disabled = false; }
  };

  // Notification bell: mark single / all read
  document.querySelectorAll('[data-notif-id]').forEach(b => {
    b.onclick = async () => {
      try { await api.post(`/api/notifications/${b.dataset.notifId}/read`, {}); render(); }
      catch (e) { /* ignore */ }
    };
  });
  const notifAll = document.getElementById('notifMarkAll');
  if (notifAll) notifAll.onclick = async () => {
    try { await api.post('/api/notifications/read-all', {}); render(); }
    catch (e) { /* ignore */ }
  };
  const notifBell = document.getElementById('notifBell');
  if (notifBell) {
    notifBell.onclick = async (e) => {
      e.stopPropagation();
      const panel = document.getElementById('notifPanel');
      if (!panel) return;
      const willOpen = !panel.classList.contains('open');
      panel.classList.toggle('open');
      if (willOpen) {
        try {
          const r = await api.get('/api/notifications');
          UNREAD_NOTIFS = r.unread;
          updateNotifBadge();
          const list = document.getElementById('notifList');
          if (list) {
            list.innerHTML = r.items.length === 0
              ? `<div class="empty" style="padding:18px;border:none;color:var(--dim);">Nothing here yet.</div>`
              : r.items.map(n => `
                <button class="notif-item ${n.read?'':'unread'}" data-notif-id="${n.id}">
                  <div class="notif-title">${escapeHtml(n.title)}</div>
                  <div class="notif-body">${escapeHtml(n.body || '')}</div>
                  <div class="notif-time">${fmtDate(n.createdAt)} · ${fmtTime(n.createdAt)}</div>
                </button>`).join('');
          }
        } catch (e) { /* ignore */ }
      }
    };
  }

  const starPicker = document.getElementById('starPicker');
  if(starPicker){
    starPicker.querySelectorAll('[data-star]').forEach(s=>{
      s.onclick = ()=>{
        const val = +s.dataset.star;
        starPicker.dataset.value = val;
        starPicker.querySelectorAll('[data-star]').forEach(s2=>{
          s2.classList.toggle('off', +s2.dataset.star > val);
        });
      };
    });
  }
  const submitReview = document.getElementById('submitReviewBtn');
  if(submitReview){
    submitReview.onclick = async ()=>{
      const rating = +document.getElementById('starPicker').dataset.value || 0;
      if(rating===0){ alert('Pick a star rating first.'); return; }
      const comment = document.getElementById('reviewComment').value.trim();
      try{
        await api.post('/api/reviews', { trainerId: CURRENT_USER.trainerId, rating, comment });
        toast('Thanks for the feedback!');
        render();
      }catch(err){ toast(err.message, false); }
    };
  }
}
