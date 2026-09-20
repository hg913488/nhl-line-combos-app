import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankPositions, formatIndex } from '../src/picks-signal.js';

// Same fixture the Python scraper tests use, so the site and the logged picks agree.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/picks_index_cases.json', import.meta.url), 'utf8'));

test('JS ranking matches the shared parity cases', () => {
  for (const item of fixture.cases) {
    const ranked = rankPositions(item.team_l10, item.league_avg);
    assert.deepEqual(ranked.map(entry => entry.position), item.expected_ranking, item.name);
    assert.equal(ranked[0].position, item.expected_watch, item.name);
    for (const entry of ranked) {
      const expected = item.expected_index?.[entry.position];
      if (expected == null) continue;
      assert.ok(Math.abs(entry.index - expected) < 1e-9, `${item.name}: ${entry.position} index ${entry.index} != ${expected}`);
    }
  }
});

test('missing league averages fall back to raw goals allowed', () => {
  const ranked = rankPositions({ C: 4, LW: 9, RW: 0, D: 2 }, null);
  assert.deepEqual(ranked.map(entry => entry.position), ['LW', 'C', 'D', 'RW']);
  assert.equal(ranked[0].index, null);
});

test('zero or missing data ranks in position order without throwing', () => {
  assert.deepEqual(rankPositions(undefined, undefined).map(entry => entry.position), fixture.positions);
  assert.deepEqual(rankPositions({ C: 0, LW: 0, RW: 0, D: 0 }, { C: 0, LW: 0, RW: 0, D: 0 }).map(entry => entry.position), fixture.positions);
});

test('an empty league average object still indexes (0), unlike a missing one', () => {
  assert.equal(rankPositions({ C: 3 }, {})[0].index, 0);
  assert.equal(rankPositions({ C: 3 }, null)[0].index, null);
});

test('index formatting is stable for display', () => {
  assert.equal(formatIndex(1.239), '1.24×');
  assert.equal(formatIndex(null), '—');
});
