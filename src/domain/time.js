const MAX_MINUTES = 23 * 60 + 55;

export function parseTime(text) {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function roundTo5(minutes) {
  return Math.round(minutes / 5) * 5;
}

export function stepTime(minutes, delta) {
  return Math.min(MAX_MINUTES, Math.max(0, minutes + delta));
}

export function hoursToMinutes(hours) {
  return roundTo5(Math.round(hours * 60));
}

export function minutesToHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}

// Typed hours ("30", "27.5", "27,5") to minutes rounded to 5; null if empty, negative or not a number.
export function parseHours(text) {
  const clean = String(text).trim().replace(',', '.');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? hoursToMinutes(n) : null;
}
