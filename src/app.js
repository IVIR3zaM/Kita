// Thin shell: storage, events, rendering. The only module that reads the clock.
import { parseTime, stepTime, parseHours } from './domain/time.js';
import {
  weekKey, shiftWeek, compareWeeks, createWeek, applySettings,
  setActualStart, setActualEnd, toggleNoKita,
} from './domain/week.js';
import { planWeek } from './domain/budget.js';
import { LANGS, DEFAULT_LANG } from './i18n.js';
import * as storage from './storage.js';
import { buildView, DEFAULT_SETTINGS } from './ui/view.js';

const STEP = 5;

const state = {
  settings: { ...DEFAULT_SETTINGS },
  lang: DEFAULT_LANG,
  key: null,
  week: null,
  saved: false,
  expanded: {},
  settingsOpen: false,
};

const root = document.getElementById('app');

// ---- clock (only here) ----
function clock() {
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  return { today, now: d.getHours() * 60 + d.getMinutes() };
}

// ---- storage helpers ----
async function safe(promise, fallback = null) {
  try {
    return await promise;
  } catch (err) {
    console.error(err);
    return fallback;
  }
}

async function showWeek(key) {
  const stored = await safe(storage.loadWeek(key));
  state.key = key;
  state.week = stored ?? createWeek(key, state.settings);
  state.saved = !!stored;
  state.expanded = {};
  render();
}

async function editWeek(change) {
  state.week = change(state.week);
  state.saved = true;
  render();
  await safe(storage.saveWeek(state.key, state.week));
}

// ---- actions ----
function dayOf(date) {
  return state.week.days.find((d) => d.date === date);
}

function withEndClamped(week, date) {
  const day = week.days.find((d) => d.date === date);
  return day.actualEnd != null ? setActualEnd(week, date, day.actualEnd) : week;
}

function stepStart(date, delta) {
  const day = dayOf(date);
  if (day.noKita) return;
  const base = day.actualStart ?? day.plannedStart;
  const value = stepTime(base, delta);
  editWeek((w) => withEndClamped(setActualStart(w, date, value), date));
}

function stepEnd(date, delta) {
  const day = dayOf(date);
  if (day.noKita || day.actualStart == null) return;
  const planned = planWeek(state.week).days.find((d) => d.date === date);
  const base = day.actualEnd ?? planned.end ?? day.actualStart;
  const value = Math.max(day.actualStart, stepTime(base, delta));
  editWeek((w) => setActualEnd(w, date, value));
}

function clearDay(date) {
  editWeek((w) => {
    let next = setActualEnd(setActualStart(w, date, null), date, null);
    if (next.days.find((d) => d.date === date).noKita) next = toggleNoKita(next, date);
    return next;
  });
}

function nowAction(kind) {
  const { today, now } = clock();
  const view = buildView({ ...viewInput(), today, now });
  if (!view.now.visible) return;
  const minutes = view.now.minutes;
  if (kind === 'dropOff' && view.now.canDropOff) {
    editWeek((w) => withEndClamped(setActualStart(w, today, minutes), today));
  } else if (kind === 'pickUp' && view.now.canPickUp) {
    editWeek((w) => setActualEnd(w, today, minutes));
  }
}

async function changeSettings(field, raw) {
  const next = { ...state.settings };
  if (field === 'allowanceMinutes') {
    const n = parseHours(raw);
    if (n == null) return render();
    next.allowanceMinutes = n;
  } else {
    if (!/^\d{1,2}:\d{2}/.test(raw)) return render();
    next[field] = parseTime(raw.slice(0, 5));
  }
  if (next.closeMinutes <= next.openMinutes) return render();
  state.settings = next;
  await safe(storage.saveSettings(next));

  const { today } = clock();
  const currentKey = weekKey(today);
  if (state.key === currentKey) {
    if (state.saved) {
      state.week = applySettings(state.week, next, today);
      await safe(storage.saveWeek(state.key, state.week));
    } else {
      state.week = createWeek(state.key, next);
    }
  } else {
    if (!state.saved) state.week = createWeek(state.key, next);
    const stored = await safe(storage.loadWeek(currentKey));
    if (stored) await safe(storage.saveWeek(currentKey, applySettings(stored, next, today)));
  }
  render();
}

async function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  state.lang = lang;
  render();
  await safe(storage.saveLang(lang));
}

// ---- rendering ----
function viewInput() {
  return {
    settings: state.settings,
    week: state.week,
    plan: planWeek(state.week),
    lang: state.lang,
    expanded: state.expanded,
  };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function stepper(action, date, value, enabled, cls) {
  const dis = enabled ? '' : ' disabled';
  return `<div class="stepper ${cls}">
    <button type="button" data-action="${action}" data-date="${date}" data-delta="${-STEP}"${dis} aria-label="-${STEP}">&minus;</button>
    <output>${esc(value)}</output>
    <button type="button" data-action="${action}" data-date="${date}" data-delta="${STEP}"${dis} aria-label="+${STEP}">+</button>
  </div>`;
}

function dayHtml(d, labels) {
  const segs = d.segments.map((s) =>
    `<span class="seg seg-${s.kind}" style="left:${s.left}%;width:${s.width}%"></span>`).join('');
  const marker = d.startMarker ? `<span class="marker" style="left:${d.startMarker.left}%"></span>` : '';
  const times = d.noKita ? esc(labels.noKita)
    : `<span class="${d.actualStartText ? 'actual' : 'planned'}">${esc(d.startText)}</span>&ndash;` +
      `<span class="${d.kind === 'complete' ? 'actual' : 'planned'}">${esc(d.endText)}</span>`;
  const startShown = d.actualStartText ?? d.startText ?? '';
  const endShown = d.actualEndText ?? (d.controls.endEnabled ? d.endText : '--:--');
  const classes = ['day', d.isToday ? 'today' : '', d.expanded ? 'expanded' : '', d.noKita ? 'nokita' : '',
    d.warning ? 'warn' : ''].filter(Boolean).join(' ');
  return `<li class="${classes}">
    <button type="button" class="day-head" data-action="toggle" data-date="${d.date}" aria-expanded="${d.expanded}">
      <span class="day-name">${esc(d.weekday)} <small>${esc(d.dateLabel)}</small></span>
      <span class="day-times">${times}</span>
      <span class="bar">${segs}${marker}</span>
      ${d.warning ? `<span class="warning">&#9888; ${esc(d.warning)}</span>` : ''}
    </button>
    ${d.expanded ? `<div class="controls">
      <div class="steppers">
        ${stepper('start', d.date, d.noKita ? '--:--' : startShown, d.controls.startEnabled, d.actualStartText ? 'is-actual' : 'is-planned')}
        <span class="dash">&ndash;</span>
        ${stepper('end', d.date, endShown, d.controls.endEnabled, d.actualEndText ? 'is-actual' : 'is-planned')}
      </div>
      <div class="day-actions">
        <label class="check"><input type="checkbox" data-action="noKita" data-date="${d.date}"${d.noKita ? ' checked' : ''}> ${esc(labels.noKita)}</label>
        <button type="button" class="ghost" data-action="clear" data-date="${d.date}"${d.controls.canClear ? '' : ' disabled'}>${esc(labels.clear)}</button>
      </div>
    </div>` : ''}
  </li>`;
}

function render() {
  if (!state.week) return;
  const { today, now } = clock();
  const v = buildView({ ...viewInput(), today, now });
  document.documentElement.lang = v.lang;
  document.title = v.title;
  const s = v.settings;
  const langButtons = LANGS.map((l) =>
    `<button type="button" data-action="lang" data-lang="${l}" aria-pressed="${l === v.lang}">${l.toUpperCase()}</button>`).join('');

  root.innerHTML = `
  <header class="top">
    <div class="title-row">
      <h1>${esc(v.title)}</h1>
      <div class="lang" role="group" aria-label="${esc(v.languageLabel)}">${langButtons}</div>
    </div>
    <p class="used${v.header.overLimit ? ' over' : ''}">${esc(v.header.used)}</p>
    ${v.header.overLimit ? `<p class="alert">&#9888; ${esc(v.header.overLimit)}</p>` : ''}
    ${v.header.closingWarning ? `<p class="alert soft">&#9888; ${esc(v.header.closingWarning)}</p>` : ''}
  </header>

  <details class="settings"${state.settingsOpen ? ' open' : ''}>
    <summary>${esc(s.title)}</summary>
    <div class="settings-grid">
      <label>${esc(s.allowanceLabel)}
        <input type="number" inputmode="decimal" min="0" step="0.5" data-setting="allowanceMinutes" value="${s.allowanceHours}">
      </label>
      <label>${esc(s.openLabel)}<input type="time" step="300" data-setting="openMinutes" value="${s.openText}"></label>
      <label>${esc(s.closeLabel)}<input type="time" step="300" data-setting="closeMinutes" value="${s.closeText}"></label>
      <label>${esc(s.normalStartLabel)}<input type="time" step="300" data-setting="normalStartMinutes" value="${s.normalStartText}"></label>
    </div>
  </details>

  ${v.now.visible ? `<div class="now">
    <button type="button" class="primary" data-action="dropOff"${v.now.canDropOff ? '' : ' disabled'}>${esc(v.now.dropOffLabel)}</button>
    <button type="button" class="primary" data-action="pickUp"${v.now.canPickUp ? '' : ' disabled'}>${esc(v.now.pickUpLabel)}</button>
  </div>` : ''}

  <nav class="weeknav">
    <button type="button" data-action="prev" aria-label="${esc(v.nav.prevLabel)}" title="${esc(v.nav.prevLabel)}">&lsaquo;</button>
    <span class="week-label">${esc(v.nav.label)}</span>
    <button type="button" data-action="next" aria-label="${esc(v.nav.nextLabel)}" title="${esc(v.nav.nextLabel)}"${v.nav.canNext ? '' : ' disabled'}>&rsaquo;</button>
  </nav>

  <ol class="days">${v.days.map((d) => dayHtml(d, v.labels)).join('')}</ol>

  <ul class="legend">${v.legend.map((l) =>
    `<li><span class="swatch seg-${l.kind}"></span>${esc(l.label)}</li>`).join('')}</ul>`;
}

// ---- events ----
root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || el.type === 'checkbox') return;
  const { action, date } = el.dataset;
  const delta = Number(el.dataset.delta);
  switch (action) {
    case 'toggle': {
      const day = buildView({ ...viewInput(), ...clock() }).days.find((d) => d.date === date);
      state.expanded = { ...state.expanded, [date]: !day.expanded };
      render();
      break;
    }
    case 'start': stepStart(date, delta); break;
    case 'end': stepEnd(date, delta); break;
    case 'clear': clearDay(date); break;
    case 'dropOff': nowAction('dropOff'); break;
    case 'pickUp': nowAction('pickUp'); break;
    case 'lang': setLang(el.dataset.lang); break;
    case 'prev': showWeek(shiftWeek(state.key, -1)); break;
    case 'next': {
      const next = shiftWeek(state.key, 1);
      if (compareWeeks(next, weekKey(clock().today)) <= 0) showWeek(next);
      break;
    }
    default: break;
  }
});

root.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'noKita') {
    editWeek((w) => toggleNoKita(w, el.dataset.date));
  } else if (el.dataset.setting) {
    changeSettings(el.dataset.setting, el.value);
  }
});

root.addEventListener('toggle', (e) => {
  if (e.target.classList?.contains('settings')) state.settingsOpen = e.target.open;
}, true);

function refreshClock() {
  const active = document.activeElement;
  if (active && active.matches?.('input')) return;
  render();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshClock();
});
setInterval(refreshClock, 60000);

// ---- boot ----
async function boot() {
  const [settings, lang] = await Promise.all([
    safe(storage.loadSettings()),
    safe(storage.loadLang()),
  ]);
  if (settings) state.settings = { ...DEFAULT_SETTINGS, ...settings };
  if (lang && LANGS.includes(lang)) state.lang = lang;
  await showWeek(weekKey(clock().today));
}

boot();
