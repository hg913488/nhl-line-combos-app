import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Set before the script loads: its log path is read at import. Without this the
// publish-safety tests below would overwrite the real data/instagram_log.json.
process.env.IG_LOG_PATH = join(mkdtempSync(join(tmpdir(), 'ig-log-')), 'log.json');
const REEL_DIR = mkdtempSync(join(tmpdir(), 'ig-reels-'));
process.env.IG_REEL_DIR = REEL_DIR;
const { buildCaption, cardUrl, checkVideo, postCarousel, postReel, reelUrl, run } = await import('../scripts/instagram-post.mjs');

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

// --- Reels ---

test('reel URLs live under /reels on the site', () => {
  assert.equal(reelUrl('ep03-nine-seconds', 'https://example.test'), 'https://example.test/reels/ep03-nine-seconds.mp4');
});

test('checkVideo accepts a public mp4 and rejects missing, non-video and oversized files', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const head = (status, type, length) => async () => ({ ok: status < 400, status, headers: { get: name => ({ 'content-type': type, 'content-length': String(length) })[name] } });
  globalThis.fetch = head(200, 'video/mp4', 3_500_000);
  assert.deepEqual(await checkVideo('https://x/r.mp4'), { type: 'video/mp4', size: 3_500_000 });
  globalThis.fetch = head(404, 'text/html', 0);
  await assert.rejects(checkVideo('https://x/r.mp4'), /not public yet/);
  globalThis.fetch = head(200, 'text/html', 100);
  await assert.rejects(checkVideo('https://x/r.mp4'), /not a video/);
  globalThis.fetch = head(200, 'video/mp4', 200 * 1024 * 1024);
  await assert.rejects(checkVideo('https://x/r.mp4'), /over 100 MB/);
});

test('postReel creates a REELS container from the video URL and publishes it', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const bodies = [];
  const calls = fakeGraph({ publish: () => ({ ok: true, status: 200, json: async () => ({ id: 'REEL1' }) }) });
  const graph = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => { if (init.body) bodies.push(String(init.body)); return graph(url, init); };
  const result = await postReel({ key: 'reel:demo', videoUrl: 'https://x/demo.mp4', caption: 'CAP', log: freshLog(), igUserId: 'u', token: 't', wait: { attempts: 2, delayMs: 1 } });
  assert.deepEqual(result, { id: 'REEL1', recovered: false });
  const create = bodies.find(body => body.includes('media_type=REELS'));
  assert.ok(create, 'a REELS container was created');
  assert.match(create, /video_url=https%3A%2F%2Fx%2Fdemo\.mp4/);
  assert.match(create, /share_to_feed=true/);
  assert.ok(calls.some(call => call.endsWith('/media_publish')));
});

test('a reel publish error is not retried when the reel is already live', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const calls = fakeGraph({ publish: rateLimited, live: [{ id: 'LIVEREEL', caption: 'CAP', timestamp: new Date().toISOString() }] });
  const log = freshLog();
  const result = await postReel({ key: 'reel:demo', videoUrl: 'https://x/demo.mp4', caption: 'CAP', log, igUserId: 'u', token: 't', wait: { attempts: 2, delayMs: 1 } });
  assert.deepEqual(result, { id: 'LIVEREEL', recovered: true });
  assert.equal(calls.filter(call => call.endsWith('/media_publish')).length, 1);
});

test('reel mode dry run checks the video and prints the caption without posting', async t => {
  const realFetch = globalThis.fetch;
  const env = { ...process.env };
  t.after(() => { globalThis.fetch = realFetch; process.env = env; });
  writeFileSync(join(REEL_DIR, 'demo.txt'), 'Demo caption\n');
  process.env.IG_MODE = 'reel';
  process.env.IG_REEL = 'demo';
  const posts = [];
  globalThis.fetch = async (url, init = {}) => {
    posts.push(`${init.method || 'GET'} ${url}`);
    return { ok: true, status: 200, headers: { get: name => ({ 'content-type': 'video/mp4', 'content-length': '1000' })[name] } };
  };
  assert.deepEqual(await run({ publish: false }), { dryRun: true });
  assert.deepEqual(posts, ['HEAD https://www.betweenthelineshockey.com/reels/demo.mp4']);
  process.env.IG_REEL = '../etc/passwd';
  await assert.rejects(run({ publish: false }), /must be a slug/);
});

test('a single card posts as a plain image, not a one-item carousel', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const bodies = [];
  fakeGraph({ publish: () => ({ ok: true, status: 200, json: async () => ({ id: 'IMG1' }) }) });
  const graph = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => { if (init.body) bodies.push(String(init.body)); return graph(url, init); };
  const result = await postCarousel({ key: 'scoreboard:1', urls: ['https://x/1.jpg'], alts: ['Final scores'], caption: 'CAP', log: freshLog(), igUserId: 'u', token: 't' });
  assert.deepEqual(result, { id: 'IMG1', recovered: false });
  assert.equal(bodies.filter(body => body.includes('media_type=CAROUSEL')).length, 0, 'no carousel container');
  assert.ok(bodies.some(body => body.includes('image_url=') && body.includes('caption=CAP') && !body.includes('is_carousel_item')));
});
