import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFatigue, fatigueFlags, restEdge } from '../src/fatigue.js';

const ME = 1;
const g = (gameDate, home, offset = '-05:00', gameType = 2) => ({
  gameDate, gameType, venueUTCOffset: offset,
  homeTeam: { id: home ? ME : 99 }, awayTeam: { id: home ? 99 : ME }, venue: { default: 'Arena' },
});

test('no game on the date returns null', () => {
  assert.equal(computeFatigue([g('2026-10-10', true)], '2026-10-11', ME), null);
});

test('season opener has no rest data and no flags', () => {
  const f = computeFatigue([g('2026-10-08', true)], '2026-10-08', ME);
  assert.equal(f.restDays, null);
  assert.equal(f.backToBack, false);
  assert.deepEqual(fatigueFlags(f), []);
});

test('back-to-back and where the first leg was played', () => {
  const f = computeFatigue([g('2026-10-07', true), g('2026-10-08', false)], '2026-10-08', ME);
  assert.equal(f.backToBack, true);
  assert.equal(f.backToBackLastHome, true);
  assert.equal(fatigueFlags(f)[0].short, 'B2B');
});

test('three games in four nights counts tonight and stops at the window edge', () => {
  const inside = computeFatigue([g('2026-10-05', true), g('2026-10-06', true), g('2026-10-08', true)], '2026-10-08', ME);
  assert.equal(inside.gamesInFour, 3);
  assert.equal(inside.threeInFour, true);
  const outside = computeFatigue([g('2026-10-04', true), g('2026-10-06', true), g('2026-10-08', true)], '2026-10-08', ME);
  assert.equal(outside.gamesInFour, 2);
  assert.equal(outside.threeInFour, false);
});

test('rest days and long-rest flag', () => {
  const f = computeFatigue([g('2026-10-03', true), g('2026-10-07', true)], '2026-10-07', ME);
  assert.equal(f.restDays, 3);
  assert.equal(fatigueFlags(f)[0].short, '3D REST');
});

test('road trip and home stand counters', () => {
  const road = computeFatigue([g('2026-10-01', true), g('2026-10-03', false), g('2026-10-05', false), g('2026-10-07', false)], '2026-10-07', ME);
  assert.equal(road.roadTripGame, 3);
  assert.equal(road.homeStandGame, 0);
  const home = computeFatigue([g('2026-10-03', false), g('2026-10-05', true), g('2026-10-07', true)], '2026-10-07', ME);
  assert.equal(home.homeStandGame, 2);
  assert.equal(home.roadTripGame, 0);
});

test('time zone shift is signed: east is positive', () => {
  const east = computeFatigue([g('2026-10-06', false, '-08:00'), g('2026-10-08', false, '-05:00')], '2026-10-08', ME);
  assert.equal(east.tzShift, 3);
  assert.equal(fatigueFlags(east).find(flag => flag.key === 'tz').short, '+3 TZ');
  const west = computeFatigue([g('2026-10-06', false, '-05:00'), g('2026-10-08', false, '-08:00')], '2026-10-08', ME);
  assert.equal(west.tzShift, -3);
});

test('preseason games do not count as rest before a regular-season opener', () => {
  const f = computeFatigue([g('2026-10-07', true, '-05:00', 1), g('2026-10-08', true, '-05:00', 2)], '2026-10-08', ME);
  assert.equal(f.restDays, null);
});

test('rest edge is positive when home is fresher, capped at 4 days, null without data', () => {
  assert.equal(restEdge({ restDays: 2 }, { restDays: 0 }), 2);
  assert.equal(restEdge({ restDays: 0 }, { restDays: 9 }), -4);
  assert.equal(restEdge({ restDays: null }, { restDays: 1 }), null);
});
