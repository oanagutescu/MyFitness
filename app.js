'use strict';

const ACTIVITY_TYPES = {
  workout: { label: 'Workout', emoji: '💪', color: '#f97316' },
  biking: { label: 'Bike', emoji: '🚴', color: '#a3e635' },
  gym: { label: 'Gym', emoji: '🏋️', color: '#ef4444' },
  swimming: { label: 'Swim', emoji: '🏊', color: '#38bdf8' },
  walking: { label: 'Walk', emoji: '🚶', color: '#fbbf24' },
  running: { label: 'Run', emoji: '🏃', color: '#22d3ee' },
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

const WELLNESS_CHECK_ITEMS = [
  { key: 'vacum', label: 'Vacum', emoji: '🌬️' },
  { key: 'plansa', label: 'Plansă', emoji: '🧘' },
  { key: 'apa', label: 'Apă', emoji: '💧' },
  { key: 'micDejun', label: 'Mic-dejun', emoji: '🍳' },
  { key: 'ex', label: 'Ex.', emoji: '🏋️' },
  { key: 'pranz', label: 'Prânz', emoji: '🍽️' },
  { key: 'cina', label: 'Cină', emoji: '🌙' },
  { key: 'faraZahar', label: 'Fără zahăr', emoji: '🍬' },
];

let allSessions = [];
let sessionsByDate = new Map();
let calendarCursor = new Date();
calendarCursor.setDate(1);
let selectedType = 'workout';
let currentDayModalDate = null;
const STREAK_MODE_STORAGE_KEY = 'myfitness-streak-mode';
let streakMode = localStorage.getItem(STREAK_MODE_STORAGE_KEY) || 'all';
if (streakMode === 'fitness') {
  streakMode = 'workout';
  localStorage.setItem(STREAK_MODE_STORAGE_KEY, streakMode);
}

let allWellness = [];
let wellnessByDate = new Map();
let wellnessCursor = new Date();
wellnessCursor.setDate(1);
let currentPageIndex = 0;

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

  // One-time migration: the 'fitness' activity type was renamed to 'workout'.
  // Update any sessions still using the old key so historical data isn't lost.
  const legacySessions = allSessions.filter((s) => s.type === 'fitness');
  if (legacySessions.length > 0) {
    for (const s of legacySessions) {
      s.type = 'workout';
      await window.FitnessDB.updateSession(s);
    }
    allSessions = await window.FitnessDB.getAllSessions();
  }

  sessionsByDate = new Map();
  for (const s of allSessions) {
    if (!sessionsByDate.has(s.date)) sessionsByDate.set(s.date, []);
    sessionsByDate.get(s.date).push(s);
  }
}

function dateHasSessionOfMode(key, mode) {
  const sessions = sessionsByDate.get(key);
  if (!sessions || sessions.length === 0) return false;
  if (mode === 'workout') return sessions.some((s) => s.type === 'workout');
  return true;
}

function computeCurrentStreak(mode = streakMode) {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let key = toDateKey(cursor);

  // If nothing today yet, streak calc should still count yesterday's chain,
  // but only starts "active" once today is logged. We count backwards from
  // today if today has a session, otherwise from yesterday.
  if (!dateHasSessionOfMode(key, mode)) {
    cursor.setDate(cursor.getDate() - 1);
    key = toDateKey(cursor);
    if (!dateHasSessionOfMode(key, mode)) return 0;
  }

  // Fitness-only streaks forgive a single missed day: if exactly one day is
  // skipped and activity resumes right after, the streak keeps going.
  const allowGrace = mode === 'workout';
  let graceUsed = false;

  while (true) {
    if (dateHasSessionOfMode(key, mode)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
      key = toDateKey(cursor);
      continue;
    }

    if (allowGrace && !graceUsed) {
      const peekCursor = new Date(cursor);
      peekCursor.setDate(peekCursor.getDate() - 1);
      const peekKey = toDateKey(peekCursor);
      if (dateHasSessionOfMode(peekKey, mode)) {
        graceUsed = true;
        cursor.setDate(cursor.getDate() - 1);
        key = toDateKey(cursor);
        continue;
      }
    }

    break;
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
  $('streakLabel').textContent = streakMode === 'workout' ? 'workout streak' : 'day streak';
  const badge = $('streakBadge');
  if (badge) {
    badge.classList.toggle('active', streakMode === 'workout');
    badge.setAttribute('aria-pressed', String(streakMode === 'workout'));
  }
  $('motivationMessage').textContent = pickMotivation(streak);
}

function toggleStreakMode() {
  streakMode = streakMode === 'workout' ? 'all' : 'workout';
  localStorage.setItem(STREAK_MODE_STORAGE_KEY, streakMode);
  renderMotivation();
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
    if (sessions.some((s) => s.type === 'workout')) cell.classList.add('workout-day');

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
  const viewedMonthStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const viewedMonthEnd = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  let inWeek = 0;
  let inMonth = 0;
  let inYear = 0;
  const typeCounts = {};

  for (const s of allSessions) {
    const d = parseDateKey(s.date);
    if (d >= weekStart) inWeek++;
    if (d >= viewedMonthStart && d < viewedMonthEnd) {
      inMonth++;
      typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
    }
    if (d >= yearStart) inYear++;
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
  renderQuickLogRow();
}

// ---------- Wellness ----------

async function loadWellness() {
  allWellness = await window.FitnessDB.getAllWellness();
  wellnessByDate = new Map();
  for (const w of allWellness) {
    wellnessByDate.set(w.date, w);
  }
}

function buildWellnessQuickLogRow() {
  const row = $('wellnessQuickLogRow');
  if (!row) return;
  row.innerHTML = '';
  for (const item of WELLNESS_CHECK_ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-log-btn';
    btn.dataset.key = item.key;
    btn.style.setProperty('--type-color', 'var(--accent)');
    btn.innerHTML = `<span class="quick-log-emoji">${item.emoji}</span><span class="quick-log-name">${item.label}</span>`;
    btn.addEventListener('click', () => toggleWellnessHabit(item.key));
    row.appendChild(btn);
  }
  renderWellnessQuickLogRow();
}

function renderWellnessQuickLogRow() {
  const row = $('wellnessQuickLogRow');
  if (!row) return;
  const today = toDateKey(new Date());
  const entry = wellnessByDate.get(today);
  const checks = (entry && entry.checks) || {};
  row.querySelectorAll('.quick-log-btn').forEach((btn) => {
    btn.classList.toggle('active', !!checks[btn.dataset.key]);
  });
}

async function toggleWellnessHabit(key) {
  const today = toDateKey(new Date());
  const existing = wellnessByDate.get(today);
  const checks = { ...(existing && existing.checks) };
  checks[key] = !checks[key];

  const entry = {
    date: today,
    kg: existing && existing.kg != null ? existing.kg : null,
    somnHour: existing && existing.somnHour != null ? existing.somnHour : null,
    somnQuarter: existing && existing.somnQuarter != null ? existing.somnQuarter : null,
    pasi: existing && existing.pasi != null ? existing.pasi : null,
    checks,
  };

  try {
    await window.FitnessDB.putWellness(entry);
    await loadWellness();
    renderWellnessQuickLogRow();
    renderWellnessAll();
    const item = WELLNESS_CHECK_ITEMS.find((i) => i.key === key);
    showToast(checks[key] ? `${item.emoji} ${item.label} logged for today!` : `${item.emoji} ${item.label} removed for today.`);
    if (isPerfectDay(entry)) launchFireworks();
  } catch (err) {
    console.error('Failed to toggle wellness habit', err);
    showToast(`Error saving check-in: ${err.message}`);
  }
}

function findPreviousKg(beforeDateKey) {
  const entries = allWellness
    .filter((w) => w.kg != null && (!beforeDateKey || w.date < beforeDateKey))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries.length ? entries[0].kg : null;
}

function renderWellnessCalendar() {
  const year = wellnessCursor.getFullYear();
  const month = wellnessCursor.getMonth();
  $('wellnessCalendarTitle').textContent = wellnessCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const weekdayRow = $('wellnessWeekdayRow');
  weekdayRow.innerHTML = WEEKDAY_LABELS.map((d) => `<span>${d}</span>`).join('');

  const grid = $('wellnessCalendarGrid');
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
    const entry = wellnessByDate.get(key);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (key === todayKey) cell.classList.add('today');
    if (entry) cell.classList.add('has-session');
    if (isPerfectDay(entry)) cell.classList.add('perfect-day');

    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = String(day);
    cell.appendChild(number);

    if (entry) {
      const dots = document.createElement('span');
      dots.className = 'dots';
      const dot = document.createElement('span');
      dot.className = 'dot';
      if (isPerfectDay(entry)) {
        dot.classList.add('perfect');
      } else {
        dot.style.background = 'var(--accent)';
      }
      dots.appendChild(dot);
      cell.appendChild(dots);
    }

    cell.addEventListener('click', () => openWellnessModal(key));
    grid.appendChild(cell);
  }
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isPerfectDay(entry) {
  if (!entry || !entry.checks) return false;
  return WELLNESS_CHECK_ITEMS.every((item) => entry.checks[item.key]);
}

function launchFireworks() {
  const layer = $('fireworksLayer');
  if (!layer) return;
  const colors = ['#facc15', '#22d3ee', '#f97316', '#a3e635', '#6366f1', '#f87171'];
  const bursts = 3;
  const particlesPerBurst = 24;

  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      const originX = window.innerWidth * (0.25 + Math.random() * 0.5);
      const originY = window.innerHeight * (0.25 + Math.random() * 0.35);
      for (let i = 0; i < particlesPerBurst; i++) {
        const particle = document.createElement('span');
        particle.className = 'firework-particle';
        const angle = (i / particlesPerBurst) * Math.PI * 2;
        const distance = 60 + Math.random() * 80;
        const fx = Math.cos(angle) * distance;
        const fy = Math.sin(angle) * distance;
        particle.style.left = `${originX}px`;
        particle.style.top = `${originY}px`;
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.setProperty('--fx', `${fx}px`);
        particle.style.setProperty('--fy', `${fy}px`);
        layer.appendChild(particle);
        particle.addEventListener('animationend', () => particle.remove());
      }
    }, b * 250);
  }
}

function makeSparkline(containerId, points, formatValue, minZero = false) {
  const container = $(containerId);
  if (!points.length) {
    container.innerHTML = '<div class="sparkline-empty">No data yet</div>';
    return;
  }
  const width = 300;
  const height = 60;
  const padding = 6;
  const values = points.map((p) => p.value);
  const min = minZero ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xs = points.map((p, i) => (points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - padding * 2)));
  const ys = points.map((p) => height - padding - ((p.value - min) / range) * (height - padding * 2));
  const coords = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`);

  const barWidth = points.length > 1 ? Math.max(2, (width - padding * 2) / points.length - 2) : 8;
  const bars = xs
    .map((x, i) => {
      const barHeight = height - padding - ys[i];
      const y = ys[i];
      const day = points[i].date ? parseDateKey(points[i].date).getDay() : null;
      const isWeekend = day === 0 || day === 6;
      const fill = 'var(--accent)';
      const opacity = isWeekend ? 0.45 : 0.15;
      return `<rect x="${(x - barWidth / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(0, barHeight).toFixed(1)}" fill="${fill}" opacity="${opacity}" />`;
    })
    .join('');

  const last = points[points.length - 1];
  const lastLabel = formatValue ? formatValue(last.value) : String(last.value);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      ${bars}
      <polyline points="${coords.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" />
    </svg>
    <div class="empty-state" style="padding-top:4px;">Latest: ${lastLabel}</div>
  `;
}

function renderWellnessStats() {
  const monthStart = new Date(wellnessCursor.getFullYear(), wellnessCursor.getMonth(), 1);
  const monthEnd = new Date(wellnessCursor.getFullYear(), wellnessCursor.getMonth() + 1, 1);
  const monthStartKey = toDateKey(monthStart);

  const recent = allWellness
    .filter((w) => {
      const d = parseDateKey(w.date);
      return d >= monthStart && d < monthEnd;
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const kgValues = recent.filter((w) => w.kg != null).map((w) => ({ date: w.date, value: w.kg }));
  const sleepValues = recent
    .filter((w) => w.somnHour != null)
    .map((w) => ({ date: w.date, value: w.somnHour + (w.somnQuarter || 0) / 60 }));
  const stepValues = recent.filter((w) => w.pasi != null).map((w) => ({ date: w.date, value: w.pasi }));

  $('wStatAvgKg').textContent = kgValues.length ? average(kgValues.map((v) => v.value)).toFixed(1) : '-';
  $('wStatAvgSleep').textContent = sleepValues.length ? average(sleepValues.map((v) => v.value)).toFixed(1) + 'h' : '-';
  $('wStatAvgSteps').textContent = stepValues.length ? average(stepValues.map((v) => v.value)).toFixed(1) + 'k' : '-';

  makeSparkline('wSparkKg', kgValues, (v) => `${v.toFixed(1)} kg`);
  makeSparkline('wSparkSleep', sleepValues, (v) => `${v.toFixed(1)}h`, true);
  makeSparkline('wSparkSteps', stepValues, (v) => `${v.toFixed(1)}k`, true);

  const habitCounts = {};
  for (const item of WELLNESS_CHECK_ITEMS) habitCounts[item.key] = 0;
  for (const w of recent) {
    for (const item of WELLNESS_CHECK_ITEMS) {
      if (w.checks && w.checks[item.key]) habitCounts[item.key]++;
    }
  }
  const totalDays = recent.length || 1;
  const breakdown = $('wHabitBreakdown');
  breakdown.innerHTML = '';
  for (const item of WELLNESS_CHECK_ITEMS) {
    const count = habitCounts[item.key];
    const pct = Math.round((count / totalDays) * 100);
    const row = document.createElement('div');
    row.className = 'type-row';
    row.innerHTML = `
      <span class="type-icon">${item.emoji}</span>
      <span class="type-name">${item.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:var(--accent)"></span></span>
      <span class="type-count">${pct}%</span>
    `;
    breakdown.appendChild(row);
  }
}

function renderWellnessAll() {
  renderWellnessCalendar();
  renderWellnessStats();
}

function buildChecklist(existingChecks) {
  const grid = $('checklistGrid');
  grid.innerHTML = '';
  for (const item of WELLNESS_CHECK_ITEMS) {
    const label = document.createElement('label');
    label.className = 'checklist-item';
    const checked = !!(existingChecks && existingChecks[item.key]);
    if (checked) label.classList.add('checked');
    label.innerHTML = `<input type="checkbox" data-key="${item.key}" ${checked ? 'checked' : ''}><span>${item.emoji} ${item.label}</span>`;
    const input = label.querySelector('input');
    input.addEventListener('change', () => label.classList.toggle('checked', input.checked));
    grid.appendChild(label);
  }
}

function populateSomnHourOptions() {
  const select = $('somnHourInput');
  select.innerHTML = '';
  for (let h = 0; h <= 16; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = String(h);
    select.appendChild(opt);
  }
}

function openWellnessModal(prefillDate) {
  const dateKey = prefillDate || toDateKey(new Date());
  const existing = wellnessByDate.get(dateKey);

  $('wellnessDateInput').value = dateKey;
  $('kgInput').value = existing && existing.kg != null ? existing.kg : (findPreviousKg(dateKey) ?? '');
  $('somnHourInput').value = existing && existing.somnHour != null ? String(existing.somnHour) : '8';
  $('somnQuarterInput').value = existing && existing.somnQuarter != null ? String(existing.somnQuarter) : '0';
  $('pasiInput').value = existing && existing.pasi != null ? existing.pasi : '';
  buildChecklist(existing ? existing.checks : null);

  $('wellnessModalOverlay').classList.add('open');
}

function closeWellnessModal() {
  $('wellnessModalOverlay').classList.remove('open');
}

async function handleWellnessFormSubmit(event) {
  event.preventDefault();
  const date = $('wellnessDateInput').value;
  const checks = {};
  $('checklistGrid').querySelectorAll('input[type="checkbox"]').forEach((input) => {
    checks[input.dataset.key] = input.checked;
  });

  const kgRaw = $('kgInput').value;
  const pasiRaw = $('pasiInput').value;

  const entry = {
    date,
    kg: kgRaw !== '' ? Math.round(Number(kgRaw) * 10) / 10 : null,
    somnHour: Number($('somnHourInput').value),
    somnQuarter: Number($('somnQuarterInput').value),
    checks,
    pasi: pasiRaw !== '' ? Math.round(Number(pasiRaw) * 10) / 10 : null,
  };

  try {
    await window.FitnessDB.putWellness(entry);
    showToast(isPerfectDay(entry) ? 'Perfect day! 🎉' : 'Check-in salvat');
    closeWellnessModal();
    await loadWellness();
    renderWellnessAll();
    renderWellnessQuickLogRow();
    if (isPerfectDay(entry)) launchFireworks();
  } catch (err) {
    console.error('Failed to save wellness entry', err);
    showToast(`Error saving check-in: ${err.message}`);
  }
}

// ---------- Pages navigation ----------

function goToPage(index) {
  currentPageIndex = Math.max(0, Math.min(1, index));
  const container = $('pagesContainer');
  container.style.transform = `translateX(-${currentPageIndex * 50}%)`;
  const fab = $('addSessionFab');
  fab.setAttribute('aria-label', currentPageIndex === 0 ? 'Log a session' : 'Log a wellness check-in');

  const indicator = $('pageIndicator');
  if (indicator) {
    indicator.querySelectorAll('.page-indicator-dot').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.page) === currentPageIndex);
    });
  }
}

function initPageNavigation() {

  const indicator = $('pageIndicator');
  if (indicator) {
    indicator.querySelectorAll('.page-indicator-dot').forEach((dot) => {
      dot.addEventListener('click', () => goToPage(Number(dot.dataset.page)));
    });
  }
}

// ---------- Session modal ----------

function buildQuickLogRow() {
  const row = $('quickLogRow');
  if (!row) return;
  row.innerHTML = '';
  for (const [key, def] of Object.entries(ACTIVITY_TYPES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-log-btn';
    btn.dataset.type = key;
    btn.style.setProperty('--type-color', def.color);
    btn.innerHTML = `<span class="quick-log-emoji">${def.emoji}</span><span class="quick-log-name">${def.label}</span>`;
    btn.addEventListener('click', () => quickLogSession(key));
    row.appendChild(btn);
  }
  renderQuickLogRow();
}

function renderQuickLogRow() {
  const row = $('quickLogRow');
  if (!row) return;
  const today = toDateKey(new Date());
  const todaysSessions = sessionsByDate.get(today) || [];
  const loggedTypes = new Set(todaysSessions.map((s) => s.type));
  row.querySelectorAll('.quick-log-btn').forEach((btn) => {
    btn.classList.toggle('active', loggedTypes.has(btn.dataset.type));
  });
}

// Each activity type can only be logged once per day, but multiple different
// types are allowed the same day (e.g. bike + run). Tapping an already-logged
// type removes just that entry (toggle off); tapping a new type adds it.
async function quickLogSession(type) {
  const today = toDateKey(new Date());
  const todaysSessions = sessionsByDate.get(today) || [];
  const existing = todaysSessions.find((s) => s.type === type);

  try {
    const def = ACTIVITY_TYPES[type];
    if (existing) {
      await window.FitnessDB.deleteSession(existing.id);
      await loadSessions();
      renderAll();
      if (currentDayModalDate) renderDaySessionsList(currentDayModalDate);
      showToast(`${def.emoji} ${def.label} removed for today.`);
      return;
    }

    const session = {
      type,
      date: today,
      duration: null,
      notes: '',
      timestamp: Date.now(),
    };
    await window.FitnessDB.addSession(session);
    await loadSessions();
    renderAll();
    if (currentDayModalDate) renderDaySessionsList(currentDayModalDate);
    showToast(`${def.emoji} ${def.label} logged for today!`);
  } catch (err) {
    console.error('Failed to quick-log session', err);
    showToast(`Error saving session: ${err.message}`);
  }
}

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
  selectFirstTypeOption('workout');
  $('dateInput').value = prefillDate || toDateKey(new Date());
  $('sessionModalOverlay').classList.add('open');
}

function closeSessionModal() {
  $('sessionModalOverlay').classList.remove('open');
}

function openEditSessionModal(session) {
  closeDayModal();
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

  // Each activity type can only be logged once per day (multiple different
  // types the same day are fine, e.g. bike + run).
  const sessionsOnDate = sessionsByDate.get(session.date) || [];
  const duplicate = sessionsOnDate.find((s) => s.type === session.type && String(s.id) !== editingId);
  if (duplicate) {
    const def = ACTIVITY_TYPES[session.type];
    showToast(`${def.emoji} ${def.label} is already logged for that day.`);
    return;
  }

  try {
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
  } catch (err) {
    console.error('Failed to save session', err);
    showToast(`Error saving session: ${err.message}`);
  }
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
  const streakBadge = $('streakBadge');
  streakBadge.addEventListener('click', toggleStreakMode);
  streakBadge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleStreakMode();
    }
  });

  $('prevMonthBtn').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    renderCalendar();
    renderStats();
  });
  $('nextMonthBtn').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    renderCalendar();
    renderStats();
  });

  $('addSessionFab').addEventListener('click', () => {
    if (currentPageIndex === 0) openSessionModal();
    else openWellnessModal();
  });
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

  $('prevWellnessMonthBtn').addEventListener('click', () => {
    wellnessCursor.setMonth(wellnessCursor.getMonth() - 1);
    renderWellnessCalendar();
    renderWellnessStats();
  });
  $('nextWellnessMonthBtn').addEventListener('click', () => {
    wellnessCursor.setMonth(wellnessCursor.getMonth() + 1);
    renderWellnessCalendar();
    renderWellnessStats();
  });
  $('closeWellnessModalBtn').addEventListener('click', closeWellnessModal);
  $('wellnessModalOverlay').addEventListener('click', (e) => {
    if (e.target === $('wellnessModalOverlay')) closeWellnessModal();
  });
  $('wellnessForm').addEventListener('submit', handleWellnessFormSubmit);

  initPageNavigation();
}

async function init() {
  try {
    initTheme();
    buildTypePicker();
    buildQuickLogRow();
    buildWellnessQuickLogRow();
    populateSomnHourOptions();
    attachEventListeners();
    await loadSessions();
    await loadWellness();
    renderAll();
    renderWellnessAll();
    renderWellnessQuickLogRow();
    goToPage(0);
  } catch (err) {
    console.error('init failed', err);
    showToast(`Error: ${err.message}`);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
  }
}

window.addEventListener('error', (event) => {
  console.error('Unhandled error', event.error || event.message);
  showToast(`Error: ${(event.error && event.error.message) || event.message}`);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection', event.reason);
  showToast(`Error: ${event.reason && event.reason.message ? event.reason.message : event.reason}`);
});

document.addEventListener('DOMContentLoaded', init);