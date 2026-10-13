// =========================================================
// PennyLedger — shared behaviors
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCurrency();
  initDateFormat();
  setActiveNav();
  setupSidebarToggle();
  setupPasswordToggles();
  setupSignupValidation();
  animateProgressBars();
  setupModals();
  setupTransactionFilters();
  setupLogout();
  setupScrollReveal();
});

/* Logout — redirects to login screen preserving theme and currency */
function setupLogout(){
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('Logging you out…');
      const target = 'login.html' + getQueryString();
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
   Theme & Currency State Management
   Settings are stored in localStorage when available and carried
   across internal page links via URL parameters (?theme=dark&currency=PHP)
   to ensure persistence in prototypes, sandboxed environments,
   and normal browsing alike.
   ========================================================= */

const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar (USD)' },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso (PHP)' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (EUR)' }
};

function normalizeCurrency(input){
  if (!input) return 'USD';
  const str = input.trim().toUpperCase();
  if (str === 'PHP' || str === '₱' || str.includes('PESO')) return 'PHP';
  if (str === 'EUR' || str === '€' || str.includes('EURO')) return 'EUR';
  if (str === 'USD' || str === '$' || str.includes('DOLLAR')) return 'USD';
  return 'USD';
}

function getCurrency(){
  const params = new URLSearchParams(location.search);
  const paramVal = params.get('currency');
  if (paramVal) return normalizeCurrency(paramVal);
  try {
    const saved = localStorage.getItem('pennyledger_currency');
    if (saved) return normalizeCurrency(saved);
  } catch(e){}
  return 'USD';
}

function getCurrencySymbol(code){
  const c = normalizeCurrency(code || getCurrency());
  return CURRENCIES[c] ? CURRENCIES[c].symbol : '$';
}

function formatCurrency(amount, includeSign = false){
  const sym = getCurrencySymbol();
  const num = Number(amount) || 0;
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (includeSign) {
    const sign = num > 0 ? '+' : (num < 0 ? '-' : '');
    return `${sign}${sym}${formatted}`;
  }
  return `${num < 0 ? '-' : ''}${sym}${formatted}`;
}

function getQueryString(){
  const theme = document.documentElement.getAttribute('data-theme');
  const currency = getCurrency();
  const dateformat = getDateFormat();
  const params = new URLSearchParams();
  if (theme === 'dark') params.set('theme', 'dark');
  if (currency && currency !== 'USD') params.set('currency', currency);
  if (dateformat && dateformat !== 'MMM D, YYYY') params.set('dateformat', dateformat);
  const q = params.toString();
  return q ? '?' + q : '';
}

function updateInternalLinks(){
  const theme = document.documentElement.getAttribute('data-theme');
  const currency = getCurrency();
  const dateformat = getDateFormat();
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const path = href.split('?')[0];
    if (!path.endsWith('.html')) return;
    const url = new URL(href, location.href);
    if (theme === 'dark') url.searchParams.set('theme', 'dark');
    else url.searchParams.delete('theme');
    if (currency && currency !== 'USD') url.searchParams.set('currency', currency);
    else url.searchParams.delete('currency');
    if (dateformat && dateformat !== 'MMM D, YYYY') url.searchParams.set('dateformat', dateformat);
    else url.searchParams.delete('dateformat');
    a.setAttribute('href', path + (url.search ? url.search : ''));
  });
}

function updateThemeLinks(theme){
  updateInternalLinks();
}

function initTheme(){
  const params = new URLSearchParams(location.search);
  let theme = params.get('theme');
  if (!theme) {
    try { theme = localStorage.getItem('pennyledger_theme'); } catch(e){}
  }
  theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateInternalLinks();

  document.querySelectorAll('.theme-checkbox').forEach(box => {
    box.checked = theme === 'dark';
    box.addEventListener('change', () => setTheme(box.checked ? 'dark' : 'light'));
  });
}

function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('pennyledger_theme', theme); } catch(e){}
  document.querySelectorAll('.theme-checkbox').forEach(box => { box.checked = theme === 'dark'; });

  const url = new URL(location.href);
  if (theme === 'dark') url.searchParams.set('theme', 'dark');
  else url.searchParams.delete('theme');
  history.replaceState({}, '', url);

  updateInternalLinks();
}

function applyCurrencyToDom(symbol){
  if (!document.body) return;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node){
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toUpperCase();
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (parent.closest('#s-currency') || parent.closest('.no-currency-replace')) return NodeFilter.FILTER_REJECT;
        if (/[\$₱€£¥]/.test(node.nodeValue)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(node => {
    node.nodeValue = node.nodeValue.replace(/[\$₱€£¥]/g, symbol);
  });
}

function setCurrency(code){
  const curr = normalizeCurrency(code);
  const symbol = getCurrencySymbol(curr);

  try {
    localStorage.setItem('pennyledger_currency', curr);
  } catch(e){}

  const url = new URL(location.href);
  if (curr !== 'USD') {
    url.searchParams.set('currency', curr);
  } else {
    url.searchParams.delete('currency');
  }
  history.replaceState({}, '', url);

  updateInternalLinks();

  const select = document.getElementById('s-currency');
  if (select && select.value !== curr) {
    select.value = curr;
  }

  applyCurrencyToDom(symbol);

  document.dispatchEvent(new CustomEvent('currencychange', { detail: { currency: curr, symbol } }));
}

function initCurrency(){
  const curr = getCurrency();
  const symbol = getCurrencySymbol(curr);

  const select = document.getElementById('s-currency');
  if (select) {
    select.value = curr;
    // Currency now applies the moment a new option is picked, not just
    // when "Save Changes" is clicked (the submit handler in settings.html
    // still calls setCurrency too, which is a harmless no-op here).
    select.addEventListener('change', () => {
      setCurrency(select.value);
      showToast(`Currency changed to ${CURRENCIES[normalizeCurrency(select.value)].name}`);
    });
  }

  applyCurrencyToDom(symbol);
  updateInternalLinks();
}

// =========================================================
// Date Format System
// Supported formats:
// - 'MMM D, YYYY' (e.g. Mar 14, 2026)
// - 'DD/MM/YYYY'  (e.g. 14/03/2026)
// - 'MM/DD/YYYY'  (e.g. 03/14/2026)
// =========================================================

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function normalizeDateFormat(input){
  if (!input) return 'MMM D, YYYY';
  const str = input.trim();
  if (str === 'DD/MM/YYYY' || str === '14/03/2026' || str.toLowerCase() === 'dmy') return 'DD/MM/YYYY';
  if (str === 'MM/DD/YYYY' || str === '03/14/2026' || str.toLowerCase() === 'mdy') return 'MM/DD/YYYY';
  return 'MMM D, YYYY';
}

function getDateFormat(){
  const params = new URLSearchParams(location.search);
  const paramVal = params.get('dateformat');
  if (paramVal) return normalizeDateFormat(paramVal);
  try {
    const saved = localStorage.getItem('pennyledger_dateformat');
    if (saved) return normalizeDateFormat(saved);
  } catch(e){}
  return 'MMM D, YYYY';
}

function parseDate(input){
  if (!input) return null;
  if (input instanceof Date && !isNaN(input.getTime())) {
    return { year: input.getFullYear(), month: input.getMonth() + 1, day: input.getDate() };
  }
  const str = String(input).trim();

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch){
    return { year: parseInt(isoMatch[1], 10), month: parseInt(isoMatch[2], 10), day: parseInt(isoMatch[3], 10) };
  }

  // Month Day, Year (e.g. "Mar 14, 2026" or "Aug 31, 2026" or "Mar 12")
  const mdyTextMatch = str.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (mdyTextMatch){
    const mStr = mdyTextMatch[1].slice(0, 3).toLowerCase();
    const month = MONTH_MAP[mStr];
    if (month){
      const day = parseInt(mdyTextMatch[2], 10);
      const year = mdyTextMatch[3] ? parseInt(mdyTextMatch[3], 10) : 2026;
      return { year, month, day };
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch){
    const n1 = parseInt(slashMatch[1], 10);
    const n2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    if (n1 > 12) {
      return { year, month: n2, day: n1 };
    } else if (n2 > 12) {
      return { year, month: n1, day: n2 };
    } else {
      const currFmt = getDateFormat();
      if (currFmt === 'DD/MM/YYYY') {
        return { year, month: n2, day: n1 };
      } else {
        return { year, month: n1, day: n2 };
      }
    }
  }

  return null;
}

function formatDateParts(parts, formatType){
  if (!parts) return '';
  const fmt = normalizeDateFormat(formatType || getDateFormat());
  const y = parts.year;
  const m = parts.month;
  const d = parts.day;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const monthName = MONTH_NAMES_SHORT[m - 1] || 'Jan';

  if (fmt === 'DD/MM/YYYY') {
    return `${dd}/${mm}/${y}`;
  } else if (fmt === 'MM/DD/YYYY') {
    return `${mm}/${dd}/${y}`;
  }
  return `${monthName} ${d}, ${y}`;
}

function formatDate(date, formatType){
  const parts = parseDate(date);
  return parts ? formatDateParts(parts, formatType) : '';
}

function applyDateFormatToDom(formatType){
  const fmt = normalizeDateFormat(formatType || getDateFormat());
  const elements = document.querySelectorAll('.td-date, .td-gen, .tx-date, [data-raw-date]');

  elements.forEach(el => {
    if (!el.dataset.rawDate) {
      const parsed = parseDate(el.textContent.trim());
      if (parsed) {
        el.dataset.rawDate = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
      }
    }

    if (el.dataset.rawDate) {
      const parts = parseDate(el.dataset.rawDate);
      if (parts) {
        el.textContent = formatDateParts(parts, fmt);
      }
    }
  });
}

function setDateFormat(formatType){
  const fmt = normalizeDateFormat(formatType);

  try {
    localStorage.setItem('pennyledger_dateformat', fmt);
  } catch(e){}

  const url = new URL(location.href);
  if (fmt !== 'MMM D, YYYY') {
    url.searchParams.set('dateformat', fmt);
  } else {
    url.searchParams.delete('dateformat');
  }
  history.replaceState({}, '', url);

  updateInternalLinks();

  const select = document.getElementById('s-dateformat');
  if (select && select.value !== fmt) {
    select.value = fmt;
  }

  applyDateFormatToDom(fmt);

  document.dispatchEvent(new CustomEvent('dateformatchange', { detail: { format: fmt } }));
}

function initDateFormat(){
  const fmt = getDateFormat();

  const select = document.getElementById('s-dateformat');
  if (select) {
    select.value = fmt;
    if (!select.dataset.dateFormatBound) {
      select.dataset.dateFormatBound = 'true';
      select.addEventListener('change', () => {
        setDateFormat(select.value);
        showToast(`Date format changed to ${select.options[select.selectedIndex]?.text || select.value}`);
      });
    }
  }

  applyDateFormatToDom(fmt);
  updateInternalLinks();
}

window.getCurrency = getCurrency;
window.getCurrencySymbol = getCurrencySymbol;
window.formatCurrency = formatCurrency;
window.setCurrency = setCurrency;
window.applyCurrencyToDom = applyCurrencyToDom;

window.getDateFormat = getDateFormat;
window.setDateFormat = setDateFormat;
window.formatDate = formatDate;
window.applyDateFormatToDom = applyDateFormatToDom;

window.addEventListener('popstate', () => {
  initTheme();
  initCurrency();
  initDateFormat();
});

/* Highlight the current page in the sidebar nav */
function setActiveNav(){
  const file = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.side-nav a').forEach(link => {
    const href = (link.getAttribute('href') || '').split('?')[0];
    if (href === file) link.classList.add('active');
    else link.classList.remove('active');
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
    const target = 'dashboard.html' + getQueryString();
    setTimeout(() => { window.location.href = target; }, 1100);
  });
}

/* Login form -> straight to dashboard with a toast */
document.addEventListener('DOMContentLoaded', () => {
  const login = document.querySelector('#login-form');
  if (!login) return;
  login.addEventListener('submit', e => {
    e.preventDefault();
    showToast('Welcome back — signing you in…');
    const target = 'dashboard.html' + getQueryString();
    setTimeout(() => { window.location.href = target; }, 900);
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
      const isoStr = today.toISOString().split('T')[0];
      const dateStr = formatDate(today);
      const sym = getCurrencySymbol();

      const tbody = document.querySelector('#tx-table-body');
      if (tbody){
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="td-desc">${escapeHtml(name)}</td>
          <td class="td-category"><span class="pill ${pillClass(category)}">${category}</span></td>
          <td class="td-date" data-raw-date="${isoStr}">${dateStr}</td>
          <td class="td-amount ${isIncome ? 'amt-pos' : ''}">${isIncome ? '+' : '-'}${sym}${amount.toFixed(2)}</td>`;
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
      const sym = getCurrencySymbol();

      const grid = document.querySelector('#goals-grid');
      if (grid){
        const card = document.createElement('div');
        card.className = 'goal-card';
        card.style.animation = 'rise .4s ease both';
        card.innerHTML = goalCardMarkup();
        updateGoalCard(card, { name, target, saved, date: by });
        grid.prepend(card);
      }

      goalForm.reset();
      document.getElementById('add-goal-modal').classList.remove('open');
      showToast('Goal added');
    });
  }

  // Add Budget -> prepend a progress row to the Budget Progress card (if present)
  const budgetForm = document.querySelector('#add-budget-form');
  if (budgetForm){
    const amountInput = budgetForm.querySelector('#budget-amount');
    const amountField = document.getElementById('budget-amount-field');
    const amountError = document.getElementById('budget-amount-error');

    function setBudgetAmountError(message){
      if (amountField) amountField.classList.toggle('has-error', !!message);
      if (amountError) amountError.textContent = message || '';
    }
    amountInput.addEventListener('input', () => setBudgetAmountError(''));

    budgetForm.addEventListener('submit', e => {
      e.preventDefault();
      const category = budgetForm.querySelector('#budget-category').value;
      const amountRaw = amountInput.value.trim();
      const amount = parseFloat(amountRaw);

      if (!amountRaw || isNaN(amount) || amount <= 0){
        setBudgetAmountError(!amountRaw || isNaN(amount) ? 'Enter a budget amount.' : 'Amount must be greater than 0.');
        amountInput.focus();
        return;
      }
      setBudgetAmountError('');

      const sym = getCurrencySymbol();
      const list = document.querySelector('#budget-progress-list');
      if (list){
        const row = document.createElement('div');
        row.className = 'prog-row';
        row.style.animation = 'rise .4s ease both';
        row.innerHTML = `
          <div class="prow-top"><span>${escapeHtml(category)}</span><span>${sym}0.00 / ${sym}${amount.toFixed(2)}</span></div>
          <div class="prog-track"><div class="prog-fill fill-green" data-value="0" style="width:0%"></div></div>`;
        list.prepend(row);
      }

      budgetForm.reset();
      document.getElementById('add-budget-modal').classList.remove('open');
      showToast('Budget added');
    });
  }

  // Estimate Monthly Income -> update the Monthly Income stat card (if present)
  const incomeForm = document.querySelector('#estimate-income-form');
  if (incomeForm){
    incomeForm.addEventListener('submit', e => {
      e.preventDefault();
      const amount = parseFloat(incomeForm.querySelector('#income-amount').value || '0');
      const frequency = incomeForm.querySelector('#income-frequency').value;

      const MULTIPLIER = { weekly: 4.33, biweekly: 2.165, monthly: 1, annually: 1 / 12 };
      const monthly = amount * (MULTIPLIER[frequency] ?? 1);

      const statEl = document.querySelector('#monthly-income-value');
      if (statEl){
        statEl.textContent = formatCurrency(monthly);
      }

      incomeForm.reset();
      document.getElementById('estimate-income-modal').classList.remove('open');
      showToast('Monthly income estimate updated');
    });
  }

  // Edit Goal -> update name / target / saved / date on a specific goal card
  const editGoalForm = document.querySelector('#edit-goal-form');
  const goalsGrid = document.querySelector('#goals-grid');
  if (editGoalForm && goalsGrid){
    let editingCard = null;

    goalsGrid.addEventListener('click', e => {
      const btn = e.target.closest('.gc-edit');
      if (!btn) return;
      editingCard = btn.closest('.goal-card');
      editGoalForm.querySelector('#edit-goal-name').value = editingCard.dataset.name || '';
      editGoalForm.querySelector('#edit-goal-target').value = editingCard.dataset.target || '';
      editGoalForm.querySelector('#edit-goal-saved').value = editingCard.dataset.saved || '0';
      editGoalForm.querySelector('#edit-goal-date').value = editingCard.dataset.date === 'No date set' ? '' : (editingCard.dataset.date || '');
      document.getElementById('edit-goal-modal').classList.add('open');
    });

    editGoalForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!editingCard) return;
      updateGoalCard(editingCard, {
        name: editGoalForm.querySelector('#edit-goal-name').value.trim() || editingCard.dataset.name,
        target: parseFloat(editGoalForm.querySelector('#edit-goal-target').value || '0'),
        saved: parseFloat(editGoalForm.querySelector('#edit-goal-saved').value || '0'),
        date: editGoalForm.querySelector('#edit-goal-date').value.trim() || 'No date set'
      });
      editingCard = null;
      document.getElementById('edit-goal-modal').classList.remove('open');
      showToast('Goal updated');
    });
  }
}

/* Transactions page: category / month / type filters + archive (front-end only) */
function setupTransactionFilters(){
  const tbody = document.querySelector('#tx-table-body');
  if (!tbody) return;

  const searchEl   = document.getElementById('tx-search');
  const categoryEl = document.getElementById('tx-filter-category');
  const monthEl    = document.getElementById('tx-filter-month');
  const resetEl    = document.getElementById('tx-filter-reset');
  const typeSeg    = document.getElementById('tx-type-seg');
  const viewSeg    = document.getElementById('tx-view-seg');
  const countEl    = document.getElementById('tx-result-count');
  const archCount  = document.getElementById('tx-archived-count');
  const emptyRow   = document.getElementById('tx-empty-row');
  const emptyText  = document.getElementById('tx-empty-text');

  const state = { type: 'all', view: 'active' };
  const getRows = () => Array.from(tbody.querySelectorAll('tr')).filter(r => r !== emptyRow);
  const rowCategory = r => (r.querySelector('.td-category')?.textContent || '').trim();
  const rowMonth = r => (r.querySelector('[data-raw-date]')?.dataset.rawDate || '').slice(0, 7);
  const rowIsIncome = r => !!r.querySelector('.td-amount.amt-pos');

  // Restore archived state saved from a previous visit (or from the
  // Settings › Archive page) so it survives a page reload.
  getRows().forEach(row => {
    const id = row.dataset.txId;
    if (id && isArchivedRecord(ARCHIVE_TX_KEY, id)) row.dataset.archived = 'true';
  });

  // Fill the category + month dropdowns from the rows that are on the page
  const cats = [...new Set(getRows().map(rowCategory).filter(Boolean))].sort();
  cats.forEach(c => categoryEl.add(new Option(c, c)));

  const months = [...new Set(getRows().map(rowMonth).filter(Boolean))].sort().reverse();
  months.forEach(key => {
    const [y, mo] = key.split('-').map(Number);
    const label = new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    monthEl.add(new Option(label, key));
  });

  function apply(){
    const q = (searchEl.value || '').trim().toLowerCase();
    let shown = 0, inView = 0, archived = 0;

    getRows().forEach(row => {
      const isArchived = row.dataset.archived === 'true';
      if (isArchived) archived++;

      const btn = row.querySelector('.btn-archive');
      if (btn){
        btn.querySelector('span').textContent = isArchived ? 'Restore' : 'Archive';
        btn.setAttribute('aria-label', isArchived ? 'Restore transaction' : 'Archive transaction');
      }

      const inThisView = state.view === 'archived' ? isArchived : !isArchived;
      if (inThisView) inView++;

      const text = ((row.querySelector('.td-desc')?.textContent || '') + ' ' + rowCategory(row)).toLowerCase();
      const match = inThisView
        && (!categoryEl.value || rowCategory(row) === categoryEl.value)
        && (!monthEl.value || rowMonth(row) === monthEl.value)
        && (state.type === 'all' || (state.type === 'income') === rowIsIncome(row))
        && (!q || text.includes(q));

      row.hidden = !match;
      if (match) shown++;
    });

    if (archCount) archCount.textContent = archived;
    if (countEl) countEl.textContent = `Showing ${shown} of ${inView} ${state.view === 'archived' ? 'archived ' : ''}transactions`;
    if (emptyRow){
      emptyRow.hidden = shown > 0;
      if (emptyText) emptyText.textContent = inView === 0
        ? (state.view === 'archived' ? 'No archived transactions yet.' : 'No active transactions.')
        : 'No transactions match your filters.';
    }
  }

  function bindSeg(seg, key, attr){
    seg.addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      state[key] = btn.dataset[attr];
      apply();
    });
  }
  bindSeg(typeSeg, 'type', 'type');
  bindSeg(viewSeg, 'view', 'view');

  searchEl.addEventListener('input', apply);
  categoryEl.addEventListener('change', apply);
  monthEl.addEventListener('change', apply);

  resetEl.addEventListener('click', () => {
    searchEl.value = '';
    categoryEl.value = '';
    monthEl.value = '';
    state.type = 'all';
    typeSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'all'));
    apply();
  });

  // Archive / Restore a single log
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.btn-archive');
    if (!btn) return;
    const row = btn.closest('tr');
    const id = row.dataset.txId;
    const nowArchived = row.dataset.archived !== 'true';
    row.dataset.archived = nowArchived ? 'true' : 'false';

    if (id){
      if (nowArchived){
        addArchivedRecord(ARCHIVE_TX_KEY, {
          id,
          desc: row.querySelector('.td-desc')?.textContent.trim() || '',
          category: rowCategory(row),
          date: row.querySelector('.td-date')?.textContent.trim() || '',
          amount: row.querySelector('.td-amount')?.textContent.trim() || ''
        });
      } else {
        removeArchivedRecord(ARCHIVE_TX_KEY, id);
      }
    }

    apply();
    showToast(nowArchived ? 'Transaction archived' : 'Transaction restored');
  });

  apply();
}

/* Goal card helpers (shared by Add Goal and Edit Goal) */
function goalMoney(n){
  return getCurrencySymbol() + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function goalCardMarkup(){
  return `
    <div class="gc-top">
      <div class="gc-icon"><i></i></div>
      <div><strong></strong><span></span></div>
      <button type="button" class="gc-edit" aria-label="Edit goal" title="Edit goal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>
    </div>
    <div class="prog-track"><div class="prog-fill fill-green"></div></div>
    <div class="gc-foot"><span></span><b></b></div>`;
}

function updateGoalCard(card, goal){
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
  card.dataset.name = goal.name;
  card.dataset.target = goal.target;
  card.dataset.saved = goal.saved;
  card.dataset.date = goal.date;

  card.querySelector('.gc-top strong').textContent = goal.name;
  card.querySelector('.gc-top span').textContent = 'Target: ' + goal.date;

  const fill = card.querySelector('.prog-fill');
  fill.dataset.value = pct;
  fill.style.width = pct + '%';

  card.querySelector('.gc-foot span').textContent = `${goalMoney(goal.saved)} saved of ${goalMoney(goal.target)}`;
  card.querySelector('.gc-foot b').textContent = pct + '%';
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
/* =========================================================
   Shared Archive Store (front-end only)
   ---------------------------------------------------------
   Transactions and Reports each have their own "Archive" button
   that hides an item from its normal list. To let the Settings ›
   Archive page show every archived item in one place — and let it
   restore them — the archived state is mirrored into localStorage
   here. This is a stand-in for a real backend: it only tracks which
   items are archived (plus a little display text), not the app's
   actual transaction/report data.
========================================================= */
const ARCHIVE_TX_KEY = 'pennyledger_archived_transactions';
const ARCHIVE_LOG_KEY = 'pennyledger_archived_reports';

function readArchiveList(key){
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch(e){ return []; }
}
function writeArchiveList(key, list){
  try { localStorage.setItem(key, JSON.stringify(list)); } catch(e){}
}
function isArchivedRecord(key, id){
  return readArchiveList(key).some(item => item.id === id);
}
function addArchivedRecord(key, record){
  const list = readArchiveList(key).filter(item => item.id !== record.id);
  list.push(record);
  writeArchiveList(key, list);
}
function removeArchivedRecord(key, id){
  writeArchiveList(key, readArchiveList(key).filter(item => item.id !== id));
}
window.PennyArchive = {
  ARCHIVE_TX_KEY, ARCHIVE_LOG_KEY,
  readArchiveList, addArchivedRecord, removeArchivedRecord, isArchivedRecord
};

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