import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, STRINGS, LANGS, DEFAULT_LANG } from '../src/i18n.js';

test('German and English have identical key sets', () => {
  assert.deepEqual(Object.keys(STRINGS.de).sort(), Object.keys(STRINGS.en).sort());
  assert.ok(Object.keys(STRINGS.de).length > 0);
});

test('supported languages are de and en, default de', () => {
  assert.deepEqual([...LANGS].sort(), ['de', 'en']);
  assert.equal(DEFAULT_LANG, 'de');
});

test('unknown language falls back to German', () => {
  assert.equal(t('fr', 'appTitle'), t('de', 'appTitle'));
  assert.equal(t(undefined, 'clear'), t('de', 'clear'));
});

test('{name} placeholders are filled', () => {
  for (const lang of LANGS) {
    const out = t(lang, 'weekLabel', { week: 7, year: 2026 });
    assert.ok(out.includes('7') && out.includes('2026'), out);
    assert.ok(!/\{\w+\}/.test(out), out);
  }
  assert.equal(t('en', 'overLimit', { over: '0:30' }).includes('0:30'), true);
});

test('unfilled placeholders stay and unknown key returns the key', () => {
  assert.equal(t('en', 'weekLabel', {}).includes('{week}'), true);
  assert.equal(t('en', 'no.such.key'), 'no.such.key');
});

test('every weekday has a name in both languages', () => {
  for (const lang of LANGS) {
    for (const key of ['weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri']) {
      assert.ok(STRINGS[lang][key] && STRINGS[lang][key].length > 0, `${lang}.${key}`);
    }
  }
});

test('the closing-time warning string is gone', () => {
  for (const lang of LANGS) assert.equal(STRINGS[lang].afterClosing, undefined);
});

test('required UI keys exist in both languages', () => {
  const keys = ['appTitle', 'settingsTitle', 'allowance', 'openTime', 'closeTime', 'normalStart',
    'usedOfAllowance', 'overLimit', 'unusedThisWeek', 'dropOffNow', 'pickUpNow', 'noKita', 'clear',
    'prevWeek', 'nextWeek', 'weekLabel', 'legendUnused', 'legendNoKita', 'legendActual',
    'legendPlanned', 'language'];
  for (const lang of LANGS) for (const k of keys) assert.ok(STRINGS[lang][k], `${lang}.${k}`);
});
