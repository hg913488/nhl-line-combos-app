import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Set before the script loads: its log path is read at import. Without this the
// publish-safety tests below would overwrite the real data/instagram_log.json.
process.env.IG_LOG_PATH = join(mkdtempSync(join(tmpdir(), 'ig-log-')), 'log.json');
const { buildCaption, cardUrl, postCarousel, run } = await import('../scripts/instagram-post.mjs');

const GAMES = [
  { away: 'DAL', home: 'STL', gameType: 2 },
  { away: 'MTL', home: 'TOR', gameType: 2 },
];

test('card URLs point at the public JPEG endpoint for the given date', () => {
  const url = cardUrl('slate', '2026-10-08', 'https://example.test');
  assert.equal(url, 'https://example.test/api/og?type=ig&card=slate&format=jpg&date=2026-10-08');
});

test('caption names the day, the matchups, and tags each team once', () => {
  const caption = buildCaption(GAMES, '2026-10-08');
  assert.match(caption, /Thursday, October 8/);
  assert.match(caption, /2 games on the slate/);
  assert.match(caption, /DAL @ STL · MTL @ TOR/);
  assert.match(caption, /#NHL/);
  for (const abbr of ['DAL', 'STL', 'MTL', 'TOR']) {
    assert.equal(caption.split(`#${abbr}`).length - 1, 1, `#${abbr} appears once`);
  }
});

test('caption stays within Instagram limits and avoids betting language', () => {
  const caption = buildCaption(Array.from({ length: 16 }, (_, i) => ({ away: `A${i}`, home: `H${i}`, gameType: 2 })), '2026-10-08');
  assert.ok(caption.length < 2200, `caption length ${caption.length}`);
  assert.doesNotMatch(caption, /\b(bet|odds|parlay|pick'?em|wager)\b/i);
});

test('a single game reads in the singular', () => {
  assert.match(buildCaption([GAMES[0]], '2026-10-08'), /1 game on the slate/);
});

// --- publish safety: a retry must never post what Instagram already published ---

// A tiny Graph API stand-in. `publish` decides what media_publish does; `live`
// is what GET /media reports as already on the account.
function fakeGraph({ publish, live = [], listFails = false }) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace(/^https:\/\/[^/]+\/v[\d.]+/, '').split('?')[0];
    calls.push(`${init.method || 'GET'} ${path}`);
    const json = (body, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
    if (path.endsWith('/media_publish')) return publish();
    if (path.endsWith('/media') && (init.method || 'GET') === 'GET') {
      return listFails ? json({ error: { message: 'Application request limit reached' } }, false) : json({ data: live });
    }
    if (path.endsWith('/media')) return json({ id: `c${calls.length}` });
    return json({ status_code: 'FINISHED' });
  };
  return calls;
}

const rateLimited = () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Application request limit reached' } }) });
const args = log => ({ key: 'recap:1', urls: ['https://x/1.jpg', 'https://x/2.jpg'], alts: ['a', 'b'], caption: 'CAP', log, igUserId: 'u', token: 't' });
const freshLog = () => ({ posts: [], attempts: {} });

test('a publish error is not retried blindly when the post is already live', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fakeGraph({ publish: rateLimited, live: [{ id: 'LIVE1', caption: 'CAP', timestamp: new Date().toISOString() }] });
  const result = await postCarousel(args(freshLog()));
  assert.deepEqual(result, { id: 'LIVE1', recovered: true });
});

test('an unverifiable publish error blocks the retry instead of risking a double post', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const log = freshLog();
  fakeGraph({ publish: rateLimited, listFails: true });
  await assert.rejects(postCarousel(args(log)), /request limit/);
  assert.equal(log.attempts['recap:1'].status, 'unknown');

  const calls = fakeGraph({ publish: rateLimited, listFails: true });
  await assert.rejects(postCarousel(args(log)));       // cannot verify, so it must not publish
  assert.ok(!calls.some(call => call.endsWith('/media_publish')), 'no publish call on the retry');
});

test('a verified failure retries with the finished container and stops at the cap', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const log = freshLog();
  fakeGraph({ publish: rateLimited });
  await assert.rejects(postCarousel(args(log)), /request limit/);
  assert.equal(log.attempts['recap:1'].status, 'failed');

  const calls = fakeGraph({ publish: rateLimited });
  await assert.rejects(postCarousel(args(log)), /request limit/);
  assert.equal(calls.filter(call => call === 'POST /u/media').length, 0, 'container reused, none recreated');

  fakeGraph({ publish: rateLimited });
  await assert.rejects(postCarousel(args(log)), /request limit/);   // third and last attempt
  await assert.rejects(postCarousel(args(log)), /gave up after 3/);
});

test('a later run records a post that went live after an earlier failure', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const log = freshLog();
  fakeGraph({ publish: rateLimited, listFails: true });
  await assert.rejects(postCarousel(args(log)));
  const calls = fakeGraph({ publish: rateLimited, live: [{ id: 'LATE', caption: 'CAP', timestamp: new Date().toISOString() }] });
  assert.deepEqual(await postCarousel(args(log)), { id: 'LATE', recovered: true });
  assert.equal(log.attempts['recap:1'], undefined);
  assert.ok(!calls.some(call => call.endsWith('/media_publish')));
});

test("a picks or scoreboard entry for a date does not block that date's daily slate", async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  writeFileSync(process.env.IG_LOG_PATH, JSON.stringify({ schema_version: 1, posts: [
    { date: '2026-10-08', kind: 'picks', published: true },
    { date: '2026-10-08', kind: 'scoreboard', published: true },
  ] }));
  globalThis.fetch = async url => String(url).includes('api-web.nhle.com')
    ? { ok: true, status: 200, json: async () => ({ gameWeek: [{ date: '2026-10-08', games: [{ awayTeam: { abbrev: 'DAL' }, homeTeam: { abbrev: 'STL' }, gameType: 2 }] }] }) }
    : { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) };
  const result = await run({ date: '2026-10-08', publish: false, outDir: mkdtempSync(join(tmpdir(), 'ig-cards-')) });
  assert.equal(result.skipped, undefined, 'the daily set was skipped');
  assert.equal(result.dryRun, true);
});
