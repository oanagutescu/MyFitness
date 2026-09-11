'use strict';

const ACTIVITY_TYPES = {
  fitness: { label: 'Fitness', emoji: '💪', color: '#f97316' },
  gym: { label: 'Gym', emoji: '🏋️', color: '#ef4444' },
  running: { label: 'Running', emoji: '🏃', color: '#22d3ee' },
  swimming: { label: 'Swimming', emoji: '🏊', color: '#38bdf8' },
  biking: { label: 'Biking', emoji: '🚴', color: '#a3e635' },
  walking: { label: 'Walking', emoji: '🚶', color: '#fbbf24' },
  other: { label: 'Other', emoji: '✨', color: '#c084fc' },
};

const MOTIVATION = {
  zero: [
    "Today is a great day to start a new streak. Your future self will thank you.",
    "No sessions logged yet today — even 10 minutes counts. Let's move!",
    "The hardest part is starting. Once you begin, momentum takes over.",
    "Small steps still move you forward. Get one session in today.",
  ],
  early: [
    "You're building something. Day {streak} — keep the fire going!",
    "{streak} days in a row. That's not luck, that's discipline.",
    "Consistency beats intensity. Nice work on day {streak}.",
  ],
  solid: [
    "A {streak}-day streak?! You're officially building a habit.",
    "Day {streak} — your body is thanking you right now.",
    "{streak} days straight. Whatever you're doing, keep doing it.",
  ],
  strong: [
    "{streak} days! You're an inspiration to your future self.",
    "This is what dedication looks like: {streak} days and counting.",
    "You've turned fitness into a lifestyle. Day {streak} — unstoppable.",
  ],
  legendary: [
    "{streak} DAYS?! Legendary status achieved. Keep going!",
    "You're on day {streak}. Most people never make it this far.",
    "{streak} days of showing up for yourself. Absolutely elite.",
  ],
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let allSessions = [];
let sessionsByDate = new Map();
let calendarCursor = new Date();
calendarCursor.setDate(1);
let selectedType = 'fitness';
let currentDayModalDate = null;

const $ = (id) => document.getElementById(id);

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

async function loadSessions() {
  allSessions = await window.FitnessDB.getAllSessions();
  sessionsByDate = new Map();
  for (const s of allSessions) {
    if (!sessionsByDate.has(s.date)) sessionsByDate.set(s.date, []);
    sessionsByDate.get(s.date).push(s);
  }
}

function computeCurrentStreak() {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let key = toDateKey(cursor);

  // If nothing today yet, streak calc should still count yesterday's chain,
  // but only starts "active" once today is logged. We count backwards from
  // today if today has a session, otherwise from yesterday.
  if (!sessionsByDate.has(key)) {
    cursor.setDate(cursor.getDate() - 1);
    key = toDateKey(cursor);
    if (!sessionsByDate.has(key)) return 0;
  }

  while (sessionsByDate.has(key)) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    key = toDateKey(cursor);
  }
  return streak;
}

function computeBestStreak() {
  if (allSessions.length === 0) return 0;
  const uniqueDays = [...sessionsByDate.keys()].map(parseDateKey).sort((a, b) => a - b);
  let best = 1;
  let current = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const diffDays = Math.round((uniqueDays[i] - uniqueDays[i - 1]) / 86400000);
    if (diffDays === 1) {
      current++;
    } else if (diffDays > 1) {
      current = 1;
    }
    best = Math.max(best, current);
  }
  return best;
}

function pickMotivation(streak) {
  let bucket;
  if (streak === 0) bucket = MOTIVATION.zero;
  else if (streak < 3) bucket = MOTIVATION.early;
  else if (streak < 7) bucket = MOTIVATION.solid;
  else if (streak < 21) bucket = MOTIVATION.strong;
  else bucket = MOTIVATION.legendary;

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const message = bucket[dayOfYear % bucket.length];
  return message.replace('{streak}', String(streak));
}

function renderMotivation() {
  const streak = computeCurrentStreak();
  $('streakCount').textContent = String(streak);
  $('motivationMessage').textContent = pickMotivation(streak);
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  $('calendarTitle').textContent = calendarCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const weekdayRow = $('weekdayRow');
  weekdayRow.innerHTML = WEEKDAY_LABELS.map((d) => `<span>${d}</span>`).join('');

  const grid = $('calendarGrid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(new Date());

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const key = toDateKey(cellDate);
    const sessions = sessionsByDate.get(key) || [];

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (key === todayKey) cell.classList.add('today');
    if (sessions.length > 0) cell.classList.add('has-session');

    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = String(day);
    cell.appendChild(number);

    if (sessions.length > 0) {
      const dots = document.createElement('span');
      dots.className = 'dots';
      const uniqueTypes = [...new Set(sessions.map((s) => s.type))].slice(0, 4);
      for (const type of uniqueTypes) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = (ACTIVITY_TYPES[type] || ACTIVITY_TYPES.other).color;
        dots.appendChild(dot);
      }
      cell.appendChild(dots);
    }

    cell.addEventListener('click', () => openDayModal(key));
    grid.appendChild(cell);
  }

  renderLegend();
}

function renderLegend() {
  const legend = $('legend');
  legend.innerHTML = Object.entries(ACTIVITY_TYPES)
    .map(
      ([key, def]) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${def.color}"></span>${def.emoji} ${def.label}</span>`
    )
    .join('');
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function renderStats() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  let inWeek = 0;
  let inMonth = 0;
  let inYear = 0;
  const typeCounts = {};

  for (const s of allSessions) {
    const d = parseDateKey(s.date);
    if (d >= weekStart) inWeek++;
    if (d >= monthStart) inMonth++;
    if (d >= yearStart) inYear++;
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  }

  $('statTotal').textContent = String(allSessions.length);
  $('statWeek').textContent = String(inWeek);
  $('statMonth').textContent = String(inMonth);
  $('statYear').textContent = String(inYear);
  $('statBestStreak').textContent = String(computeBestStreak());
  $('statTypesUsed').textContent = String(Object.keys(typeCounts).length);

  const maxCount = Math.max(1, ...Object.values(typeCounts));
  const breakdown = $('typeBreakdown');
  breakdown.innerHTML = '';
  for (const [key, def] of Object.entries(ACTIVITY_TYPES)) {
    const count = typeCounts[key] || 0;
    const row = document.createElement('div');
    row.className = 'type-row';
    row.innerHTML = `
      <span class="type-icon">${def.emoji}</span>
      <span class="type-name">${def.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(count / maxCount) * 100}%;background:${def.color}"></span></span>
      <span class="type-count">${count}</span>
    `;
    breakdown.appendChild(row);
  }
}

function renderAll() {
  renderMotivation();
  renderCalendar();
  renderStats();
}

// ---------- Session modal ----------

function buildTypePicker() {
  const picker = $('typePicker');
  picker.innerHTML = '';
  for (const [key, def] of Object.entries(ACTIVITY_TYPES)) {
    const option = document.createElement('div');
    option.className = 'type-option';
    option.dataset.type = key;
    option.innerHTML = `<span class="type-emoji">${def.emoji}</span><span>${def.label}</span>`;
    option.addEventListener('click', () => {
      selectedType = key;
      [...picker.children].forEach((c) => c.classList.remove('selected'));
      option.classList.add('selected');
    });
    picker.appendChild(option);
  }
  selectFirstTypeOption(selectedType);
}

function selectFirstTypeOption(type) {
  selectedType = type;
  const picker = $('typePicker');
  [...picker.children].forEach((c) => c.classList.toggle('selected', c.dataset.type === type));
}

function openSessionModal(prefillDate) {
  $('sessionForm').reset();
  $('editingIdInput').value = '';
  $('sessionModalTitle').textContent = 'Log a session';
  selectFirstTypeOption('fitness');
  $('dateInput').value = prefillDate || toDateKey(new Date());
  $('sessionModalOverlay').classList.add('open');
}

function closeSessionModal() {
  $('sessionModalOverlay').classList.remove('open');
}

function openEditSessionModal(session) {
  $('editingIdInput').value = session.id;
  $('sessionModalTitle').textContent = 'Edit session';
  selectFirstTypeOption(session.type);
  $('dateInput').value = session.date;
  $('durationInput').value = session.duration || '';
  $('notesInput').value = session.notes || '';
  $('sessionModalOverlay').classList.add('open');
}

async function handleSessionFormSubmit(event) {
  event.preventDefault();
  const editingId = $('editingIdInput').value;
  const session = {
    type: selectedType,
    date: $('dateInput').value,
    duration: Number($('durationInput').value) || null,
    notes: $('notesInput').value.trim(),
    timestamp: Date.now(),
  };

  if (editingId) {
    session.id = Number(editingId);
    await window.FitnessDB.updateSession(session);
    showToast('Session updated');
  } else {
    await window.FitnessDB.addSession(session);
    showToast('Session logged. Nice work!');
  }

  closeSessionModal();
  await loadSessions();
  renderAll();
  if (currentDayModalDate) renderDaySessionsList(currentDayModalDate);
}

// ---------- Day modal ----------

function openDayModal(dateKey) {
  currentDayModalDate = dateKey;
  const date = parseDateKey(dateKey);
  $('dayModalTitle').textContent = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  renderDaySessionsList(dateKey);
  $('dayModalOverlay').classList.add('open');
}

function closeDayModal() {
  $('dayModalOverlay').classList.remove('open');
  currentDayModalDate = null;
}

function renderDaySessionsList(dateKey) {
  const list = $('daySessionsList');
  const sessions = sessionsByDate.get(dateKey) || [];
  list.innerHTML = '';

  if (sessions.length === 0) {
    list.innerHTML = '<div class="empty-state">No sessions logged for this day yet.</div>';
    return;
  }

  for (const session of sessions) {
    const def = ACTIVITY_TYPES[session.type] || ACTIVITY_TYPES.other;
    const item = document.createElement('div');
    item.className = 'day-session-item';
    const durationText = session.duration ? `${session.duration} min` : 'No duration logged';
    item.innerHTML = `
      <span class="type-emoji">${def.emoji}</span>
      <span class="info">
        <div class="title">${def.label}</div>
        <div class="subtitle">${durationText}${session.notes ? ' · ' + session.notes : ''}</div>
      </span>
      <button class="delete-btn" aria-label="Delete session">&times;</button>
    `;
    item.querySelector('.info').addEventListener('click', () => openEditSessionModal(session));
    item.querySelector('.delete-btn').addEventListener('click', async () => {
      await window.FitnessDB.deleteSession(session.id);
      showToast('Session removed');
      await loadSessions();
      renderAll();
      renderDaySessionsList(dateKey);
    });
    list.appendChild(item);
  }
}

// ---------- Theme ----------

const THEME_STORAGE_KEY = 'myfitness-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('themeToggleBtn');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : '#0f172a');
}

function initTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = stored || (prefersLight ? 'light' : 'dark');
  applyTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
}

// ---------- Wiring ----------

function attachEventListeners() {
  $('themeToggleBtn').addEventListener('click', toggleTheme);

  $('prevMonthBtn').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    renderCalendar();
  });
  $('nextMonthBtn').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    renderCalendar();
  });

  $('addSessionFab').addEventListener('click', () => openSessionModal());
  $('closeSessionModalBtn').addEventListener('click', closeSessionModal);
  $('sessionModalOverlay').addEventListener('click', (e) => {
    if (e.target === $('sessionModalOverlay')) closeSessionModal();
  });
  $('sessionForm').addEventListener('submit', handleSessionFormSubmit);

  $('closeDayModalBtn').addEventListener('click', closeDayModal);
  $('dayModalOverlay').addEventListener('click', (e) => {
    if (e.target === $('dayModalOverlay')) closeDayModal();
  });
  $('addSessionForDayBtn').addEventListener('click', () => {
    const date = currentDayModalDate;
    closeDayModal();
    openSessionModal(date);
  });
}

async function init() {
  initTheme();
  buildTypePicker();
  attachEventListeners();
  await loadSessions();
  renderAll();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
  }
}

document.addEventListener('DOMContentLoaded', init);