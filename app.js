/* ============================================
   FLOWBUDGET — App Logic
   Pure user-driven, zero fake data
   ============================================ */

// ---- State ----
let state = {
  onboarded: false,
  salary: 0,
  savings: 0,
  extraIncome: 0,
  currency: '$',
  theme: 'dark',
  categories: [],   // empty by default — user creates them
  expenses: [],     // empty by default
  goals: [],
  recurring: [],
  lastReset: null,
  monthHistory: []
};

// Suggested categories shown during onboarding (not added automatically)
const SUGGESTED_CATEGORIES = [
  { id: 'rent',          name: 'Rent',          icon: '🏠', color: '#6366f1' },
  { id: 'food',          name: 'Food',          icon: '🍔', color: '#f97316' },
  { id: 'shopping',      name: 'Shopping',      icon: '🛍️', color: '#ec4899' },
  { id: 'transport',     name: 'Transport',     icon: '🚗', color: '#06b6d4' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎮', color: '#a855f7' },
  { id: 'savings',       name: 'Savings',       icon: '💰', color: '#10b981' },
  { id: 'health',        name: 'Health',        icon: '💊', color: '#f43f5e' },
  { id: 'education',     name: 'Education',     icon: '📚', color: '#0ea5e9' },
  { id: 'travel',        name: 'Travel',        icon: '✈️', color: '#f59e0b' },
  { id: 'other',         name: 'Other',         icon: '📦', color: '#94a3b8' }
];

const KEYWORD_MAP = {
  uber: 'transport', lyft: 'transport', metro: 'transport', bus: 'transport',
  taxi: 'transport', fuel: 'transport', gas: 'transport', parking: 'transport',
  mcdonalds: 'food', burger: 'food', pizza: 'food', sushi: 'food',
  restaurant: 'food', cafe: 'food', coffee: 'food', grocery: 'food',
  groceries: 'food', supermarket: 'food', walmart: 'food', lidl: 'food',
  carrefour: 'food', starbucks: 'food', subway: 'food',
  zara: 'shopping', amazon: 'shopping', nike: 'shopping', adidas: 'shopping',
  ikea: 'shopping', apple: 'shopping', store: 'shopping', shop: 'shopping',
  netflix: 'entertainment', spotify: 'entertainment', youtube: 'entertainment',
  steam: 'entertainment', cinema: 'entertainment', movie: 'entertainment',
  rent: 'rent', mortgage: 'rent', landlord: 'rent',
  doctor: 'health', pharmacy: 'health', hospital: 'health', gym: 'health',
  flight: 'travel', hotel: 'travel', airbnb: 'travel', booking: 'travel'
};

const LIFESTYLE_ITEMS = [
  { emoji: '🍕', name: 'Pizzas',        price: 12  },
  { emoji: '☕', name: 'Coffees',       price: 4   },
  { emoji: '👟', name: 'Sneakers',      price: 120 },
  { emoji: '🎮', name: 'PS5 Games',     price: 70  },
  { emoji: '🎬', name: 'Movie tickets', price: 14  },
  { emoji: '🍔', name: 'Burgers',       price: 8   },
  { emoji: '👕', name: 'Hoodies',       price: 55  },
  { emoji: '🍺', name: 'Beers',         price: 6   }
];

const ICONS = ['🏠','🍔','🛍️','🚗','🎮','💰','📦','✈️','💊','📚','🎵','🐾','💪','🎁','🏋️','🧴','👔','🎓','🌮','🍜','🎨','🏖️','🎸','🐕','🌿'];
const CAT_COLORS = ['#6366f1','#f97316','#ec4899','#06b6d4','#a855f7','#10b981','#f59e0b','#f43f5e','#94a3b8','#0ea5e9','#84cc16','#14b8a6'];

// ---- Storage ----
const save = () => localStorage.setItem('flowbudget', JSON.stringify(state));
const load = () => {
  const d = localStorage.getItem('flowbudget');
  if (d) state = { ...state, ...JSON.parse(d) };
};

// ---- Helpers ----
const fmt = (n) => {
  const abs = Math.abs(n);
  const formatted = abs >= 1000
    ? (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    : abs.toFixed(2);
  return state.currency + formatted;
};
const fmtFull = (n) => state.currency + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff === 1) return 'Yesterday · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ---- Toast ----
function toast(msg, dur = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ---- Monthly Reset ----
function checkMonthlyReset() {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}`;
  if (state.lastReset !== key) {
    if (state.lastReset !== null) {
      state.monthHistory.push({
        month: state.lastReset,
        expenses: [...state.expenses],
        totalSpent: getTotalSpent()
      });
      if (state.monthHistory.length > 12) state.monthHistory.shift();
      // Reset expenses for new month
      state.expenses = [];
    }
    // Add recurring expenses at new month
    state.recurring.forEach(r => {
      state.expenses.push({
        id: uid(), name: r.name, amount: r.amount,
        category: r.category, note: 'Recurring', date: now.toISOString(), recurring: true
      });
    });
    state.lastReset = key;
    save();
    if (state.lastReset !== null) toast('📅 New month started!');
  }
}

// ---- Category / Expense Helpers ----
function getCatById(id) { return state.categories.find(c => c.id === id); }
function getCatSpent(id) {
  return state.expenses.filter(e => e.category === id).reduce((s, e) => s + e.amount, 0);
}
function getTotalSpent() { return state.expenses.reduce((s, e) => s + e.amount, 0); }
function getRemaining() { return (state.salary + state.extraIncome) - getTotalSpent(); }
function getTotalAllocated() { return state.categories.reduce((s, c) => s + c.allocated, 0); }
function getDailyLimit() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  return getRemaining() / Math.max(daysLeft, 1);
}
function detectCategory(name) {
  const lower = name.toLowerCase();
  for (const [kw, catId] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(kw)) {
      // Only suggest if the category exists in user's list
      if (getCatById(catId)) return catId;
    }
  }
  // fallback to first category if exists
  return state.categories[0]?.id || '';
}
function getProgressClass(spent, allocated) {
  const pct = allocated > 0 ? spent / allocated : 0;
  if (pct >= 0.9) return 'danger';
  if (pct >= 0.7) return 'warning';
  return 'safe';
}

// ---- Insights ----
function generateInsights() {
  const insights = [];
  const salary = state.salary + state.extraIncome;
  const remaining = getRemaining();
  const total = getTotalSpent();

  if (state.categories.length === 0) {
    insights.push({ icon: '📊', title: 'Set up your budget', text: 'Go to Budget tab and add spending categories to get started.' });
    return insights;
  }
  if (total === 0) {
    insights.push({ icon: '✨', title: 'Ready to track!', text: 'Add your first expense to start seeing insights.' });
  }

  state.categories.forEach(cat => {
    const spent = getCatSpent(cat.id);
    const pct = cat.allocated > 0 ? spent / cat.allocated : 0;
    if (pct >= 0.9 && spent > 0) insights.push({ icon: '⚠️', title: `${cat.name} almost full`, text: `You've used ${Math.round(pct * 100)}% of your ${cat.name} budget.` });
    else if (pct >= 0.7 && spent > 0) insights.push({ icon: '📊', title: `${cat.name} getting high`, text: `${Math.round(pct * 100)}% of ${cat.name} budget used.` });
  });

  if (remaining > 0 && salary > 0 && remaining / salary > 0.4) {
    insights.push({ icon: '🎉', title: 'Great progress!', text: `You still have ${fmt(remaining)} left — well done!` });
  }
  if (getDailyLimit() > 0 && total > 0) {
    insights.push({ icon: '📅', title: 'Daily limit', text: `You can spend ${fmt(getDailyLimit())} per day for the rest of the month.` });
  }
  if (remaining < 0) {
    insights.push({ icon: '🚨', title: 'Over budget!', text: `You've exceeded your income by ${fmt(Math.abs(remaining))}.` });
  }

  if (insights.length === 0) {
    insights.push({ icon: '🧠', title: "You're on track", text: 'Keep up the great financial habits!' });
  }
  return insights.slice(0, 6);
}

// ---- Health Score ----
function calcHealthScore() {
  const salary = state.salary + state.extraIncome;
  if (salary === 0 || state.categories.length === 0) {
    return { score: 0, status: 'Set up your budget', color: '#94a3b8', tips: [{ icon: '📊', text: 'Add your salary and budget categories to get a score.' }] };
  }
  const total = getTotalSpent();
  const spent_pct = total / salary;
  const savCat = state.categories.find(c => c.id === 'savings');
  const savPct = savCat ? savCat.allocated / salary : 0;
  const remaining = getRemaining();

  let score = 100;
  if (spent_pct > 0.9) score -= 40;
  else if (spent_pct > 0.7) score -= 20;
  else if (spent_pct > 0.5) score -= 10;
  if (savPct < 0.1) score -= 20;
  else if (savPct < 0.2) score -= 10;
  if (remaining < 0) score -= 30;
  score = clamp(score, 0, 100);

  let status, color;
  if (score >= 80) { status = 'Excellent 🌟'; color = '#10b981'; }
  else if (score >= 60) { status = 'Good 👍'; color = '#6366f1'; }
  else if (score >= 40) { status = 'Fair ⚡'; color = '#f59e0b'; }
  else { status = 'Needs work 🔴'; color = '#f43f5e'; }

  const tips = [];
  if (savPct < 0.2) tips.push({ icon: '💰', text: 'Aim to save at least 20% of your salary.' });
  if (spent_pct > 0.8) tips.push({ icon: '✂️', text: 'Try reducing non-essential spending.' });
  if (remaining < 0) tips.push({ icon: '🚨', text: 'Your spending exceeds your income this month.' });
  if (score >= 80) tips.push({ icon: '🏆', text: 'Outstanding! Keep this momentum going.' });
  tips.push({ icon: '📈', text: 'Review your budget categories regularly.' });

  return { score, status, color, tips: tips.slice(0, 3) };
}

// ---- Heatmap ----
function buildHeatmap() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = now.getDate();

  const dayMap = {};
  state.expenses.forEach(e => {
    const d = new Date(e.date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      dayMap[d.getDate()] = (dayMap[d.getDate()] || 0) + e.amount;
    }
  });
  const maxDay = Math.max(...Object.values(dayMap), 1);

  let html = '<div class="heatmap-month-label">' + now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '</div>';
  html += '<div class="heatmap-grid">';
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => { html += `<div class="heatmap-day-label">${d}</div>`; });
  for (let i = 0; i < firstDay; i++) html += '<div class="heatmap-cell"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const amt = dayMap[d] || 0;
    const level = amt === 0 ? 0 : Math.ceil((amt / maxDay) * 4);
    const isToday = d === today ? ' today' : '';
    html += `<div class="heatmap-cell${isToday}" data-level="${level}" title="${state.currency}${amt.toFixed(2)}"></div>`;
  }
  html += '</div>';
  return html;
}

// ---- Render: Home ----
function renderHome() {
  const salary = state.salary + state.extraIncome;
  const total = getTotalSpent();
  const remaining = getRemaining();
  const now = new Date();

  document.getElementById('hero-month').textContent = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  document.getElementById('hero-balance').innerHTML = `<span class="currency">${state.currency}</span>${Math.abs(remaining).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('hero-spent-val').textContent = fmt(total);
  document.getElementById('hero-income-val').textContent = fmt(salary);

  renderSparkline();

  // Category chips — show user's categories (top 3 most spent)
  const catChips = document.getElementById('cat-chips');
  if (state.categories.length === 0) {
    catChips.innerHTML = `<div class="home-cat-chip empty-chip" onclick="switchTab('budget')">
      <span class="chip-icon" style="background:rgba(99,102,241,0.15)">➕</span>
      <div><div class="chip-name">Add categories</div><div class="chip-amount" style="font-size:0.75rem;color:var(--text3)">Budget tab</div></div>
    </div>`;
  } else {
    // Sort by allocated (descending) and show top 3
    const top3 = [...state.categories].sort((a, b) => b.allocated - a.allocated).slice(0, 3);
    catChips.innerHTML = top3.map(cat => {
      const spent = getCatSpent(cat.id);
      return `<div class="home-cat-chip" onclick="switchTab('budget')">
        <span class="chip-icon" style="background:${cat.color}22">${cat.icon}</span>
        <div>
          <div class="chip-name">${cat.name}</div>
          <div class="chip-amount">${fmt(spent)}</div>
        </div>
        <div class="chip-indicator" style="background:${cat.color}"></div>
      </div>`;
    }).join('');
  }

  // Recent transactions
  const recentList = document.getElementById('recent-list');
  const sorted = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  if (sorted.length === 0) {
    recentList.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">💳</span>
        <div class="empty-title">No transactions yet</div>
        <div class="empty-desc">Tap <strong>+</strong> to add your first expense</div>
      </div>`;
  } else {
    recentList.innerHTML = sorted.map(e => {
      const cat = getCatById(e.category) || { icon: '📦', color: '#94a3b8', name: 'Other' };
      return `<div class="expense-item" onclick="openEditExpense('${e.id}')">
        <div class="expense-icon" style="background:${cat.color}22">${cat.icon}</div>
        <div class="expense-info">
          <div class="expense-name">${e.name}</div>
          <div class="expense-meta">${cat.name} · ${fmtDate(e.date)}</div>
        </div>
        <div class="expense-amount negative">−${fmtFull(e.amount)}</div>
      </div>`;
    }).join('');
  }
}

function renderSparkline() {
  const canvas = document.getElementById('sparkline');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const now = new Date();
  const days = 14;
  const dayData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    dayData.push(state.expenses.filter(e => new Date(e.date).toDateString() === key).reduce((s, e) => s + e.amount, 0));
  }

  // If all zero, draw a flat baseline
  const maxVal = Math.max(...dayData, 0.01);
  const points = dayData.map((v, i) => ({
    x: (i / (days - 1)) * (W - 20) + 10,
    y: maxVal === 0.01 ? H - 8 : H - 8 - (v / maxVal) * (H - 24)
  }));

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(99,102,241,0.25)');
  grad.addColorStop(1, 'rgba(99,102,241,0)');
  ctx.beginPath();
  ctx.moveTo(points[0].x, H);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = 'rgba(99,102,241,0.7)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// ---- Render: Budget ----
function renderBudget() {
  const salary = state.salary + state.extraIncome;
  const unallocated = salary - getTotalAllocated();

  document.getElementById('unallocated-val').textContent = fmt(unallocated);
  document.getElementById('unallocated-bar').style.width = salary > 0 ? Math.max(0, (unallocated / salary) * 100) + '%' : '0%';

  const grid = document.getElementById('cat-grid');
  if (state.categories.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">📊</span>
        <div class="empty-title">No categories yet</div>
        <div class="empty-desc">Tap <strong>+ Add</strong> to create your first budget category</div>
      </div>`;
    return;
  }
  grid.innerHTML = '';
  state.categories.forEach(cat => {
    const spent = getCatSpent(cat.id);
    const pct = cat.allocated > 0 ? Math.min(spent / cat.allocated, 1) : 0;
    const remaining = cat.allocated - spent;
    const cls = getProgressClass(spent, cat.allocated);
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-info">
          <div class="cat-icon" style="background:${cat.color}22">${cat.icon}</div>
          <div>
            <div class="cat-name">${cat.name}</div>
            <div class="cat-sub">${fmt(remaining)} left</div>
          </div>
        </div>
        <div class="cat-amounts">
          <div class="cat-spent" style="color:${cat.color}">${fmt(spent)}</div>
          <div class="cat-budget">of ${fmt(cat.allocated)}</div>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${cls}" style="width:${Math.round(pct * 100)}%"></div>
      </div>`;
    card.addEventListener('click', () => openEditCategory(cat.id));
    grid.appendChild(card);
  });
}

// ---- Render: Expenses ----
function renderExpenses(filter = '', catFilter = 'all') {
  const search = filter.toLowerCase();
  let list = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (search) list = list.filter(e => e.name.toLowerCase().includes(search) || (e.note || '').toLowerCase().includes(search));
  if (catFilter !== 'all') list = list.filter(e => e.category === catFilter);

  const cont = document.getElementById('expense-list-cont');
  if (list.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">${filter || catFilter !== 'all' ? '🔍' : '💳'}</span>
        <div class="empty-title">${filter || catFilter !== 'all' ? 'No results' : 'No expenses yet'}</div>
        <div class="empty-desc">${filter || catFilter !== 'all' ? 'Try different filters' : 'Tap + to add your first expense'}</div>
      </div>`;
    return;
  }
  cont.innerHTML = list.map(e => {
    const cat = getCatById(e.category) || { icon: '📦', color: '#94a3b8', name: 'Other' };
    return `<div class="expense-item" onclick="openEditExpense('${e.id}')">
      <div class="expense-icon" style="background:${cat.color}22">${cat.icon}</div>
      <div class="expense-info">
        <div class="expense-name">${e.name}</div>
        <div class="expense-meta">${cat.name} · ${fmtDate(e.date)}</div>
      </div>
      <div class="expense-amount negative">−${fmtFull(e.amount)}</div>
    </div>`;
  }).join('');
}

// ---- Render: Goals ----
function renderGoals() {
  const cont = document.getElementById('goals-cont');
  if (state.goals.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">🎯</span>
        <div class="empty-title">No goals yet</div>
        <div class="empty-desc">Create your first savings goal with <strong>+ Add</strong></div>
      </div>`;
    return;
  }
  const savCat = state.categories.find(c => c.id === 'savings');
  const monthly = savCat?.allocated || 0;
  cont.innerHTML = state.goals.map(g => {
    const pct = g.target > 0 ? Math.min(g.saved / g.target * 100, 100) : 0;
    const left = g.target - g.saved;
    const months = monthly > 0 ? Math.ceil(left / monthly) : '?';
    return `<div class="goal-card">
      <div class="goal-header">
        <div class="goal-info">
          <span class="goal-icon">${g.icon}</span>
          <div>
            <div class="goal-name">${g.name}</div>
            <div class="goal-target">${fmtFull(g.saved)} / ${fmtFull(g.target)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="goal-pct">${Math.round(pct)}%</div>
          <button class="recurring-del" onclick="deleteGoal('${g.id}')">🗑️</button>
        </div>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="goal-footer">
        <span class="goal-saved">+${fmt(g.saved)} saved</span>
        <span>${months !== '?' ? months + ' mo. left' : 'No savings category'}</span>
      </div>
    </div>`;
  }).join('');
}

// ---- Render: More ----
function renderMore() {
  renderInsights();
  renderHealthScore();
  renderLifestyle();
  renderRecurring();
  renderRecap();
  document.getElementById('heatmap-cont').innerHTML = buildHeatmap();
}

function renderInsights() {
  const ins = generateInsights();
  document.getElementById('insights-cont').innerHTML = ins.map(i =>
    `<div class="insight-card">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-text"><strong>${i.title}</strong>${i.text}</div>
    </div>`
  ).join('');
}

function renderHealthScore() {
  const { score, status, color, tips } = calcHealthScore();
  const radius = 54, circ = 2 * Math.PI * radius;
  document.getElementById('score-fill').style.strokeDasharray = circ;
  document.getElementById('score-fill').style.strokeDashoffset = circ - (score / 100) * circ;
  document.getElementById('score-fill').style.stroke = color;
  document.getElementById('score-num').textContent = score;
  document.getElementById('score-num').style.color = color;
  document.getElementById('score-status').textContent = status;
  document.getElementById('score-tips-cont').innerHTML = tips.map(t =>
    `<div class="score-tip"><span class="score-tip-icon">${t.icon}</span>${t.text}</div>`
  ).join('');
}

function renderLifestyle() {
  const remaining = Math.max(getRemaining(), 0);
  document.getElementById('lifestyle-grid').innerHTML = LIFESTYLE_ITEMS.map(item => {
    const count = Math.floor(remaining / item.price);
    return `<div class="lifestyle-card">
      <div class="lifestyle-emoji">${item.emoji}</div>
      <div class="lifestyle-count">${count.toLocaleString()}</div>
      <div class="lifestyle-item">${item.name}</div>
    </div>`;
  }).join('');
}

function renderRecurring() {
  const cont = document.getElementById('recurring-list');
  if (state.recurring.length === 0) {
    cont.innerHTML = `<div class="empty-state" style="padding:24px 0"><span class="empty-emoji">🔄</span><div class="empty-title">No recurring expenses</div><div class="empty-desc">Add subscriptions or fixed monthly costs</div></div>`;
    return;
  }
  cont.innerHTML = state.recurring.map(r => {
    const cat = getCatById(r.category) || { icon: '📦' };
    return `<div class="recurring-item">
      <div class="expense-icon" style="font-size:1.2rem">${cat.icon}</div>
      <div class="recurring-info">
        <div class="recurring-name">${r.name}</div>
        <div class="recurring-meta">${(getCatById(r.category) || { name: 'Other' }).name} · Monthly</div>
      </div>
      <div class="recurring-amount">−${fmtFull(r.amount)}</div>
      <button class="recurring-del" onclick="deleteRecurring('${r.id}')">🗑️</button>
    </div>`;
  }).join('');
}

function renderRecap() {
  const salary = state.salary + state.extraIncome;
  const total = getTotalSpent();
  const savRate = salary > 0 ? Math.max(0, Math.round(((salary - total) / salary) * 100)) : 0;
  let biggestCat = null, biggestAmt = 0;
  state.categories.forEach(c => { const s = getCatSpent(c.id); if (s > biggestAmt) { biggestAmt = s; biggestCat = c; } });
  const biggestExp = state.expenses.reduce((max, e) => e.amount > max.amount ? e : max, { amount: 0 });

  document.getElementById('recap-total').textContent = total > 0 ? fmtFull(total) : '—';
  document.getElementById('recap-savrate').textContent = salary > 0 ? savRate + '%' : '—';
  document.getElementById('recap-bigcat').textContent = biggestCat ? biggestCat.name : '—';
  document.getElementById('recap-bigexp').textContent = biggestExp.name ? biggestExp.name + ' ' + fmtFull(biggestExp.amount) : '—';
}

// ---- Modals ----
function openModal(id) { document.getElementById(id).classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }

// ---- Add Expense ----
function openAddExpense() {
  document.getElementById('add-expense-form').reset();
  document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('edit-expense-id').value = '';
  document.getElementById('modal-exp-title').textContent = 'Add Expense';
  document.getElementById('del-exp-btn').style.display = 'none';
  populateCatSelect('expense-cat');
  // Auto-detect from name field
  document.getElementById('expense-name').oninput = function () {
    const detected = detectCategory(this.value);
    if (detected) document.getElementById('expense-cat').value = detected;
  };
  openModal('modal-add-expense');
  setTimeout(() => document.getElementById('expense-name').focus(), 300);
}

function openEditExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  document.getElementById('edit-expense-id').value = id;
  document.getElementById('modal-exp-title').textContent = 'Edit Expense';
  document.getElementById('expense-name').value = e.name;
  document.getElementById('expense-amount').value = e.amount;
  document.getElementById('expense-note').value = e.note || '';
  document.getElementById('expense-date').value = e.date.slice(0, 10);
  document.getElementById('del-exp-btn').style.display = '';
  populateCatSelect('expense-cat', e.category);
  openModal('modal-add-expense');
}

function populateCatSelect(selectId, selected) {
  const sel = document.getElementById(selectId);
  if (state.categories.length === 0) {
    sel.innerHTML = '<option value="">— Add categories first —</option>';
    return;
  }
  sel.innerHTML = state.categories.map(c =>
    `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.icon} ${c.name}</option>`
  ).join('');
}

function saveExpense() {
  const id = document.getElementById('edit-expense-id').value;
  const name = document.getElementById('expense-name').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const cat = document.getElementById('expense-cat').value;
  const note = document.getElementById('expense-note').value.trim();
  const date = document.getElementById('expense-date').value;

  if (!name || isNaN(amount) || amount <= 0) { toast('⚠️ Fill in name and amount'); return; }
  if (!cat) { toast('⚠️ Please add a category first'); return; }

  if (id) {
    const idx = state.expenses.findIndex(e => e.id === id);
    if (idx > -1) state.expenses[idx] = { ...state.expenses[idx], name, amount, category: cat, note, date: new Date(date).toISOString() };
  } else {
    state.expenses.push({ id: uid(), name, amount, category: cat, note, date: new Date(date).toISOString() });
  }
  save();
  closeModal('modal-add-expense');
  refreshCurrentTab();
  toast('✅ Expense saved');
}

function deleteCurrentExpense() {
  const id = document.getElementById('edit-expense-id').value;
  if (!id) return;
  if (!confirm('Delete this expense?')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  save();
  closeModal('modal-add-expense');
  refreshCurrentTab();
  toast('🗑️ Expense deleted');
}

// ---- Category Modal ----
let editCatId = null, selectedCatColor = '#6366f1', selectedCatIcon = '📦';

function openAddCategory() {
  editCatId = null;
  selectedCatColor = '#6366f1'; selectedCatIcon = '📦';
  document.getElementById('modal-cat-title').textContent = 'Add Category';
  document.getElementById('cat-name-input').value = '';
  document.getElementById('cat-amount-input').value = '';
  document.getElementById('cat-mode').value = 'fixed';
  document.getElementById('del-cat-btn').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.mode-btn[data-mode="fixed"]').classList.add('active');
  renderCatColorPicker(); renderCatIconPicker();
  openModal('modal-add-cat');
}

function openEditCategory(id) {
  const cat = getCatById(id);
  if (!cat) return;
  editCatId = id;
  selectedCatColor = cat.color; selectedCatIcon = cat.icon;
  document.getElementById('modal-cat-title').textContent = 'Edit Category';
  document.getElementById('cat-name-input').value = cat.name;
  document.getElementById('cat-amount-input').value = cat.mode === 'pct' ? cat.pct : cat.allocated;
  document.getElementById('cat-mode').value = cat.mode || 'fixed';
  document.getElementById('del-cat-btn').style.display = '';
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.mode-btn[data-mode="${cat.mode || 'fixed'}"]`).classList.add('active');
  renderCatColorPicker(); renderCatIconPicker();
  openModal('modal-add-cat');
}

function renderCatColorPicker() {
  document.getElementById('cat-color-picker').innerHTML = CAT_COLORS.map(c =>
    `<div class="color-opt ${c === selectedCatColor ? 'selected' : ''}" style="background:${c}" onclick="selectCatColor('${c}')"></div>`
  ).join('');
}
function renderCatIconPicker() {
  document.getElementById('cat-icon-picker').innerHTML = ICONS.map(ic =>
    `<div class="icon-opt ${ic === selectedCatIcon ? 'selected' : ''}" onclick="selectCatIcon('${ic}')">${ic}</div>`
  ).join('');
}
function selectCatColor(c) { selectedCatColor = c; renderCatColorPicker(); }
function selectCatIcon(ic) { selectedCatIcon = ic; renderCatIconPicker(); }

function saveCategory() {
  const name = document.getElementById('cat-name-input').value.trim();
  const val = parseFloat(document.getElementById('cat-amount-input').value);
  const mode = document.getElementById('cat-mode').value;
  if (!name || isNaN(val) || val < 0) { toast('⚠️ Fill in name and amount'); return; }
  const salary = state.salary + state.extraIncome;
  const allocated = mode === 'pct' ? (val / 100) * salary : val;

  if (editCatId) {
    const cat = getCatById(editCatId);
    if (cat) { cat.name = name; cat.allocated = allocated; cat.color = selectedCatColor; cat.icon = selectedCatIcon; cat.mode = mode; cat.pct = mode === 'pct' ? val : 0; }
  } else {
    state.categories.push({ id: uid(), name, icon: selectedCatIcon, color: selectedCatColor, allocated, pct: mode === 'pct' ? val : 0, mode });
  }
  save();
  closeModal('modal-add-cat');
  renderBudget();
  initExpenseFilters();
  toast('✅ Category saved');
}

function deleteEditCategory() {
  if (!editCatId) return;
  if (!confirm('Delete this category? Related expenses will be reassigned.')) return;
  state.categories = state.categories.filter(c => c.id !== editCatId);
  state.expenses.forEach(e => { if (e.category === editCatId) e.category = state.categories[0]?.id || 'other'; });
  save(); closeModal('modal-add-cat'); renderBudget(); initExpenseFilters(); toast('🗑️ Category deleted');
}

// ---- Goals ----
function openAddGoal() {
  document.getElementById('goal-name-input').value = '';
  document.getElementById('goal-target-input').value = '';
  document.getElementById('goal-saved-input').value = '';
  document.getElementById('goal-icon-input').value = '🎯';
  openModal('modal-add-goal');
}
function saveGoal() {
  const name = document.getElementById('goal-name-input').value.trim();
  const target = parseFloat(document.getElementById('goal-target-input').value);
  const saved = parseFloat(document.getElementById('goal-saved-input').value) || 0;
  const icon = document.getElementById('goal-icon-input').value || '🎯';
  if (!name || isNaN(target) || target <= 0) { toast('⚠️ Fill in name and target'); return; }
  state.goals.push({ id: uid(), name, target, saved, icon });
  save(); closeModal('modal-add-goal'); renderGoals(); toast('🎯 Goal added!');
}
function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  state.goals = state.goals.filter(g => g.id !== id);
  save(); renderGoals(); toast('🗑️ Goal deleted');
}

// ---- Recurring ----
function openAddRecurring() {
  document.getElementById('rec-name').value = '';
  document.getElementById('rec-amount').value = '';
  populateCatSelect('rec-cat');
  openModal('modal-add-recurring');
}
function saveRecurring() {
  const name = document.getElementById('rec-name').value.trim();
  const amount = parseFloat(document.getElementById('rec-amount').value);
  const category = document.getElementById('rec-cat').value;
  if (!name || isNaN(amount) || amount <= 0) { toast('⚠️ Fill in name and amount'); return; }
  state.recurring.push({ id: uid(), name, amount, category });
  save(); closeModal('modal-add-recurring'); renderRecurring(); toast('🔄 Recurring added');
}
function deleteRecurring(id) {
  state.recurring = state.recurring.filter(r => r.id !== id);
  save(); renderRecurring(); toast('🗑️ Deleted');
}

// ---- Afford Tool ----
function checkAfford() {
  const name = document.getElementById('afford-name').value.trim();
  const price = parseFloat(document.getElementById('afford-price').value);
  const result = document.getElementById('afford-result');
  if (!name || isNaN(price) || price <= 0) { toast('⚠️ Enter item and price'); return; }
  const salary = state.salary + state.extraIncome;
  const remaining = getRemaining();
  const salaryPct = salary > 0 ? Math.round((price / salary) * 100) : 0;
  const remPct = remaining > 0 ? Math.round((price / remaining) * 100) : 100;

  let cls, emoji, verdict, desc;
  if (price <= remaining * 0.3) { cls = 'affordable'; emoji = '✅'; verdict = 'You can afford it!'; desc = `This costs ${salaryPct}% of your monthly income and ${remPct}% of your remaining budget.`; }
  else if (price <= remaining * 0.6) { cls = 'risky'; emoji = '⚠️'; verdict = 'Risky purchase'; desc = `This would use ${remPct}% of your remaining budget. Think twice.`; }
  else { cls = 'danger'; emoji = '❌'; verdict = 'Not recommended'; desc = `This would use ${remPct}% of your remaining budget (${salaryPct}% of salary). Consider saving for it.`; }

  result.className = 'afford-result show ' + cls;
  result.innerHTML = `<span class="afford-emoji">${emoji}</span><div class="afford-verdict">${verdict}</div><div class="afford-desc">${desc}</div>`;
}

// ---- Settings ----
function openSettings() { renderSettings(); openModal('modal-settings'); }
function renderSettings() {
  document.getElementById('setting-salary').textContent = fmtFull(state.salary);
  document.getElementById('setting-savings').textContent = fmtFull(state.savings);
  document.getElementById('theme-toggle').className = 'toggle' + (state.theme === 'light' ? ' on' : '');
}
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  save();
}
function openEditSalary() {
  document.getElementById('edit-salary-val').value = state.salary;
  document.getElementById('edit-extra-val').value = state.extraIncome;
  document.getElementById('edit-savings-val').value = state.savings;
  openModal('modal-edit-salary');
}
function saveEditSalary() {
  const sal = parseFloat(document.getElementById('edit-salary-val').value) || 0;
  const extra = parseFloat(document.getElementById('edit-extra-val').value) || 0;
  const sav = parseFloat(document.getElementById('edit-savings-val').value) || 0;
  state.salary = sal; state.extraIncome = extra; state.savings = sav;
  state.categories.forEach(c => { if (c.mode === 'pct') c.allocated = (c.pct / 100) * (sal + extra); });
  save(); closeModal('modal-edit-salary'); closeModal('modal-settings');
  refreshCurrentTab(); toast('✅ Salary updated');
}
function resetAllData() {
  if (!confirm('Reset ALL data? This cannot be undone.')) return;
  localStorage.removeItem('flowbudget');
  location.reload();
}

// ---- Tab Navigation ----
let currentTab = 'home';
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('[data-tab]').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-' + tab)?.classList.add('active');
  document.querySelectorAll(`[data-tab="${tab}"]`).forEach(n => n.classList.add('active'));
  switch (tab) {
    case 'home':     renderHome();     break;
    case 'budget':   renderBudget();   break;
    case 'expenses': renderExpenses(); break;
    case 'goals':    renderGoals();    break;
    case 'more':     renderMore();     break;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function refreshCurrentTab() { switchTab(currentTab); }

// ---- FAB ----
function fabAction() {
  switch (currentTab) {
    case 'home':
    case 'expenses': openAddExpense(); break;
    case 'budget':   openAddCategory(); break;
    case 'goals':    openAddGoal(); break;
    case 'more':     openAddRecurring(); break;
  }
}

// ---- Onboarding (2 steps: salary → done) ----
let onboardStep = 1;

function completeOnboarding() {
  const salary = parseFloat(document.getElementById('ob-salary').value) || 0;
  const savings = parseFloat(document.getElementById('ob-savings').value) || 0;
  const extra = parseFloat(document.getElementById('ob-extra').value) || 0;
  if (salary <= 0) { toast('⚠️ Please enter your monthly salary'); return; }
  state.salary = salary;
  state.savings = savings;
  state.extraIncome = extra;
  state.onboarded = true;
  state.categories = [];   // always empty — user builds their own
  state.expenses = [];
  const now = new Date();
  state.lastReset = `${now.getFullYear()}-${now.getMonth()}`;
  save();
  document.getElementById('onboarding').style.display = 'none';
  document.getElementById('app').style.display = '';
  initExpenseFilters();
  switchTab('home');
  // Prompt to set up budget
  setTimeout(() => toast('👋 Welcome! Go to Budget to set up your categories'), 600);
}

// ---- PWA ----
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('install-banner').classList.add('visible');
});
function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') document.getElementById('install-banner').classList.remove('visible');
    deferredPrompt = null;
  });
}

// ---- Expense Filters ----
let expCatFilter = 'all';
function initExpenseFilters() {
  const tagRow = document.getElementById('exp-cat-tags');
  tagRow.innerHTML = `<div class="tag active" onclick="setExpCatFilter('all',this)">All</div>` +
    state.categories.map(c => `<div class="tag" onclick="setExpCatFilter('${c.id}',this)">${c.icon} ${c.name}</div>`).join('');
}
function setExpCatFilter(id, el) {
  expCatFilter = id;
  document.querySelectorAll('#exp-cat-tags .tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderExpenses(document.getElementById('exp-search').value, expCatFilter);
}

// ---- Mode buttons ----
function setCatMode(mode, btn) {
  document.getElementById('cat-mode').value = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ---- Boot ----
window.addEventListener('DOMContentLoaded', () => {
  load();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
  document.documentElement.setAttribute('data-theme', state.theme || 'dark');

  if (!state.onboarded) {
    document.getElementById('onboarding').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    return;
  }
  document.getElementById('onboarding').style.display = 'none';
  document.getElementById('app').style.display = '';
  checkMonthlyReset();
  initExpenseFilters();
  switchTab('home');

  document.getElementById('exp-search').addEventListener('input', e => {
    renderExpenses(e.target.value, expCatFilter);
    });
});