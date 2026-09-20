import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { buildGame, defendingSidesByPeriod, goalStrength, normalizePoint, situationText } from '../api/game.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const PBP = fixture('game-2025020500-pbp');
const RIGHT_RAIL = fixture('game-2025020500-right-rail');

function response() {
  return {
    code: 200,
    headers: {},
    status(code) { this.code = code; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    json(body) { this.body = body; return this; },
  };
}

function mockFetch(t, { pbp = { ok: true, status: 200, json: async () => PBP }, rail = { ok: true, status: 200, json: async () => RIGHT_RAIL } } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    return url.endsWith('/play-by-play') ? pbp : rail;
  });
  return calls;
}

test('handler rejects malformed game ids without fetching', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not fetch'); });
  for (const id of ['', 'abc', '123', '20250205001', '2025-02-05']) {
    const res = response();
    await game({ query: { id } }, res);
    assert.equal(res.code, 400, `expected 400 for ${JSON.stringify(id)}`);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('handler returns a trimmed game payload from a real completed game', async t => {
  const calls = mockFetch(t);
  const res = response();
  await game({ query: { id: '2025020500' } }, res);

  assert.equal(res.code, 200);
  assert.deepEqual(calls, [
    'https://api-web.nhle.com/v1/gamecenter/2025020500/play-by-play',
    'https://api-web.nhle.com/v1/gamecenter/2025020500/right-rail',
  ]);
  const body = res.body;
  assert.equal(body.id, 2025020500);
  assert.equal(body.state, 'OFF');
  assert.equal(body.venue, 'Madison Square Garden');
  assert.equal(body.period, 4);
  assert.equal(body.periodType, 'OT');
  assert.deepEqual(body.away, { id: 8, abbr: 'MTL', name: 'Canadiens', city: 'Montréal', score: 4, sog: 18 });
  assert.deepEqual(body.home, { id: 3, abbr: 'NYR', name: 'Rangers', city: 'New York', score: 5, sog: 29 });
  assert.equal(body.situation, null, 'strength text is live-only');
  assert.equal(body.shots.length, PBP.plays.length);
  assert.equal(body.goals.length, 5);

  const opener = body.goals[0];
  assert.equal(opener.team, 'MTL');
  assert.equal(opener.time, '12:41');
  assert.equal(opener.scorer, 'Zachary Bolduc');
  assert.deepEqual(opener.assists, ['Nick Suzuki', 'Cole Caufield']);
  assert.equal(opener.strength, 'EV');
  assert.equal(opener.shotType, 'wrist');
  assert.deepEqual(body.goals.map(goal => goal.strength), ['EV', 'PP', 'PS', 'EV', 'PP']);

  const block = body.shots.find(shot => shot.type === 'block');
  assert.equal(block.team, 'NYR', 'blocked shots belong to the shooting team');
  assert.equal(block.shooter, 'Alexis Lafrenière');

  assert.deepEqual(body.shotsByPeriod, [
    { period: 1, periodType: 'REG', away: 7, home: 11 },
    { period: 2, periodType: 'REG', away: 4, home: 8 },
    { period: 3, periodType: 'REG', away: 6, home: 5 },
    { period: 4, periodType: 'OT', away: 1, home: 5 },
  ]);
  assert.deepEqual(body.teamStats[0], { category: 'sog', away: 18, home: 29 });
  assert.ok(body.teamStats.some(stat => stat.category === 'faceoffWinningPctg'));
  assert.equal(body.rosterNames['8482737'], 'Zachary Bolduc');
  assert.equal(res.headers['Cache-Control'], 's-maxage=3600');
});

test('coordinates are normalized so home attacks +x and away attacks -x in every period', () => {
  const body = buildGame(PBP, RIGHT_RAIL);
  for (const shot of body.shots) {
    const sign = Math.sign(shot.x);
    assert.equal(sign, shot.side === 'home' ? 1 : -1, `${shot.side} shot in period ${shot.period} landed at x=${shot.x}`);
  }
  // Period 1 has the home team defending the right end, so the feed's points are rotated 180°.
  const firstPeriodHomeShot = body.shots.find(shot => shot.period === 1 && shot.side === 'home');
  assert.deepEqual([firstPeriodHomeShot.x, firstPeriodHomeShot.y], [68, -21]);
  // Period 2 flips ends, so those points pass through untouched.
  const secondPeriodAwayShot = body.shots.find(shot => shot.period === 2 && shot.side === 'away');
  assert.deepEqual([secondPeriodAwayShot.x, secondPeriodAwayShot.y], [-81, 13]);

  assert.deepEqual(normalizePoint(20, -5, 'right'), { x: -20, y: 5 });
  assert.deepEqual(normalizePoint(20, -5, 'left'), { x: 20, y: -5 });
  assert.deepEqual(normalizePoint(undefined, 4, 'left'), { x: null, y: null });
});

test('defending side falls back to where the home team shoots when the feed omits it', () => {
  const plays = [
    { periodDescriptor: { number: 1 }, typeDescKey: 'shot-on-goal', details: { xCoord: -70, yCoord: 4, eventOwnerTeamId: 3 } },
    { periodDescriptor: { number: 1 }, typeDescKey: 'goal', details: { xCoord: -80, yCoord: 1, eventOwnerTeamId: 3 } },
    { periodDescriptor: { number: 2 }, typeDescKey: 'shot-on-goal', homeTeamDefendingSide: 'left', details: { xCoord: 75, yCoord: 2, eventOwnerTeamId: 3 } },
  ];
  const sides = defendingSidesByPeriod(plays, 3);
  assert.equal(sides.get(1), 'right');
  assert.equal(sides.get(2), 'left');
});

test('strength and live situation text decode the 4-digit situation code', () => {
  assert.equal(goalStrength('1551', true), 'EV');
  assert.equal(goalStrength('1541', true), 'SH');
  assert.equal(goalStrength('1541', false), 'PP');
  assert.equal(goalStrength('0651', true), 'EN', 'scoring into a pulled goalie is an empty netter');
  assert.equal(goalStrength('0651', false), 'EV', 'six skaters without a goalie is still even strength');
  assert.equal(goalStrength('1441', true), 'EV');
  assert.equal(goalStrength('1010', true), 'PS');
  assert.equal(goalStrength('bad', true), null);
  assert.equal(situationText('1551', 'MTL', 'NYR'), '5-on-5');
  assert.equal(situationText('1451', 'MTL', 'NYR'), '5-on-4 NYR advantage');
  assert.equal(situationText('0651', 'MTL', 'NYR'), '6-on-5 MTL advantage · MTL net empty');
  assert.equal(situationText(null, 'MTL', 'NYR'), null);
});

test('live games get a short cache window, a strength line, and pre-game returns empty lists', async t => {
  const live = {
    ...PBP,
    gameState: 'LIVE',
    clock: { timeRemaining: '04:12', running: true, inIntermission: false },
  };
  mockFetch(t, { pbp: { ok: true, status: 200, json: async () => live } });
  const liveRes = response();
  await game({ query: { id: '2025020500' } }, liveRes);
  assert.equal(liveRes.headers['Cache-Control'], 's-maxage=15, stale-while-revalidate=30');
  assert.equal(liveRes.body.situation, '4-on-3 NYR advantage');
  assert.deepEqual(liveRes.body.clock, { timeRemaining: '04:12', running: true, inIntermission: false });

  globalThis.fetch.mock.restore();
  const pregame = {
    id: 2026010001,
    gameState: 'FUT',
    startTimeUTC: '2026-09-19T23:00:00Z',
    venue: { default: 'Enterprise Center' },
    clock: { timeRemaining: '20:00', running: false, inIntermission: false },
    awayTeam: { id: 25, abbrev: 'DAL', commonName: { default: 'Stars' }, placeName: { default: 'Dallas' }, score: 0 },
    homeTeam: { id: 19, abbrev: 'STL', commonName: { default: 'Blues' }, placeName: { default: 'St. Louis' }, score: 0 },
    plays: [],
    rosterSpots: [],
  };
  mockFetch(t, {
    pbp: { ok: true, status: 200, json: async () => pregame },
    rail: { ok: true, status: 200, json: async () => ({ seasonSeries: [] }) },
  });
  const futureRes = response();
  await game({ query: { id: '2026010001' } }, futureRes);
  assert.equal(futureRes.code, 200);
  assert.equal(futureRes.headers['Cache-Control'], 's-maxage=300');
  assert.equal(futureRes.body.away.sog, null);
  assert.deepEqual(futureRes.body.shots, []);
  assert.deepEqual(futureRes.body.goals, []);
  assert.deepEqual(futureRes.body.shotsByPeriod, []);
  assert.deepEqual(futureRes.body.teamStats, []);
  assert.equal(futureRes.body.period, null);
});

test('play-by-play failures return 502 with no cache header, and unknown games return 404', async t => {
  mockFetch(t, { pbp: { ok: false, status: 500 } });
  const upstream = response();
  await game({ query: { id: '2025020500' } }, upstream);
  assert.equal(upstream.code, 502);
  assert.equal(upstream.headers['Cache-Control'], undefined);

  globalThis.fetch.mock.restore();
  mockFetch(t, { pbp: { ok: true, status: 200, json: async () => ({ plays: [] }) } });
  const malformed = response();
  await game({ query: { id: '2025020500' } }, malformed);
  assert.equal(malformed.code, 502);

  globalThis.fetch.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); });
  const timedOut = response();
  await game({ query: { id: '2025020500' } }, timedOut);
  assert.equal(timedOut.code, 502);
  assert.equal(timedOut.headers['Cache-Control'], undefined);

  globalThis.fetch.mock.restore();
  mockFetch(t, { pbp: { ok: false, status: 404 } });
  const missing = response();
  await game({ query: { id: '2025029999' } }, missing);
  assert.equal(missing.code, 404);
  assert.equal(missing.headers['Cache-Control'], undefined);
});

test('a right-rail outage degrades instead of failing, rebuilding shots by period from the plays', async t => {
  mockFetch(t, { rail: { ok: false, status: 503 } });
  const res = response();
  await game({ query: { id: '2025020500' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.teamStats, []);
  assert.deepEqual(res.body.shotsByPeriod, [
    { period: 1, periodType: 'REG', away: 1, home: 3 },
    { period: 2, periodType: 'REG', away: 2, home: 0 },
    { period: 4, periodType: 'OT', away: 0, home: 1 },
  ]);
});
