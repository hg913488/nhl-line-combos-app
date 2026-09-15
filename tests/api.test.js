import test from 'node:test';
import assert from 'node:assert/strict';
import gamelog, { currentSeason, normalizeGame, validSeason } from '../api/gamelog.js';
import schedule from '../api/schedule.js';
import standings from '../api/standings.js';
import roster from '../api/roster.js';
import news, { parseNewsHtml } from '../api/news.js';
import { getJSON, normalizeName } from '../src/data-client.js';

function response() {
  return { code: 200, headers: {}, status(code) { this.code = code; return this; },
    setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; } };
}

test('season rollover and strict season format', () => {
  assert.equal(currentSeason(new Date('2026-06-30')), '20252026');
  assert.equal(currentSeason(new Date('2026-07-01')), '20262027');
  assert.equal(validSeason('20252027'), false);
  assert.equal(validSeason('20252026'), true);
});

test('goalie adapter preserves appearances and derives saves, not skater zeros', () => {
  const game = normalizeGame({ toi: '56:53', shotsAgainst: 20, goalsAgainst: 3, savePctg: .85 });
  assert.equal(game.saves, 17);
  assert.equal(game.timeOnIcePerGame, 3413);
  assert.equal(game.savePctg, .85);
  assert.equal(normalizeGame({ toi: '18:16', shots: 3 }).saves, null);
});

test('game log requests explicit season/type and returns complete sorted history', async t => {
  let requested;
  t.mock.method(globalThis, 'fetch', async url => {
    requested = url;
    return { ok: true, json: async () => ({ gameLog: [
      { gameId: 1, gameDate: '2026-01-01', toi: '18:00' },
      { gameId: 2, gameDate: '2026-04-01', toi: '19:00' },
    ] }) };
  });
  const res = response();
  await gamelog({ query: { playerId: '8478402', season: '20252026', gameType: '3' } }, res);
  assert.match(requested, /8478402\/game-log\/20252026\/3$/);
  assert.deepEqual(res.body.data.map(g => g.gameId), [2, 1]);
  assert.equal(res.body.seasonId, '20252026');
});

test('invalid requests do not reach upstream', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not fetch'); });
  const res = response();
  await gamelog({ query: { playerId: 'bad', season: '20252026' } }, res);
  assert.equal(res.code, 400);
  await schedule({ query: { date: '2026-02-31' } }, res);
  assert.equal(res.code, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

test('upstream failures and malformed data are not successful empty results', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  const res = response();
  await gamelog({ query: { playerId: '1', season: '20252026' } }, res);
  assert.equal(res.code, 502);
  assert.equal(res.headers['Cache-Control'], undefined);
});

test('schedule selects the requested day, keeping preseason and regular games', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ gameWeek: [
    { date: '2026-09-20', games: [{ id: 1 }] },
    { date: '2026-09-21', games: [{ id: 2, gameType: 1 }, { id: 3, gameType: 2 }] },
  ] }) }));
  const res = response();
  await schedule({ query: { date: '2026-09-21' } }, res);
  assert.deepEqual(res.body.games.map(g => g.id), [2, 3]);
});

test('standings include date and use the working now endpoint', async t => {
  let requested;
  t.mock.method(globalThis, 'fetch', async url => { requested = url; return { ok: true, json: async () => ({ standings: [{ teamAbbrev: { default: 'VAN' }, date: '2026-04-17', wins: 25 }] }) }; });
  const res = response();
  await standings({ query: {} }, res);
  assert.match(requested, /standings\/now$/);
  assert.equal(res.body[0].date, '2026-04-17');
});

test('roster joins number to player ID and season rather than a guessed shirt', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ forwards: [{ id: 8, firstName: { default: 'Aatu' }, lastName: { default: 'Räty' }, sweaterNumber: 54, positionCode: 'C' }], defensemen: [], goalies: [] }) }));
  const res = response();
  await roster({ query: { team: 'VAN', season: '20252026' } }, res);
  assert.equal(res.body.players[0].number, 54);
  assert.equal(res.body.season, '20252026');
  assert.equal(normalizeName('Aatu Räty'), normalizeName('AATU RATY'));
});

test('client deduplicates concurrent requests but never caches an HTTP failure', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: calls > 1, json: async () => calls > 1 ? { data: [1] } : { error: 'Temporary failure' } }; });
  await assert.rejects(getJSON('/test-retry'), /Temporary failure/);
  const results = await Promise.all([getJSON('/test-retry'), getJSON('/test-retry')]);
  assert.equal(calls, 2);
  assert.deepEqual(results[0], { data: [1] });
});

test('news parser returns unique, safe NHL stories with metadata', () => {
  const html = `<a class="nhl-c-card-wrap -story" href="/news/test-story"><article><img src="https://media.d3.nhle.com/image/test.jpg"><h3 class="fa-text__title"> Test headline </h3><div class="fa-text__body"><p> Useful   context. </p></div><time datetime="2026-09-14T12:00:00">Today</time></article></a>
    <a class="nhl-c-card-wrap -story" href="/news/test-story"><h3 class="fa-text__title">Duplicate</h3></a>
    <a class="nhl-c-card-wrap -story" href="https://example.com/news/bad"><h3 class="fa-text__title">Unsafe</h3></a>`;
  assert.deepEqual(parseNewsHtml(html), [{
    title: 'Test headline', summary: 'Useful context.', publishedAt: '2026-09-14T12:00:00',
    image: 'https://media.d3.nhle.com/image/test.jpg', url: 'https://www.nhl.com/news/test-story',
  }]);
});

test('news endpoint exposes parsed NHL stories and caches success', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => '<a class="nhl-c-card-wrap -story" href="/news/one"><h3 class="fa-text__title">One</h3></a>' }));
  const res = response();
  await news({}, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.stories[0].title, 'One');
  assert.match(res.headers['Cache-Control'], /s-maxage=300/);
});
