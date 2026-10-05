// Pure view model: settings, week, planWeek result, today and now in; plain data out.
// No DOM, no clock, no storage.
import { formatTime, roundTo5, stepTime, minutesToHours } from '../domain/time.js';
import { weekKey, compareWeeks } from '../domain/week.js';
import { t, DEFAULT_LANG } from '../i18n.js';

export const DEFAULT_SETTINGS = Object.freeze({
  allowanceMinutes: 1800,
  openMinutes: 420,
  closeMinutes: 1020,
  normalStartMinutes: 480,
});

const WEEKDAYS = ['weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Minutes as H:MM (durations, may exceed 24 h). */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
}

function formatHours(minutes, lang) {
  const text = String(minutesToHours(minutes));
  return lang === 'de' ? text.replace('.', ',') : text;
}

function dateLabel(date, lang) {
  const [, m, d] = date.split('-').map(Number);
  if (lang === 'en') return d + ' ' + MONTHS_EN[m - 1];
  return String(d).padStart(2, '0') + '.' + String(m).padStart(2, '0') + '.';
}

function segment(kind, start, end, open, close) {
  const span = close - open;
  const clamp = (x) => Math.min(close, Math.max(open, x));
  const a = clamp(start);
  const b = Math.max(a, clamp(end));
  return { kind, start, end, left: ((a - open) / span) * 100, width: ((b - a) / span) * 100 };
}

function markerLeft(minutes, open, close) {
  const x = Math.min(close, Math.max(open, minutes));
  return ((x - open) / (close - open)) * 100;
}

function dayView(day, planned, index, ctx) {
  const { open, close, lang, today, expanded } = ctx;
  const isToday = day.date === today;
  const kind = planned.kind;
  let segments;
  if (kind === 'noKita') segments = [segment('noKita', open, close, open, close)];
  else segments = [segment(kind === 'complete' ? 'actual' : 'planned', planned.start, planned.end, open, close)];

  const lateComplete = kind === 'complete' && planned.end > close;
  const warn = planned.capped || lateComplete;
  const hasStart = !day.noKita && day.actualStart != null;

  return {
    date: day.date,
    weekday: t(lang, WEEKDAYS[index]),
    dateLabel: dateLabel(day.date, lang),
    isToday,
    expanded: Object.prototype.hasOwnProperty.call(expanded, day.date) ? !!expanded[day.date] : isToday,
    kind,
    noKita: kind === 'noKita',
    capped: planned.capped,
    warning: warn ? t(lang, 'afterClosing', { time: formatTime(close) }) : null,
    startText: planned.start == null ? '' : formatTime(planned.start),
    endText: planned.end == null ? '' : formatTime(planned.end),
    actualStartText: day.actualStart == null ? null : formatTime(day.actualStart),
    actualEndText: day.actualEnd == null ? null : formatTime(day.actualEnd),
    segments,
    startMarker: kind === 'started' ? { left: markerLeft(planned.start, open, close) } : null,
    controls: {
      startEnabled: !day.noKita,
      startBase: day.actualStart ?? day.plannedStart,
      endEnabled: hasStart,
      endBase: hasStart ? (day.actualEnd ?? planned.end ?? day.actualStart) : null,
      endMin: hasStart ? day.actualStart : null,
      canClear: day.actualStart != null || day.actualEnd != null || day.noKita,
    },
  };
}

/**
 * @param {{settings:object, week:object, plan:object, today:string, now:number,
 *   lang?:string, expanded?:Object<string, boolean>}} input
 */
export function buildView({ settings, week, plan, today, now, lang = DEFAULT_LANG, expanded = {} }) {
  const open = week.openMinutes;
  const close = week.closeMinutes;
  const currentKey = weekKey(today);
  const [year, wk] = week.key.split('-W').map(Number);

  const days = week.days.map((day, i) =>
    dayView(day, plan.days[i], i, { open, close, lang, today, expanded }));

  const todayDay = week.days.find((d) => d.date === today);
  const nowMinutes = stepTime(roundTo5(now), 0);
  const over = plan.usedMinutes + plan.plannedMinutes - week.allowanceMinutes;

  return {
    lang,
    title: t(lang, 'appTitle'),
    languageLabel: t(lang, 'language'),
    header: {
      used: t(lang, 'usedOfAllowance', {
        used: formatDuration(plan.usedMinutes),
        allowance: formatHours(week.allowanceMinutes, lang),
      }),
      overLimit: plan.overAllowance ? t(lang, 'overLimit', { over: formatDuration(over) }) : null,
      closingWarning: plan.overClosing ? t(lang, 'afterClosing', { time: formatTime(close) }) : null,
    },
    settings: {
      title: t(lang, 'settingsTitle'),
      allowanceLabel: t(lang, 'allowance'),
      allowanceHours: minutesToHours(settings.allowanceMinutes),
      openLabel: t(lang, 'openTime'),
      openText: formatTime(settings.openMinutes),
      closeLabel: t(lang, 'closeTime'),
      closeText: formatTime(settings.closeMinutes),
      normalStartLabel: t(lang, 'normalStart'),
      normalStartText: formatTime(settings.normalStartMinutes),
    },
    now: {
      visible: !!todayDay,
      date: todayDay ? today : null,
      minutes: nowMinutes,
      dropOffLabel: t(lang, 'dropOffNow'),
      pickUpLabel: t(lang, 'pickUpNow'),
      canDropOff: !!todayDay && !todayDay.noKita,
      canPickUp: !!todayDay && !todayDay.noKita && todayDay.actualStart != null,
    },
    nav: {
      label: t(lang, 'weekLabel', { week: wk, year }),
      prevLabel: t(lang, 'prevWeek'),
      nextLabel: t(lang, 'nextWeek'),
      canNext: compareWeeks(week.key, currentKey) < 0,
      isCurrent: week.key === currentKey,
    },
    days,
    labels: {
      noKita: t(lang, 'noKita'),
      clear: t(lang, 'clear'),
    },
    legend: [
      { kind: 'unused', label: t(lang, 'legendUnused') },
      { kind: 'noKita', label: t(lang, 'legendNoKita') },
      { kind: 'actual', label: t(lang, 'legendActual') },
      { kind: 'planned', label: t(lang, 'legendPlanned') },
    ],
  };
}
