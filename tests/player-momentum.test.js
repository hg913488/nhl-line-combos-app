import test from 'node:test';
import assert from 'node:assert/strict';
import playerMomentum, { buildLabels, parseToi, summarizeGames } from '../api/player-momentum.js';

function response() {
  return {
    code: 200,
    headers: {},
    status(code) { this.code = code; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    json(body) { this.body = body; return this; },
  };
}

function game(index, overrides = {}) {
  return {
    gameId: index,
    gameDate: `2026-01-${String(index).padStart(2, '0')}`,
    goals: 0,
    assists: 0,
    points: 0,
    shots: 2,
    toi: '18:00',
    ...overrides,
  };
}

test('TOI parser accepts hockey time and rejects malformed values', () => {
  assert.equal(parseToi('18:30'), 1110);
  assert.equal(parseToi('0:05'), 5);
  assert.equal(parseToi('18:99'), null);
  assert.equal(parseToi(undefined), null);
});

test('summaries include totals, rates, TOI, and season deltas', () => {
  const seasonGames = Array.from({ length: 10 }, (_, index) => game(index + 1));
  const season = summarizeGames(seasonGames);
  const recent = summarizeGames([
    game(11, { goals: 1, assists: 1, points: 2, shots: 5, toi: '20:00' }),
    game(12, { assists: 1, points: 1, shots: 3, toi: '19:00' }),
  ], season);
  assert.deepEqual(season.perGame, { goals: 0, assists: 0, points: 0, shots: 2 });
  assert.equal(recent.games, 2);
  assert.equal(recent.points, 3);
  assert.equal(recent.averageToi, '19:30');
  assert.deepEqual(recent.versusSeason, {
    goalsPerGame: 0.5,
    assistsPerGame: 1,
    pointsPerGame: 1.5,
    shotsPerGame: 2,
    averageToiSeconds: 90,
  });
});

test('trend labels require a complete recent window and meaningful season sample', () => {
  const games = Array.from({ length: 12 }, (_, index) => game(index + 1, index >= 7
    ? { points: 1, assists: 1, shots: 4, toi: '20:00' }
    : {})).reverse();
  const season = summarizeGames(games);
  const last5 = summarizeGames(games.slice(0, 5), season);
  const labels = buildLabels(games, season, last5);
  assert.ok(labels.some(label => label.type === 'point-streak'));
  assert.ok(labels.some(label => label.type === 'shots-up'));
  assert.ok(labels.some(label => label.type === 'toi-up'));

  const smallGames = games.slice(0, 4);
  const smallSeason = summarizeGames(smallGames);
  const smallLabels = buildLabels(smallGames, smallSeason, summarizeGames(smallGames, smallSeason));
  assert.ok(smallLabels.some(label => label.type === 'small-sample'));
  assert.ok(!smallLabels.some(label => label.type === 'shots-up'));
});

test('handler validates input without fetching', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not fetch'); });
  const res = response();
  await playerMomentum({ query: { playerId: 'not-a-player', season: '20252026' } }, res);
  assert.equal(res.code, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

test('handler fetches landing and game log and returns sorted recent momentum', async t => {
  const requested = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requested.push(url);
    if (url.endsWith('/landing')) {
      return { ok: true, json: async () => ({
        firstName: { default: 'Connor' },
        lastName: { default: 'McDavid' },
        currentTeamAbbrev: 'EDM',
        position: 'C',
        sweaterNumber: 97,
      }) };
    }
    return { ok: true, json: async () => ({ gameLog: [
      game(1, { gameDate: '2026-01-01' }),
      game(2, { gameDate: '2026-02-01', goals: 1, points: 1 }),
    ] }) };
  });
  const res = response();
  await playerMomentum({ query: { playerId: '8478402', season: '20252026', gameType: '2' } }, res);
  assert.equal(res.code, 200);
  assert.equal(requested.length, 2);
  assert.ok(requested.some(url => url.endsWith('/player/8478402/landing')));
  assert.ok(requested.some(url => url.endsWith('/player/8478402/game-log/20252026/2')));
  assert.equal(res.body.player.fullName, 'Connor McDavid');
  assert.deepEqual(res.body.recentGames.map(item => item.gameId), [2, 1]);
  assert.equal(res.body.summaries.last5.games, 2);
  assert.ok(res.body.labels.some(label => label.type === 'small-sample'));
  assert.match(res.headers['Cache-Control'], /s-maxage=300/);
});

test('empty offseason logs return honest empty summaries', async t => {
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/landing')
    ? { ok: true, json: async () => ({ firstName: { default: 'Test' }, lastName: { default: 'Player' } }) }
    : { ok: true, json: async () => ({ gameLog: [] }) });
  const res = response();
  await playerMomentum({ query: { playerId: '1', season: '20252026' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.summaries.season.games, 0);
  assert.equal(res.body.summaries.season.averageToi, null);
  assert.deepEqual(res.body.recentGames, []);
  assert.equal(res.body.labels[0].type, 'no-games');
});

test('upstream and malformed responses return 502 without cache headers', async t => {
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/landing')
    ? { ok: true, json: async () => ({}) }
    : { ok: false });
  const failed = response();
  await playerMomentum({ query: { playerId: '1', season: '20252026' } }, failed);
  assert.equal(failed.code, 502);
  assert.equal(failed.headers['Cache-Control'], undefined);

  globalThis.fetch.mock.restore();
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/landing')
    ? { ok: true, json: async () => ({}) }
    : { ok: true, json: async () => ({ wrong: [] }) });
  const malformed = response();
  await playerMomentum({ query: { playerId: '1', season: '20252026' } }, malformed);
  assert.equal(malformed.code, 502);
});
