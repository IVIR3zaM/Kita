import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, formatTime, roundTo5, stepTime } from '../src/domain/time.js';

test('parseTime converts HH:MM to minutes', () => {
  assert.equal(parseTime('00:00'), 0);
  assert.equal(parseTime('09:30'), 570);
  assert.equal(parseTime('23:55'), 1435);
});

test('formatTime converts minutes to HH:MM', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(570), '09:30');
  assert.equal(formatTime(1435), '23:55');
});

test('roundTo5 rounds to the nearest 5 minutes', () => {
  assert.equal(roundTo5(parseTime('13:42')), parseTime('13:40'));
  assert.equal(roundTo5(parseTime('13:43')), parseTime('13:45'));
  assert.equal(roundTo5(600), 600);
});

test('stepTime moves by 5 minutes and clamps to 00:00..23:55', () => {
  assert.equal(stepTime(540, 5), 545);
  assert.equal(stepTime(540, -5), 535);
  assert.equal(stepTime(0, -5), 0);
  assert.equal(stepTime(1435, 5), 1435);
});
