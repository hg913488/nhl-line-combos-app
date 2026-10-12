import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStatus, pickPerformance } from '../src/picks-results.js';
const pick = (watch, goals, hit, extra = {}) => ({ watch, status:'graded', result: { goals_by_position: goals, score_reconciled:true, hit }, ...extra });
const goals = { C:1, LW:0, RW:0, D:2 };
test('multiple matching goals count as one hit; assists and opposition are not used', () => {
  assert.equal(pickStatus(pick('D', goals, true)), 'hit');
  assert.equal(pickStatus(pick('LW', goals, false)), 'miss');
  const s = pickPerformance([pick('D', goals, true), pick('LW', goals, false)]);
  assert.equal(s.hits, 1); assert.equal(s.hitRate, .5);
  assert.equal(s.randomRate, .5); assert.equal(s.centerRate, 1);
});
test('unreconciled, inconsistent and incomplete grades cannot affect trusted accuracy', () => {
  const bad = pick('D', goals, true); bad.result.score_reconciled = false;
  assert.equal(pickStatus(bad),'review');
  assert.equal(pickStatus(pick('D', goals, false)), 'review');
  assert.equal(pickStatus({status:'graded'}),'review');
  const s = pickPerformance([bad, {status:'pending'}, {status:'void'}]);
  assert.equal(s.settled,0); assert.equal(s.hitRate,null);
  assert.equal(s.pending,1); assert.equal(s.review,1); assert.equal(s.void,1);
});
test('position baseline compares to all eligible games, not selected-position games', () => {
  const s = pickPerformance([pick('D', goals, true), pick('C', {C:1,LW:1,RW:0,D:0}, true)]);
  assert.equal(s.byPosition.find(p => p.position === 'D').hitRate, 1);
  assert.equal(s.byPosition.find(p => p.position === 'D').baseline, .5);
  assert.equal(pickStatus(pick('G', goals, false)), 'review');
});
