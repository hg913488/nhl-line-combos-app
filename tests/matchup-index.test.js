import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, matchupEdges, POSITIONS, PRIOR_GAMES, PREV_SEASON_GAMES } from '../src/matchup-index.js';
import { swarm } from '../src/board-layout.js';

const team = (ytd, gamesThisSeason, prior) => ({
  ytd,
  l10_games: [
    ...Array.from({ length: gamesThisSeason }, (_, i) => ({ game_id: 2026020000 + i, season: 20262027 })),
    { game_id: 2025021000, season: 20252026 },
  ],
  prior,
});
const flat = n => ({ C: n, LW: n, RW: n, D: n });
const fixture = {
  season_id: 20262027,
  teams: { AAA: team(flat(2), 2), BBB: team(flat(0), 2), CCC: team(flat(1), 2) },
  previous: { teams: { AAA: { ytd: flat(82) }, BBB: { ytd: flat(82) }, CCC: { ytd: flat(82) } } },
};

test('blends last season by games played and centres the league on 1.00', () => {
  const { teams } = buildIndex(fixture);
  // (2 goals + 12 × 1 per game) / (2 + 12)
  assert.ok(Math.abs(teams.AAA.rate.C - 14 / 14) < 1e-9);
  assert.ok(Math.abs(teams.AAA.weight - 2 / (2 + PRIOR_GAMES)) < 1e-9);
  const mean = POSITIONS.map(p => ['AAA', 'BBB', 'CCC'].reduce((s, t) => s + teams[t].index[p], 0) / 3);
  mean.forEach(m => assert.ok(Math.abs(m - 1) < 1e-9));
});

test('ranks the most generous defence first and breaks ties by name', () => {
  const { teams } = buildIndex(fixture);
  assert.deepEqual(['AAA', 'CCC', 'BBB'].map(t => teams[t].rank.C), [1, 2, 3]);
  const tie = buildIndex({ ...fixture, teams: { ZZZ: team(flat(1), 1), AAA: team(flat(1), 1) }, previous: undefined });
  assert.equal(tie.teams.AAA.rank.C, 1);
});

test('with no games yet the numbers are last season alone; with no prior they are this season alone', () => {
  const fresh = buildIndex({ ...fixture, teams: { AAA: team(flat(0), 0), BBB: team(flat(0), 0) } });
  assert.ok(Math.abs(fresh.teams.AAA.rate.C - 82 / PREV_SEASON_GAMES) < 1e-9);
  assert.equal(fresh.teams.AAA.weight, 0);
  const noPrior = buildIndex({ ...fixture, previous: undefined });
  assert.ok(Math.abs(noPrior.teams.AAA.rate.C - 1) < 1e-9);
  assert.equal(noPrior.teams.AAA.weight, 1);
});

test('matchupEdges crosses the two defences and names the best spot', () => {
  const built = buildIndex(fixture);
  const edges = matchupEdges(built, 'AAA', 'BBB');
  assert.equal(edges.rows.length, 4);
  // BBB's defence is stingier, AAA's is the softest: BBB skaters vs AAA is the best spot.
  assert.deepEqual([edges.best.team, edges.best.vs], ['BBB', 'AAA']);
  assert.equal(matchupEdges(built, 'AAA', 'NOPE'), null);
});

test('real data file builds a full 32-team index', () => {
  const data = JSON.parse(readFileSync(new URL('../data/goals_against_by_position.json', import.meta.url), 'utf8'));
  const { teams, size } = buildIndex(data);
  assert.equal(size, Object.keys(data.teams).length);
  Object.values(teams).forEach(t => POSITIONS.forEach(p => assert.ok(Number.isFinite(t.index[p]))));
});

test('swarm never overlaps and is deterministic', () => {
  const items = Array.from({ length: 32 }, (_, i) => ({ id: `T${i}`, value: 1 + ((i * 7) % 13) / 20, radius: i % 5 === 0 ? 16 : 11 }));
  const a = swarm(items, { width: 360 });
  const b = swarm([...items].reverse(), { width: 360 });
  assert.deepEqual(a, b);
  for (let i = 0; i < a.length; i += 1) for (let j = i + 1; j < a.length; j += 1) {
    assert.ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= a[i].radius + a[j].radius, `${a[i].id}/${a[j].id}`);
  }
  assert.deepEqual(swarm([], { width: 300 }), []);
});
