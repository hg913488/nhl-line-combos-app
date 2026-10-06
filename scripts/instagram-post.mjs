// Posts the day's Between the Lines cards to Instagram as a carousel.
//
//   node scripts/instagram-post.mjs             # dry run: downloads the cards, prints the caption
//   IG_PUBLISH=true node scripts/instagram-post.mjs
//
// Instagram accepts JPEG only and fetches each image from a public URL, so the
// cards are served straight from /api/og on the deployed site.
//
// IG_USER_ID must be the app-scoped id that GET /me returns for this token, not
// the id shown on the app dashboard. Containers are created against the token's
// own account, so publishing under the dashboard id fails with
// "Media ID is not available" after every child uploads successfully.
// Flow (Graph API): create one container per image -> create the carousel
// container -> poll status_code -> publish.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectWatch, picksCaption, PICKS_DEEP } from '../lib/og/picks-select.js';
import { isFinal, goalsIn, marginIn, wentPast60, recapSlots, claimRecaps, scoreboardDue, scoreboardPages, scoreboardCaption, shiftDate } from './lib/recap-queue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_PATH = process.env.IG_LOG_PATH || join(ROOT, 'data', 'instagram_log.json');
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v26.0';
// Two supported setups:
//   Facebook Login for Business -> graph.facebook.com (a Page token)
//   Instagram Login             -> graph.instagram.com (an Instagram token)
// Both expose the same publishing endpoints; only the host differs.
const GRAPH_HOST = process.env.IG_GRAPH_HOST || 'graph.facebook.com';
const GRAPH = `https://${GRAPH_HOST}/${GRAPH_VERSION}`;
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://www.betweenthelineshockey.com').replace(/\/$/, '');
const MAX_CAROUSEL = 10;
// Cards render ice white by default; IG_THEME=dark posts the charcoal set.
const THEME = process.env.IG_THEME === 'dark' ? 'dark' : 'light';
const STATUS_ATTEMPTS = 20;
const STATUS_DELAY_MS = 3000;

const RECAP_CARDS = [
  { card: 'final', alt: 'Final score with goals by period' },
  { card: 'goals', alt: 'Every goal in order with scorers and assists' },
  { card: 'shots', alt: 'Shot map of every attempt, and shots on goal by period' },
  { card: 'metrics', alt: 'Team stats compared side by side' },
];

const CARDS = [
  { card: 'slate', alt: "Tonight's NHL games with puck drop times" },
  { card: 'moves', alt: 'Line moves from the last 24 hours' },
  { card: 'goalies', alt: "Tonight's starting goalie matchups" },
  { card: 'watch', alt: 'Positions each defense has allowed the most goals to' },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const etDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// `attempts` tracks a publish that started but has not been logged as a post:
// key -> { n, status: 'publishing' | 'failed' | 'unknown', creation_id, first_at, at, error }.
// It is what stops a retry from posting something Instagram already published.
const MAX_ATTEMPTS = 3;
const ATTEMPT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function readLog() {
  try {
    const log = JSON.parse(readFileSync(LOG_PATH, 'utf8'));
    return { ...log, posts: log.posts || [], attempts: log.attempts || {} };
  } catch { return { schema_version: 1, posts: [], attempts: {} }; }
}

function writeLog(log) {
  for (const [key, item] of Object.entries(log.attempts || {})) {
    if (Date.now() - Date.parse(item.at) > ATTEMPT_TTL_MS) delete log.attempts[key];
  }
  if (!Object.keys(log.attempts || {}).length) delete log.attempts;
  writeFileSync(LOG_PATH, `${JSON.stringify(log, null, 2)}\n`);
  log.attempts ||= {};
}

export function recapUrl(card, gameId, origin = SITE_ORIGIN, options = {}) {
  const { index, total, theme = THEME } = options;
  const position = index && total ? `&index=${index}&total=${total}` : '';
  const style = theme === 'dark' ? '&theme=dark' : '';
  return `${origin}/api/og?type=ig&recap=${gameId}&card=${card}&format=jpg${position}${style}`;
}

/**
 * The night's most watchable finished game: overtime first, then one-goal
 * games, then the most combined shots.
 */
/**
 * The games worth recapping: the night's highest-scoring game, then its
 * closest. Two separate criteria rather than one blended score, so the pair
 * contrasts — a track meet next to a one-goal grind — instead of returning two
 * games of the same shape. Any slots past the first two fall back to goals.
 */
export function pickRecaps(games, count = 2) {
  const done = games.filter(game => ['FINAL', 'OFF'].includes(game.gameState));
  const byGoals = [...done].sort((a, b) => goalsIn(b) - goalsIn(a) || marginIn(a) - marginIn(b));
  const byCloseness = [...done].sort((a, b) =>
    Number(wentPast60(b)) - Number(wentPast60(a)) || marginIn(a) - marginIn(b) || goalsIn(b) - goalsIn(a));

  const picked = [];
  const take = list => {
    if (picked.length >= count) return;
    const next = list.find(game => !picked.some(chosen => chosen.id === game.id));
    if (next) picked.push(next);
  };
  take(byGoals);
  take(byCloseness);
  while (picked.length < count && picked.length < done.length) take(byGoals);
  return picked;
}

export function pickRecap(games) {
  return pickRecaps(games, 1)[0] || null;
}

export function recapCaption(game) {
  const winner = (game.homeTeam.score ?? 0) > (game.awayTeam.score ?? 0) ? game.homeTeam : game.awayTeam;
  const loser = winner === game.homeTeam ? game.awayTeam : game.homeTeam;
  const extra = game.gameOutcome?.lastPeriodType && game.gameOutcome.lastPeriodType !== 'REG'
    ? ` (${game.gameOutcome.lastPeriodType})` : '';
  return [
    `${winner.abbrev} ${winner.score}, ${loser.abbrev} ${loser.score}${extra}.`,
    '',
    'Every goal, every shot on the ice where it happened, and the numbers behind it.',
    SITE_ORIGIN.replace(/^https:\/\//, ''),
    '',
    `#NHL #hockey #${winner.abbrev} #${loser.abbrev}`,
  ].join('\n');
}

export function cardUrl(card, date, origin = SITE_ORIGIN, options = {}) {
  const { index, total, theme = THEME } = options;
  const position = index && total ? `&index=${index}&total=${total}` : '';
  const style = theme === 'dark' ? '&theme=dark' : '';
  return `${origin}/api/og?type=ig&card=${card}&format=jpg&date=${date}${position}${style}`;
}

export function buildCaption(games, date) {
  const when = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const matchups = games.slice(0, 6).map(game => `${game.away} @ ${game.home}`).join(' · ');
  const teamTags = [...new Set(games.flatMap(game => [game.away, game.home]))].slice(0, 12).map(abbr => `#${abbr}`).join(' ');
  return [
    `${when}: ${games.length} ${games.length === 1 ? 'game' : 'games'} on the slate.`,
    matchups,
    '',
    'Line combinations, line moves, starting goalies and injuries — free, updated through the day.',
    SITE_ORIGIN.replace(/^https:\/\//, ''),
    '',
    `#NHL #hockey #NHLlines ${teamTags}`.trim(),
  ].filter(part => part !== null).join('\n');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const message = body.error?.message || `HTTP ${response.status}`;
    throw new Error(`${message} (${url.split('?')[0]})`);
  }
  return body;
}

async function todaysGames(date) {
  const data = await fetchJson(`https://api-web.nhle.com/v1/schedule/${date}`);
  const games = data.gameWeek?.find(day => day.date === date)?.games || [];
  return games.map(game => ({ away: game.awayTeam.abbrev, home: game.homeTeam.abbrev, gameType: game.gameType }));
}

async function createContainer(igUserId, token, params) {
  const body = new URLSearchParams({ ...params, access_token: token });
  return fetchJson(`${GRAPH}/${igUserId}/media`, { method: 'POST', body });
}

async function waitForContainer(containerId, token, { attempts = STATUS_ATTEMPTS, delayMs = STATUS_DELAY_MS } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { status_code: status, status: detail } = await fetchJson(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`);
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Container ${containerId} ${status}: ${detail || 'no detail'}`);
    await sleep(delayMs);
  }
  throw new Error(`Container ${containerId} was not ready after ${attempts} checks`);
}

// Has this caption already gone live? Instagram can return an error from
// media_publish after the post is up, so a retry has to look before it leaps.
export async function findPublished(igUserId, token, caption, since) {
  const { data = [] } = await fetchJson(`${GRAPH}/${igUserId}/media?fields=id,caption,timestamp&limit=25&access_token=${token}`);
  const floor = Date.parse(since) - 5 * 60 * 1000;
  return data.find(item => (item.caption || '').trim() === caption.trim() && Date.parse(item.timestamp) >= floor) || null;
}

/**
 * The safe-publish core shared by carousels and Reels. `makeContainer()` builds a finished
 * container and returns its id; everything around it is the same guard:
 *   - a prior attempt that could not be verified blocks retries until forced,
 *   - a verified-not-published failure retries up to MAX_ATTEMPTS, reusing the
 *     finished container so a retry costs a couple of calls, not a re-upload,
 *   - an error from media_publish is checked against what is actually live.
 * Returns { id, recovered }. Throws when the post is not live.
 */
async function guardedPublish({ key, caption, log, igUserId, token, force = false }, makeContainer) {
  const prior = log.attempts[key];
  if (prior) {
    // A previous run may have published after all (or been unable to say).
    const live = await findPublished(igUserId, token, caption, prior.first_at);
    if (live) {
      delete log.attempts[key];
      return { id: live.id, recovered: true };
    }
    if (!force && prior.status === 'unknown') throw new Error(`${key}: an earlier publish could not be verified; check Instagram, then rerun with force`);
    if (!force && prior.n >= MAX_ATTEMPTS) throw new Error(`${key}: gave up after ${prior.n} failed attempts`);
  }

  const firstAt = prior?.first_at || new Date().toISOString();
  let creationId = prior?.creation_id;
  if (creationId) {
    const ready = await fetchJson(`${GRAPH}/${creationId}?fields=status_code&access_token=${token}`).catch(() => ({}));
    if (ready.status_code !== 'FINISHED') creationId = null;
  }
  if (!creationId) creationId = await makeContainer();

  log.attempts[key] = { ...prior, key, n: (prior?.n || 0) + 1, status: 'publishing', creation_id: creationId, first_at: firstAt, at: new Date().toISOString() };
  writeLog(log);
  try {
    const published = await fetchJson(`${GRAPH}/${igUserId}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: creationId, access_token: token }) });
    delete log.attempts[key];
    return { id: published.id, recovered: false };
  } catch (error) {
    let status = 'unknown';
    try {
      const live = await findPublished(igUserId, token, caption, firstAt);
      if (live) {
        delete log.attempts[key];
        return { id: live.id, recovered: true };
      }
      status = 'failed';
    } catch { /* could not check: stay 'unknown' so nothing reposts blind */ }
    log.attempts[key] = { ...log.attempts[key], status, error: error.message };
    writeLog(log);
    throw error;
  }
}

/**
 * One carousel from image URLs to a live post, safe to call again after a failure.
 * Instagram rejects a carousel with fewer than two items ("Unsupported post type"), so a single
 * card (a quiet night's one-slide roundup) goes out as a plain image post instead.
 */
export async function postCarousel({ key, urls, alts, caption, log, igUserId, token, force = false }) {
  return guardedPublish({ key, caption, log, igUserId, token, force }, async () => {
    if (urls.length === 1) {
      const image = await createContainer(igUserId, token, { image_url: urls[0], caption, alt_text: alts[0] });
      await waitForContainer(image.id, token);
      console.log('  single image container ready');
      return image.id;
    }
    const children = [];
    for (const [i, url] of urls.entries()) {
      const container = await createContainer(igUserId, token, { image_url: url, is_carousel_item: 'true', alt_text: alts[i] });
      await waitForContainer(container.id, token);
      children.push(container.id);
      console.log(`  container ready: ${i + 1}/${urls.length}`);
    }
    const carousel = await createContainer(igUserId, token, { media_type: 'CAROUSEL', children: children.join(','), caption });
    await waitForContainer(carousel.id, token);
    return carousel.id;
  });
}

// Video takes Instagram a while to process: allow up to five minutes.
const REEL_WAIT = { attempts: 60, delayMs: 5000 };

/** One Reel from a public video URL to a live post, with the same retry safety as a carousel. */
export async function postReel({ key, videoUrl, caption, log, igUserId, token, force = false, wait = REEL_WAIT }) {
  return guardedPublish({ key, caption, log, igUserId, token, force }, async () => {
    const reel = await createContainer(igUserId, token, { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true' });
    await waitForContainer(reel.id, token, wait);
    console.log('  reel container ready');
    return reel.id;
  });
}

// ── Reels: a finished video served from /reels on the site, plus its caption ──────────────────
const REEL_DIR = process.env.IG_REEL_DIR || join(ROOT, 'public', 'reels');
const MAX_REEL_BYTES = 100 * 1024 * 1024;
const REEL_SLUG = /^[a-z0-9][a-z0-9-]*$/;

export const reelUrl = (slug, origin = SITE_ORIGIN) => `${origin}/reels/${slug}.mp4`;

/** Instagram fetches the file itself, so it must already be public, an mp4, and a sane size. */
export async function checkVideo(url) {
  const response = await fetch(url, { method: 'HEAD' });
  const type = response.headers?.get?.('content-type') || '';
  const size = Number(response.headers?.get?.('content-length') || 0);
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}; the video is not public yet`);
  if (!/^video\//.test(type)) throw new Error(`${url} is served as "${type || 'unknown'}", not a video`);
  if (size > MAX_REEL_BYTES) throw new Error(`${url} is ${(size / 1048576).toFixed(0)} MB; Reels over 100 MB are rejected`);
  return { type, size };
}

async function runReel({ log, publish, force }) {
  const slug = process.env.IG_REEL || '';
  if (!REEL_SLUG.test(slug)) throw new Error('IG_REEL must be a slug like ep03-nine-seconds (lowercase letters, digits, dashes)');
  const caption = readFileSync(join(REEL_DIR, `${slug}.txt`), 'utf8').trim();
  if (!caption) throw new Error(`public/reels/${slug}.txt is empty`);
  if (caption.length > 2200) throw new Error(`caption is ${caption.length} characters; Instagram allows 2,200`);
  if (!force && log.posts.some(post => post.kind === 'reel' && post.slug === slug && post.published)) {
    console.log(`Reel ${slug} is already published; nothing to do. Set IG_FORCE=true to post again.`);
    return { skipped: true };
  }
  const url = reelUrl(slug);
  const { type, size } = await checkVideo(url);
  console.log(`Reel ${slug}: ${url} (${type}, ${(size / 1048576).toFixed(1)} MB)`);
  console.log(`\n--- caption ---\n${caption}\n---------------`);
  if (!publish) {
    console.log('DRY RUN — the video is reachable and the caption reads as above; nothing was posted.');
    return { dryRun: true };
  }
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required to publish');
  const { id, recovered } = await postReel({ key: `reel:${slug}`, videoUrl: url, caption, log, igUserId, token, force });
  log.posts = [...log.posts, { date: etDate(), kind: 'reel', slug, published: true, media_id: id, posted_at: new Date().toISOString() }].slice(-120);
  writeLog(log);
  console.log(`${recovered ? 'Recovered (already live)' : 'Published'} reel: ${id}`);
  return { mediaId: id };
}

// Read-only probe: who the token is, what Instagram says the publishing quota
// and app usage are, and what is actually on the account right now.
export async function diagnose({ igUserId = process.env.IG_USER_ID, token = process.env.IG_ACCESS_TOKEN } = {}) {
  if (!igUserId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required');
  const probe = async (label, path) => {
    const response = await fetch(`${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`);
    const body = await response.json().catch(() => ({}));
    console.log(`\n${label}: HTTP ${response.status}`);
    for (const name of ['x-app-usage', 'x-business-use-case-usage', 'x-ig-app-usage']) {
      if (response.headers.get(name)) console.log(`  ${name}: ${response.headers.get(name)}`);
    }
    return body;
  };
  const me = await probe('me', 'me?fields=id,username,account_type');
  console.log(`  ${JSON.stringify(me.error ? { error: me.error } : me)}`);
  console.log(`  configured IG_USER_ID matches /me: ${String(me.id) === String(igUserId)}`);
  const limit = await probe('content_publishing_limit', `${igUserId}/content_publishing_limit?fields=config,quota_usage`);
  console.log(`  ${JSON.stringify(limit.error ? { error: limit.error } : limit)}`);
  const media = await probe('recent media', `${igUserId}/media?fields=id,caption,timestamp,permalink&limit=25`);
  if (media.error) console.log(`  ${JSON.stringify({ error: media.error })}`);
  for (const item of media.data || []) console.log(`  ${item.id}  ${item.timestamp}  ${item.permalink}  ${(item.caption || '').split('\n')[0].slice(0, 70)}`);
  return { diagnosed: true };
}

async function downloadCards(cards, date, outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const item of cards) {
    const response = await fetch(cardUrl(item.card, date, SITE_ORIGIN, { index: cards.indexOf(item) + 1, total: cards.length }));
    if (!response.ok) throw new Error(`Card ${item.card} returned HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(join(outDir, `${date}-${THEME}-${item.card}.jpg`), buffer);
    console.log(`  saved ${item.card} (${(buffer.length / 1024).toFixed(0)}KB)`);
  }
}

export const scoresUrl = (date, ids, page, theme = THEME, origin = SITE_ORIGIN) =>
  `${origin}/api/og?type=ig&scores=${date}&ids=${ids.join(',')}&page=${page}&format=jpg${theme === 'dark' ? '&theme=dark' : ''}`;

async function saveCards(urls, names, outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const [i, url] of urls.entries()) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Card ${names[i]} returned HTTP ${response.status}`);
    writeFileSync(join(outDir, `${names[i]}.jpg`), Buffer.from(await response.arrayBuffer()));
    console.log(`  saved ${names[i]}`);
  }
}

// One ET night: recap the games that have earned a slot, then post the
// final-scores roundup when it is due. Failures are collected, not thrown, so
// one bad game cannot lose another game's log entry.
async function recapNight(date, { log, publish, includePreseason, force, outDir, mediaIds, failures }) {
  const data = await fetchJson(`https://api-web.nhle.com/v1/schedule/${date}`);
  const allNight = data.gameWeek?.find(day => day.date === date)?.games || [];
  // Match the daily set's rule, or a scheduled recap would post preseason
  // games on nights the daily run deliberately stays quiet.
  const games = includePreseason ? allNight : allNight.filter(item => item.gameType !== 1);
  const livePosts = log.posts.filter(post => post.published);
  const recapped = new Set(livePosts.filter(post => post.kind === 'recap').map(post => String(post.game_id)));
  const used = livePosts.filter(post => post.kind === 'recap' && post.date === date).length;

  const chosen = process.env.IG_GAME_ID
    ? [games.find(item => String(item.id) === process.env.IG_GAME_ID) || { id: Number(process.env.IG_GAME_ID) }]
    : claimRecaps({ games, recapped, used, slots: recapSlots() });
  console.log(`${date}: ${games.filter(isFinal).length}/${games.length} final, ${used} recapped, ${chosen.length} to recap now.`);

  for (const game of chosen) {
    if (!force && recapped.has(String(game.id))) {
      console.log(`Already recapped game ${game.id}; skipping. Set IG_FORCE=true to post again.`);
      continue;
    }
    const caption = game.awayTeam ? recapCaption(game) : 'Game recap.';
    console.log(`Recapping game ${game.id}; ${RECAP_CARDS.length} cards; ${THEME} theme.`);
    const urls = RECAP_CARDS.map((item, i) => recapUrl(item.card, game.id, SITE_ORIGIN, { index: i + 1, total: RECAP_CARDS.length }));

    if (!publish) {
      console.log('DRY RUN — downloading recap cards instead of posting.');
      await saveCards(urls, RECAP_CARDS.map(item => `${date}-recap-${game.id}-${item.card}`), outDir);
      console.log(`\n--- caption ---\n${caption}\n---------------`);
      continue;
    }

    const igUserId = process.env.IG_USER_ID;
    const token = process.env.IG_ACCESS_TOKEN;
    if (!igUserId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required to publish');
    try {
      const { id, recovered } = await postCarousel({ key: `recap:${game.id}`, urls, alts: RECAP_CARDS.map(item => item.alt), caption, log, igUserId, token, force });
      log.posts = [...log.posts, { date, kind: 'recap', game_id: game.id, published: true, media_id: id, theme: THEME, posted_at: new Date().toISOString() }].slice(-120);
      writeLog(log);
      mediaIds.push(id);
      console.log(`${recovered ? 'Recovered (already live)' : 'Published'} recap: ${id}`);
    } catch (error) {
      failures.push(`game ${game.id}: ${error.message}`);
      console.error(`  recap ${game.id} failed: ${error.message}`);
      if (/request limit/i.test(error.message)) return;
    }
  }

  if (process.env.IG_GAME_ID) return;
  const posted = livePosts.some(post => post.kind === 'scoreboard' && post.date === date);
  if (!force && (posted || !scoreboardDue({ games, date }))) return;
  const finished = games.filter(isFinal);
  const ids = finished.map(game => game.id);
  const pages = scoreboardPages(finished.length);
  const urls = Array.from({ length: pages }, (_, i) => scoresUrl(date, ids, i + 1));
  const caption = scoreboardCaption(games, date, SITE_ORIGIN.replace(/^https:\/\//, ''));
  console.log(`Final scores for ${date}: ${finished.length} games, ${pages} slide${pages === 1 ? '' : 's'}.`);

  if (!publish) {
    await saveCards(urls, urls.map((_, i) => `${date}-scores-${i + 1}`), outDir);
    console.log(`\n--- caption ---\n${caption}\n---------------`);
    return;
  }
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required to publish');
  try {
    const { id, recovered } = await postCarousel({ key: `scoreboard:${date}`, urls, alts: urls.map((_, i) => `Final scores, slide ${i + 1} of ${pages}`), caption, log, igUserId, token, force });
    log.posts = [...log.posts, { date, kind: 'scoreboard', published: true, media_id: id, theme: THEME, games: finished.length, posted_at: new Date().toISOString() }].slice(-120);
    writeLog(log);
    mediaIds.push(id);
    console.log(`${recovered ? 'Recovered (already live)' : 'Published'} scoreboard: ${id}`);
  } catch (error) {
    failures.push(`scoreboard ${date}: ${error.message}`);
    console.error(`  scoreboard ${date} failed: ${error.message}`);
  }
}

const readData = name => {
  try { return JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8')); } catch { return null; }
};

const picksUrl = (date, ids, card, rank, theme = THEME, origin = SITE_ORIGIN) =>
  `${origin}/api/og?type=ig&picks=${date}&ids=${ids.join(',')}&card=${card}${rank ? `&rank=${rank}` : ''}&format=jpg${theme === 'dark' ? '&theme=dark' : ''}`;

// Midday "players to watch": one list slide plus a slide each for the top three.
// One per ET day. Skipped, not failed, when the prop sheet is stale or thin.
async function runPicks({ date, log, publish, force, outDir }) {
  if (!force && log.posts.some(post => post.kind === 'picks' && post.date === date && post.published)) {
    console.log(`Already published the players-to-watch post for ${date}; nothing to do. Set IG_FORCE=true to post again.`);
    return { skipped: true };
  }
  const sheet = readData('prop_sheet.json');
  const players = selectWatch(sheet, { date, now: process.env.IG_NOW ? new Date(process.env.IG_NOW) : new Date(), ga: readData('goals_against_by_position.json'), spotlight: readData('spotlight.json') });
  if (!players.length) {
    console.log(`No players worth featuring for ${date} (prop sheet is for ${sheet?.date ?? 'nothing'}); nothing to post.`);
    return { skipped: true };
  }

  const deep = Math.min(PICKS_DEEP, players.length);
  const ids = players.map(player => player.id);
  const urls = [picksUrl(date, ids, 'list'), ...Array.from({ length: deep }, (_, i) => picksUrl(date, ids, 'player', i + 1))];
  const alts = [
    `Players to watch tonight: ${players.map(player => player.display).join(', ')}`,
    ...players.slice(0, deep).map(player => `${player.display} of ${player.team}: ${player.clauses.slice(0, 2).join(', ')}`),
  ];
  const caption = picksCaption(players, date, SITE_ORIGIN.replace(/^https:\/\//, ''));
  console.log(`Players to watch for ${date}: ${players.map(player => player.display).join(', ')}; ${urls.length} slides; ${THEME} theme.`);

  if (!publish) {
    console.log('DRY RUN — downloading cards instead of posting.');
    await saveCards(urls, urls.map((_, i) => `${date}-picks-${i + 1}`), outDir);
    console.log(`\n--- caption ---\n${caption}\n---------------`);
    return { dryRun: true };
  }
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required to publish');
  const { id, recovered } = await postCarousel({ key: `picks:${date}`, urls, alts, caption, log, igUserId, token, force });
  log.posts = [...log.posts, { date, kind: 'picks', published: true, media_id: id, theme: THEME, players: ids, posted_at: new Date().toISOString() }].slice(-120);
  writeLog(log);
  console.log(`${recovered ? 'Recovered (already live)' : 'Published'} players to watch: ${id}`);
  return { mediaId: id };
}

export async function run({ date = (/^\d{4}-\d{2}-\d{2}$/.test(process.env.IG_DATE || '') ? process.env.IG_DATE : etDate()), publish = process.env.IG_PUBLISH === 'true', includePreseason = process.env.IG_INCLUDE_PRESEASON === 'true', force = process.env.IG_FORCE === 'true', outDir = join(ROOT, 'ig-cards') } = {}) {
  if (process.env.IG_MODE === 'diagnose') return diagnose();
  const log = readLog();
  if (process.env.IG_MODE === 'reel') return runReel({ log, publish, force });
  const isRecap = process.env.IG_MODE === 'recap';
  const isPicks = process.env.IG_MODE === 'picks';
  // The daily set is one per date; recaps are one per game, so they key
  // differently — otherwise the day's daily post blocks that night's recap.
  if (!force && !isRecap && !isPicks && log.posts.some(post => post.date === date && post.published && (post.kind || 'daily') === 'daily')) {
    console.log(`Already published the daily set for ${date}; nothing to do. Set IG_FORCE=true to post again.`);
    return { skipped: true };
  }

  if (isPicks) return runPicks({ date, log, publish, force, outDir });

  // Recap mode: claim slots for games as they finish, then the night's roundup.
  if (isRecap) {
    // Pollers send no date: look at last night (late games finish after midnight
    // ET) and tonight. The fixed crons pass an explicit date.
    const dates = /^\d{4}-\d{2}-\d{2}$/.test(process.env.IG_DATE || '') ? [date] : [shiftDate(etDate(), -1), etDate()];
    const mediaIds = [];
    const failures = [];
    for (const night of dates) {
      await recapNight(night, { log, publish, includePreseason, force, outDir, mediaIds, failures });
      if (failures.some(item => /request limit/i.test(item))) break;
    }
    if (failures.length) throw new Error(failures.join(' | '));
    if (!publish) return { dryRun: true };
    if (!mediaIds.length) {
      console.log('Nothing new to recap.');
      return { skipped: true };
    }
    return { mediaIds };
  }

  const allGames = await todaysGames(date);
  const games = includePreseason ? allGames : allGames.filter(game => game.gameType !== 1);
  if (!games.length) {
    console.log(`No qualifying games on ${date}; nothing to post.`);
    return { skipped: true };
  }

  const caption = buildCaption(games, date);
  const cards = CARDS.slice(0, MAX_CAROUSEL);
  console.log(`${games.length} game(s) on ${date}; ${cards.length} cards; ${THEME} theme.`);

  if (!publish) {
    console.log('DRY RUN — downloading cards instead of posting.');
    await downloadCards(cards, date, outDir);
    console.log(`\n--- caption ---\n${caption}\n---------------`);
    return { dryRun: true, cards: cards.length };
  }

  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required to publish');

  const urls = cards.map((item, i) => cardUrl(item.card, date, SITE_ORIGIN, { index: i + 1, total: cards.length }));
  const { id, recovered } = await postCarousel({ key: `daily:${date}`, urls, alts: cards.map(item => item.alt), caption, log, igUserId, token, force });

  log.posts = [...log.posts.filter(post => post.date !== date || (post.kind || 'daily') !== 'daily'), { date, kind: 'daily', published: true, media_id: id, theme: THEME, cards: cards.map(item => item.card), posted_at: new Date().toISOString() }].slice(-120);
  writeLog(log);
  console.log(`${recovered ? 'Recovered (already live)' : 'Published'}: ${id}`);
  return { mediaId: id };
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const dateArg = process.argv.find(arg => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  run(dateArg ? { date: dateArg } : {}).catch(error => {
    console.error(`Instagram post failed: ${error.message}`);
    process.exit(1);
  });
}
