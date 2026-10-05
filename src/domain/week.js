const DAY_MS = 86400000;

function toMs(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function isoDow(ms) {
  return new Date(ms).getUTCDay() || 7;
}

function mondayOfWeek1(year) {
  const jan4 = Date.UTC(year, 0, 4);
  return jan4 - (isoDow(jan4) - 1) * DAY_MS;
}

function parseKey(key) {
  const [year, week] = key.split('-W').map(Number);
  return { year, week };
}

function formatKey(year, week) {
  return year + '-W' + String(week).padStart(2, '0');
}

export function weekKey(date) {
  const ms = toMs(date);
  const thursday = ms + (4 - isoDow(ms)) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return formatKey(year, week);
}

function mondayMs(key) {
  const { year, week } = parseKey(key);
  return mondayOfWeek1(year) + (week - 1) * 7 * DAY_MS;
}

export function weekDates(key) {
  const monday = mondayMs(key);
  return [0, 1, 2, 3, 4].map((i) => toDate(monday + i * DAY_MS));
}

export function shiftWeek(key, weeks) {
  return weekKey(toDate(mondayMs(key) + weeks * 7 * DAY_MS));
}

export function compareWeeks(a, b) {
  const x = parseKey(a);
  const y = parseKey(b);
  return x.year - y.year || x.week - y.week;
}

export function createWeek(key, settings) {
  return {
    key,
    allowanceMinutes: settings.allowanceMinutes,
    openMinutes: settings.openMinutes,
    closeMinutes: settings.closeMinutes,
    days: weekDates(key).map((date) => ({
      date,
      plannedStart: settings.normalStartMinutes,
      actualStart: null,
      actualEnd: null,
      noKita: false,
    })),
  };
}

function updateDay(week, date, change) {
  return { ...week, days: week.days.map((d) => (d.date === date ? { ...d, ...change(d) } : d)) };
}

export function applySettings(week, settings, today) {
  return {
    ...week,
    allowanceMinutes: settings.allowanceMinutes,
    openMinutes: settings.openMinutes,
    closeMinutes: settings.closeMinutes,
    days: week.days.map((d) =>
      d.date >= today ? { ...d, plannedStart: settings.normalStartMinutes } : { ...d }),
  };
}

export function setActualStart(week, date, minutes) {
  return updateDay(week, date, () => ({ actualStart: minutes }));
}

export function setActualEnd(week, date, minutes) {
  return updateDay(week, date, (d) => {
    if (minutes === null) return { actualEnd: null };
    const start = d.actualStart ?? d.plannedStart;
    return { actualEnd: Math.max(minutes, start) };
  });
}

export function toggleNoKita(week, date) {
  return updateDay(week, date, (d) => ({ noKita: !d.noKita }));
}
