import test from 'node:test';
import assert from 'node:assert/strict';
import { shotStrength, summarizeShotVolume } from '../api/game.js';
test('strict strength groups do not mix empty nets and overtime with 5v5', () => {
  assert.equal(shotStrength('1551', true), '5v5');
  assert.equal(shotStrength('1541', false), 'powerPlay');
  assert.equal(shotStrength('1541', true), 'shortHanded');
  assert.equal(shotStrength('0651', true), 'emptyNet');
  assert.equal(shotStrength('1331', true), 'other');
  assert.equal(shotStrength(null, true), 'unknown');
});
test('volume counts misses and goals without treating blocks as shooting locations', () => {
 const result = summarizeShotVolume([
  {type:'goal',side:'home',strength:'5v5'}, {type:'shot',side:'home',strength:'5v5'},
  {type:'miss',side:'home',strength:'powerPlay'}, {type:'block',side:'home',strength:'5v5'},
  {type:'shot',side:'away'},
 ]);
 assert.deepEqual(result.all.home, {onGoal:2,unblocked:3});
 assert.deepEqual(result['5v5'].home, {onGoal:2,unblocked:2});
 assert.deepEqual(result.unknown.away, {onGoal:1,unblocked:1});
});
