import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildView, DEFAULT_SETTINGS } from '../src/ui/view.js';
import { planWeek } from '../src/domain/budget.js';
import { createWeek, setActualStart, setActualEnd, toggleNoKita } from '../src/domain/week.js';

const hm = (h, m = 0) => h * 60 + m;
const KEY = '2026-W41';
const settings = { allowanceMinutes: 1800, openMinutes: hm(7), closeMinutes: hm(17), normalStartMinutes: hm(8) };
const pct = (m) => ((m - hm(7)) / 600) * 100;

function view(week, opts = {}) {
  return buildView({
    settings, week, plan: planWeek(week), today: '2026-10-06', now: hm(10, 2), lang: 'de',
    expanded: {}, ...opts,
  });
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

function assertSeg(seg, kind, start, end) {
  assert.equal(seg.kind, kind);
  assert.equal(seg.start, start);
  assert.equal(seg.end, end);
  close(seg.left, pct(start));
  close(seg.width, pct(end) - pct(start));
}

function workedExample() {
  let week = createWeek(KEY, settings);
  week = setActualStart(week, '2026-10-05', hm(8));
  week = setActualEnd(week, '2026-10-05', hm(13, 40));
  week = setActualStart(week, '2026-10-06', hm(8, 20));
  return week;
}

test('defaults are 30 h, 07:00-17:00, 08:00', () => {
  assert.deepEqual(DEFAULT_SETTINGS, settings);
});

test('worked example maps to bar segments as percent of opening hours', () => {
  const v = view(workedExample());
  const [mon, tue, ...rest] = v.days;
  assert.equal(mon.segments.length, 1);
  assertSeg(mon.segments[0], 'actual', hm(8), hm(13, 40));
  assert.equal(tue.segments.length, 1);
  assertSeg(tue.segments[0], 'planned', hm(8, 20), hm(14, 25));
  assert.equal(tue.actualStartText, '08:20');
  close(tue.startMarker.left, pct(hm(8, 20)));
  assert.equal(tue.endText, '14:25');
  for (const d of rest) {
    assert.equal(d.segments.length, 1);
    assertSeg(d.segments[0], 'planned', hm(8), hm(14, 5));
    assert.equal(d.startMarker, null);
  }
});

test('a noKita day yields one whole-bar noKita segment', () => {
  const week = toggleNoKita(workedExample(), '2026-10-07');
  const v = view(week);
  const wed = v.days[2];
  assert.deepEqual(wed.segments, [{ kind: 'noKita', start: hm(7), end: hm(17), left: 0, width: 100 }]);
  assert.equal(wed.noKita, true);
});

test('header shows used (complete days) vs allowance in German by default', () => {
  const v = view(workedExample());
  assert.equal(v.header.used, '5:40 von 30 h genutzt');
  assert.equal(v.header.overLimit, null);
  assert.equal(v.lang, 'de');
});

test('fresh week: all five days planned 08:00-14:00', () => {
  const v = view(createWeek(KEY, settings), { today: '2026-10-05' });
  for (const d of v.days) assertSeg(d.segments[0], 'planned', hm(8), hm(14));
  assert.equal(v.header.used, '0:00 von 30 h genutzt');
});

test('over limit and capped days carry warnings', () => {
  let week = createWeek(KEY, { ...settings, allowanceMinutes: 300 });
  week = setActualStart(week, '2026-10-05', hm(8));
  week = setActualEnd(week, '2026-10-05', hm(14));
  const v = view(week, { settings: { ...settings, allowanceMinutes: 300 }, lang: 'en' });
  assert.equal(v.header.overLimit, 'Weekly allowance exceeded by 1:00');

  let late = createWeek(KEY, { ...settings, allowanceMinutes: 3600 });
  const v2 = view(late, { lang: 'en' });
  assert.ok(v2.days.every((d) => d.capped && d.warning === 'Pick-up after closing time (17:00)'));
  assertSeg(v2.days[0].segments[0], 'planned', hm(8), hm(17));
});

test('now buttons: today only, rounded to 5, hidden on weekends and other weeks', () => {
  const v = view(workedExample());
  assert.equal(v.now.visible, true);
  assert.equal(v.now.date, '2026-10-06');
  assert.equal(v.now.minutes, hm(10));
  assert.equal(v.now.canPickUp, true);
  assert.equal(view(workedExample(), { today: '2026-10-10' }).now.visible, false);
  assert.equal(view(workedExample(), { today: '2026-10-13' }).now.visible, false);
});

test('controls: start steps from planned start, end disabled without start, today expanded', () => {
  const v = view(workedExample());
  const [mon, tue, wed] = v.days;
  assert.equal(tue.expanded, true);
  assert.equal(mon.expanded, false);
  assert.equal(wed.controls.startBase, hm(8));
  assert.equal(wed.controls.endEnabled, false);
  assert.equal(tue.controls.endEnabled, true);
  assert.equal(tue.controls.endBase, hm(14, 25));
  assert.equal(tue.controls.endMin, hm(8, 20));
  assert.equal(view(workedExample(), { expanded: { '2026-10-06': false, '2026-10-05': true } }).days[0].expanded, true);
});

test('navigation: next stops at the current week', () => {
  assert.equal(view(workedExample()).nav.canNext, false);
  assert.equal(view(workedExample(), { today: '2026-10-13' }).nav.canNext, true);
  assert.equal(view(workedExample()).nav.label, 'KW 41 · 2026');
});

test('settings expose the allowance as plain hours and no hint', () => {
  for (const lang of ['de', 'en']) {
    const v = view(createWeek(KEY, settings), { lang });
    assert.equal(v.settings.allowanceHours, 30);
    const v2 = view(createWeek(KEY, settings), { lang, settings: { ...settings, allowanceMinutes: 1650 } });
    assert.equal(v2.settings.allowanceHours, 27.5);
    assert.ok(!Object.values(v2.settings).some((x) => typeof x === 'string' && x.startsWith('= ')));
    assert.equal('allowanceMinutes' in v2.settings, false);
  }
  const de = view(createWeek(KEY, settings), { lang: 'de' });
  const en = view(createWeek(KEY, settings), { lang: 'en' });
  assert.equal(de.settings.allowanceLabel, 'Wochenkontingent (Stunden)');
  assert.equal(en.settings.allowanceLabel, 'Weekly allowance (hours)');
});
