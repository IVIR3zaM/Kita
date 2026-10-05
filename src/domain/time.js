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
