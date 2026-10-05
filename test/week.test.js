import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  weekKey, weekDates, shiftWeek, compareWeeks, createWeek, applySettings,
  setActualStart, setActualEnd, toggleNoKita,
} from '../src/domain/week.js';

const settings = { allowanceMinutes: 1200, openMinutes: 480, closeMinutes: 1080, normalStartMinutes: 540 };

test('weekKey gives the ISO week of a date', () => {
  assert.equal(weekKey('2026-10-05'), '2026-W41');
  assert.equal(weekKey('2026-10-11'), '2026-W41');
  assert.equal(weekKey('2027-01-01'), '2026-W53');
  assert.equal(weekKey('2024-12-30'), '2025-W01');
});

test('weekDates lists Mon-Fri of a key', () => {
  assert.deepEqual(weekDates('2026-W41'),
    ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.deepEqual(weekDates('2026-W53')[4], '2027-01-01');
});

test('shiftWeek moves by whole weeks across year ends', () => {
  assert.equal(shiftWeek('2026-W41', 1), '2026-W42');
  assert.equal(shiftWeek('2026-W41', -1), '2026-W40');
  assert.equal(shiftWeek('2026-W01', -1), '2025-W52');
  assert.equal(shiftWeek('2026-W53', 1), '2027-W01');
});

test('compareWeeks orders keys', () => {
  assert.ok(compareWeeks('2025-W52', '2026-W01') < 0);
  assert.ok(compareWeeks('2026-W41', '2026-W40') > 0);
  assert.equal(compareWeeks('2026-W41', '2026-W41'), 0);
  assert.ok(compareWeeks('2026-W09', '2026-W10') < 0);
});

test('createWeek builds 5 days from settings', () => {
  const w = createWeek('2026-W41', settings);
  assert.equal(w.key, '2026-W41');
  assert.equal(w.allowanceMinutes, 1200);
  assert.equal(w.openMinutes, 480);
  assert.equal(w.closeMinutes, 1080);
  assert.equal(w.days.length, 5);
  assert.deepEqual(w.days[0],
    { date: '2026-10-05', plannedStart: 540, actualStart: null, actualEnd: null, noKita: false });
  assert.deepEqual(w.days.map((d) => d.date), weekDates('2026-W41'));
});

test('applySettings copies allowance and hours, plannedStart only from today on', () => {
  const w = createWeek('2026-W41', settings);
  const next = applySettings(w,
    { allowanceMinutes: 900, openMinutes: 420, closeMinutes: 1020, normalStartMinutes: 600 },
    '2026-10-07');
  assert.equal(next.allowanceMinutes, 900);
  assert.equal(next.openMinutes, 420);
  assert.equal(next.closeMinutes, 1020);
  assert.deepEqual(next.days.map((d) => d.plannedStart), [540, 540, 600, 600, 600]);
  assert.deepEqual(w.days.map((d) => d.plannedStart), [540, 540, 540, 540, 540]);
});

test('setActualStart sets and clears without mutating', () => {
  const w = createWeek('2026-W41', settings);
  const a = setActualStart(w, '2026-10-06', 555);
  assert.equal(a.days[1].actualStart, 555);
  assert.equal(w.days[1].actualStart, null);
  assert.equal(setActualStart(a, '2026-10-06', null).days[1].actualStart, null);
  assert.equal(a.days[0].actualStart, null);
});

test('setActualEnd sets, clears and clamps to the day start', () => {
  const w = createWeek('2026-W41', settings);
  const a = setActualEnd(w, '2026-10-06', 1000);
  assert.equal(a.days[1].actualEnd, 1000);
  assert.equal(w.days[1].actualEnd, null);
  assert.equal(setActualEnd(a, '2026-10-06', null).days[1].actualEnd, null);
  // below planned start (no actual start) clamps to planned start
  assert.equal(setActualEnd(w, '2026-10-06', 300).days[1].actualEnd, 540);
  // below actual start clamps to actual start
  const s = setActualStart(w, '2026-10-06', 600);
  assert.equal(setActualEnd(s, '2026-10-06', 300).days[1].actualEnd, 600);
});

test('toggleNoKita flips the flag without mutating', () => {
  const w = createWeek('2026-W41', settings);
  const a = toggleNoKita(w, '2026-10-08');
  assert.equal(a.days[3].noKita, true);
  assert.equal(w.days[3].noKita, false);
  assert.equal(toggleNoKita(a, '2026-10-08').days[3].noKita, false);
});
