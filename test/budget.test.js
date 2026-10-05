import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWeek } from '../src/domain/budget.js';

const hm = (h, m = 0) => h * 60 + m;

function makeWeek({ allowanceMinutes, days = {} }) {
  const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
  return {
    allowanceMinutes,
    openMinutes: hm(7),
    closeMinutes: hm(17),
    days: dates.map((date, i) => ({
      date,
      plannedStart: hm(8),
      actualStart: null,
      actualEnd: null,
      noKita: false,
      ...(days[i] || {}),
    })),
  };
}

test('worked example: 1800 allowance, Mon 08:00-13:40 complete, Tue started 08:20 -> Tue ends 14:25, Wed-Fri 08:00-14:05', () => {
  const week = makeWeek({
    allowanceMinutes: 1800,
    days: {
      0: { actualStart: hm(8), actualEnd: hm(13, 40) },
      1: { actualStart: hm(8, 20) },
    },
  });
  const r = planWeek(week);
  assert.equal(r.usedMinutes, 340);
  assert.deepEqual(r.days[0], { date: '2026-10-05', start: hm(8), end: hm(13, 40), kind: 'complete' });
  assert.equal(r.days[1].kind, 'started');
  assert.equal(r.days[1].start, hm(8, 20));
  assert.equal(r.days[1].end, hm(14, 25));
  for (const d of r.days.slice(2)) {
    assert.equal(d.kind, 'planned');
    assert.equal(d.start, hm(8));
    assert.equal(d.end, hm(14, 5));
  }
  assert.equal(r.plannedMinutes, 4 * 365);
  assert.equal(r.overAllowance, false);
  assert.equal(r.unusedMinutes, 0);
});

test('30h from 08:00 with no actuals gives 08:00-14:00 on all five days', () => {
  const r = planWeek(makeWeek({ allowanceMinutes: 1800 }));
  assert.equal(r.usedMinutes, 0);
  assert.equal(r.plannedMinutes, 1800);
  for (const d of r.days) {
    assert.equal(d.kind, 'planned');
    assert.equal(d.start, hm(8));
    assert.equal(d.end, hm(14));
  }
});

test('leftover 5-minute steps go one each to the earliest remaining days', () => {
  // 1815 = 363 steps; 363 / 5 = 72 r 3 -> Mon-Wed 365, Thu-Fri 360
  const r = planWeek(makeWeek({ allowanceMinutes: 1815 }));
  const shares = r.days.map((d) => d.end - d.start);
  assert.deepEqual(shares, [365, 365, 365, 360, 360]);
  assert.equal(r.plannedMinutes, 1815);
});

test('leftover never exceeds the remaining budget when it is not a multiple of 5', () => {
  // 1817 -> floor to 363 steps = 1815
  const r = planWeek(makeWeek({ allowanceMinutes: 1817 }));
  const shares = r.days.map((d) => d.end - d.start);
  assert.deepEqual(shares, [365, 365, 365, 360, 360]);
  assert.ok(r.plannedMinutes <= 1817);
  assert.equal(r.unusedMinutes, 2);
});

test('a noKita day raises the other days share and ignores stored actuals', () => {
  const r = planWeek(makeWeek({
    allowanceMinutes: 1800,
    days: { 2: { noKita: true, actualStart: hm(8), actualEnd: hm(12) } },
  }));
  assert.equal(r.days[2].kind, 'noKita');
  assert.equal(r.days[2].start, null);
  assert.equal(r.days[2].end, null);
  assert.equal(r.usedMinutes, 0);
  for (const i of [0, 1, 3, 4]) {
    assert.equal(r.days[i].kind, 'planned');
    assert.equal(r.days[i].end - r.days[i].start, 450);
  }
});

test('a share past 17:00 ends at closing and the rest moves to the other days', () => {
  const r = planWeek(makeWeek({
    allowanceMinutes: 2400,
    days: { 0: { plannedStart: hm(12) } },
  }));
  // share 480: Mon 12:00 + 480 = 20:00 -> 17:00 (300); the other 2100 over Tue-Fri = 525 each
  assert.equal(r.days[0].end, hm(17));
  for (const d of r.days.slice(1)) {
    assert.equal(d.end, hm(16, 45));
  }
  assert.equal(r.plannedMinutes, 2400);
  assert.equal(r.unusedMinutes, 0);
});

test('late drop-off today plus a noKita day: today ends at closing, the rest goes to the other days', () => {
  const r = planWeek(makeWeek({
    allowanceMinutes: 1800,
    days: { 0: { actualStart: hm(11) }, 1: { noKita: true } },
  }));
  // 1800 over Mon, Wed-Fri = 450 each; Mon 11:00 fits only 360 -> 17:00, Wed-Fri share 1440 = 480 each
  assert.equal(r.days[0].kind, 'started');
  assert.equal(r.days[0].end, hm(17));
  for (const d of r.days.slice(2)) assert.equal(d.end, hm(16));
  assert.equal(r.plannedMinutes, 1800);
  assert.equal(r.unusedMinutes, 0);
});

test('what does not fit before closing on any day is reported as unused', () => {
  const r = planWeek(makeWeek({ allowanceMinutes: 3600 }));
  for (const d of r.days) assert.equal(d.end, hm(17));
  assert.equal(r.plannedMinutes, 2700);
  assert.equal(r.unusedMinutes, 900);
});

test('actuals above the allowance give share 0, overAllowance and nothing unused', () => {
  const r = planWeek(makeWeek({
    allowanceMinutes: 600,
    days: {
      0: { actualStart: hm(8), actualEnd: hm(14) },
      1: { actualStart: hm(8), actualEnd: hm(14) },
    },
  }));
  assert.equal(r.usedMinutes, 720);
  for (const d of r.days.slice(2)) {
    assert.equal(d.end - d.start, 0);
  }
  assert.equal(r.plannedMinutes, 0);
  assert.equal(r.overAllowance, true);
  assert.equal(r.unusedMinutes, 0);
});

test('planWeek does not mutate its input', () => {
  const week = makeWeek({ allowanceMinutes: 1800, days: { 0: { actualStart: hm(8), actualEnd: hm(13, 40) } } });
  const before = JSON.stringify(week);
  planWeek(week);
  assert.equal(JSON.stringify(week), before);
});
