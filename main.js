// =========================================================
// PennyLedger — shared behaviors
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setActiveNav();
  setupSidebarToggle();
  setupPasswordToggles();
  setupSignupValidation();
  animateProgressBars();
  setupModals();
  setupLogout();
  setupScrollReveal();
});

/* Logout — clears nothing (there's no real session), just sends the
   person back to the login screen with a quick confirmation toast. */
function setupLogout(){
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('Logging you out…');
      const theme = document.documentElement.getAttribute('data-theme');
      const target = 'login.html' + (theme === 'dark' ? '?theme=dark' : '');
      setTimeout(() => { window.location.href = target; }, 650);
    });
  });
}

/* Fade-in-on-scroll for landing page sections (feature cards, security
   section, CTA band) — complements the hero's entrance animation. */
function setupScrollReveal(){
  const targets = document.querySelectorAll('.reveal, .reveal-group');
  if (!targets.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(t => io.observe(t));
}

/* =========================================================
   Theme (light/dark)
   PennyLedger is a static, multi-page prototype with no
   backend, and this file renders as a sandboxed artifact —
   so localStorage/sessionStorage are off the table. Instead
   the choice lives in a `?theme=dark` URL param: it's applied
   before first paint by a tiny inline script in each <head>,
   and every internal link is rewritten to carry it forward as
   you click through the site.
   ========================================================= */
function initTheme(){
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeLinks(theme);

  document.querySelectorAll('.theme-checkbox').forEach(box => {
    box.checked = theme === 'dark';
    box.addEventListener('change', () => setTheme(box.checked ? 'dark' : 'light'));
  });
}

function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-checkbox').forEach(box => { box.checked = theme === 'dark'; });

  const url = new URL(location.href);
  if (theme === 'dark') url.searchParams.set('theme', 'dark');
  else url.searchParams.delete('theme');
  history.replaceState({}, '', url);

  updateThemeLinks(theme);
}

function updateThemeLinks(theme){
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    const path = href ? href.split('?')[0] : '';
    if (!path.endsWith('.html')) return;
    const url = new URL(href, location.href);
    if (theme === 'dark') url.searchParams.set('theme', 'dark');
    else url.searchParams.delete('theme');
    a.setAttribute('href', path + url.search);
  });
}

/* Highlight the current page in the sidebar nav */
function setActiveNav(){
  const file = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.side-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === file) link.classList.add('active');
  });
}

/* Mobile sidebar drawer */
function setupSidebarToggle(){
  const toggle = document.querySelector('.hamburger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!toggle || !sidebar || !overlay) return;

  const open = () => { sidebar.classList.add('open'); overlay.classList.add('open'); };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };

  toggle.addEventListener('click', open);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* Show/hide password fields */
function setupPasswordToggles(){
  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.innerHTML = isPw ? eyeOffIcon() : eyeIcon();
    });
  });
}

function eyeIcon(){
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function eyeOffIcon(){
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.6 3.63M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

/* Basic client-side validation for the signup form */
function setupSignupValidation(){
  const form = document.querySelector('#signup-form');
  if (!form) return;
  const pw = form.querySelector('#password');
  const verify = form.querySelector('#verify-password');
  const hint = form.querySelector('#verify-hint');

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (pw.value.length < 6){
      hint.textContent = 'Password should be at least 6 characters.';
      pw.focus();
      return;
    }
    if (pw.value !== verify.value){
      hint.textContent = "Passwords don't match.";
      verify.focus();
      return;
    }
    hint.textContent = '';
    showToast('Account created — redirecting to your dashboard…');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1100);
  });
}

/* Login form -> straight to dashboard with a toast */
document.addEventListener('DOMContentLoaded', () => {
  const login = document.querySelector('#login-form');
  if (!login) return;
  login.addEventListener('submit', e => {
    e.preventDefault();
    showToast('Welcome back — signing you in…');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
  });
});

/* Animate width-based progress bars once they're on screen */
function animateProgressBars(){
  const bars = document.querySelectorAll('.prog-fill[data-value]');
  if (!bars.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        const el = entry.target;
        el.style.width = el.dataset.value + '%';
        io.unobserve(el);
      }
    });
  }, { threshold: 0.2 });
  bars.forEach(b => io.observe(b));
}

/* Modal open/close wiring, shared by Add Transaction / Add Goal dialogs */
function setupModals(){
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById(btn.dataset.openModal);
      if (modal) modal.classList.add('open');
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('open'));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });

  // Add Transaction -> prepend a row to the transactions table (if present)
  const txForm = document.querySelector('#add-transaction-form');
  if (txForm){
    txForm.addEventListener('submit', e => {
      e.preventDefault();
      const name = txForm.querySelector('#tx-name').value.trim() || 'Untitled transaction';
      const category = txForm.querySelector('#tx-category').value;
      const amountRaw = parseFloat(txForm.querySelector('#tx-amount').value || '0');
      const isIncome = category === 'Income';
      const amount = Math.abs(amountRaw);
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

      const tbody = document.querySelector('#tx-table-body');
      if (tbody){
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="td-desc">${escapeHtml(name)}</td>
          <td class="td-category"><span class="pill ${pillClass(category)}">${category}</span></td>
          <td class="td-date">${dateStr}</td>
          <td class="td-amount ${isIncome ? 'amt-pos' : ''}">${isIncome ? '+' : '-'}$${amount.toFixed(2)}</td>`;
        row.style.animation = 'rise .4s ease both';
        tbody.prepend(row);
      }

      txForm.reset();
      document.getElementById('add-transaction-modal').classList.remove('open');
      showToast('Transaction added');
    });
  }

  // Add Goal -> append a card to the goals grid (if present)
  const goalForm = document.querySelector('#add-goal-form');
  if (goalForm){
    goalForm.addEventListener('submit', e => {
      e.preventDefault();
      const name = goalForm.querySelector('#goal-name').value.trim() || 'New goal';
      const target = parseFloat(goalForm.querySelector('#goal-target').value || '0');
      const saved = parseFloat(goalForm.querySelector('#goal-saved').value || '0');
      const by = goalForm.querySelector('#goal-date').value.trim() || 'No date set';
      const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

      const grid = document.querySelector('#goals-grid');
      if (grid){
        const card = document.createElement('div');
        card.className = 'goal-card';
        card.style.animation = 'rise .4s ease both';
        card.innerHTML = `
          <div class="gc-top">
            <div class="gc-icon"><i></i></div>
            <div>
              <strong>${escapeHtml(name)}</strong>
              <span>Target: ${escapeHtml(by)}</span>
            </div>
          </div>
          <div class="prog-track"><div class="prog-fill fill-green" style="width:${pct}%"></div></div>
          <div class="gc-foot"><span>$${saved.toLocaleString()} saved of $${target.toLocaleString()}</span><b>${pct}%</b></div>`;
        grid.prepend(card);
      }

      goalForm.reset();
      document.getElementById('add-goal-modal').classList.remove('open');
      showToast('Goal added');
    });
  }
}

function pillClass(category){
  const map = { Income:'pill-green', Groceries:'pill-green', Entertainment:'pill-blue', Transportation:'pill-blue',
    Housing:'pill-gray', Utilities:'pill-gray', 'Dining Out':'pill-red' };
  return map[category] || 'pill-gray';
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* Toast helper */
let toastTimer;
function showToast(message){
  let toast = document.querySelector('.toast');
  if (!toast){
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>${message}</span>`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
