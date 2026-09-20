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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_PATH = join(ROOT, 'data', 'instagram_log.json');
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

function readLog() {
  try { return JSON.parse(readFileSync(LOG_PATH, 'utf8')); }
  catch { return { schema_version: 1, posts: [] }; }
}

function writeLog(log) {
  writeFileSync(LOG_PATH, `${JSON.stringify(log, null, 2)}\n`);
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
export function pickRecap(games) {
  const done = games.filter(game => ['FINAL', 'OFF'].includes(game.gameState));
  if (!done.length) return null;
  const score = game => {
    const margin = Math.abs((game.homeTeam.score ?? 0) - (game.awayTeam.score ?? 0));
    const extra = game.gameOutcome?.lastPeriodType && game.gameOutcome.lastPeriodType !== 'REG' ? 1000 : 0;
    const closeness = margin <= 1 ? 500 : 0;
    const goals = (game.homeTeam.score ?? 0) + (game.awayTeam.score ?? 0);
    return extra + closeness + goals;
  };
  return done.sort((a, b) => score(b) - score(a))[0];
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

async function waitForContainer(containerId, token) {
  for (let attempt = 0; attempt < STATUS_ATTEMPTS; attempt += 1) {
    const { status_code: status, status: detail } = await fetchJson(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`);
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Container ${containerId} ${status}: ${detail || 'no detail'}`);
    await sleep(STATUS_DELAY_MS);
  }
  throw new Error(`Container ${containerId} was not ready after ${STATUS_ATTEMPTS} checks`);
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

export async function run({ date = (/^\d{4}-\d{2}-\d{2}$/.test(process.env.IG_DATE || '') ? process.env.IG_DATE : etDate()), publish = process.env.IG_PUBLISH === 'true', includePreseason = process.env.IG_INCLUDE_PRESEASON === 'true', force = process.env.IG_FORCE === 'true', outDir = join(ROOT, 'ig-cards') } = {}) {
  const log = readLog();
  if (!force && log.posts.some(post => post.date === date && post.published)) {
    console.log(`Already published for ${date}; nothing to do. Set IG_FORCE=true to post again.`);
    return { skipped: true };
  }

  // Recap mode: one finished game, four slides.
  if (process.env.IG_MODE === 'recap') {
    const data = await fetchJson(`https://api-web.nhle.com/v1/schedule/${date}`);
    const games = data.gameWeek?.find(day => day.date === date)?.games || [];
    const game = process.env.IG_GAME_ID
      ? games.find(item => String(item.id) === process.env.IG_GAME_ID) || { id: Number(process.env.IG_GAME_ID) }
      : pickRecap(games);
    if (!game) {
      console.log(`No finished games on ${date}; nothing to recap.`);
      return { skipped: true };
    }
    const caption = game.awayTeam ? recapCaption(game) : 'Game recap.';
    const cards = RECAP_CARDS;
    console.log(`Recapping game ${game.id}; ${cards.length} cards; ${THEME} theme.`);
    const urls = cards.map((item, i) => recapUrl(item.card, game.id, SITE_ORIGIN, { index: i + 1, total: cards.length }));

    if (!publish) {
      console.log('DRY RUN — downloading recap cards instead of posting.');
      mkdirSync(outDir, { recursive: true });
      for (const [i, url] of urls.entries()) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Recap card ${cards[i].card} returned HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(join(outDir, `${date}-recap-${cards[i].card}.jpg`), buffer);
        console.log(`  saved ${cards[i].card} (${(buffer.length / 1024).toFixed(0)}KB)`);
      }
      console.log(`\n--- caption ---\n${caption}\n---------------`);
      return { dryRun: true, cards: cards.length };
    }

    const igUserIdRecap = process.env.IG_USER_ID;
    const tokenRecap = process.env.IG_ACCESS_TOKEN;
    if (!igUserIdRecap || !tokenRecap) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required to publish');
    const children = [];
    for (const [i, url] of urls.entries()) {
      const container = await createContainer(igUserIdRecap, tokenRecap, { image_url: url, is_carousel_item: 'true', alt_text: cards[i].alt });
      await waitForContainer(container.id, tokenRecap);
      children.push(container.id);
      console.log(`  container ready: ${cards[i].card}`);
    }
    const carousel = await createContainer(igUserIdRecap, tokenRecap, { media_type: 'CAROUSEL', children: children.join(','), caption });
    await waitForContainer(carousel.id, tokenRecap);
    const published = await fetchJson(`${GRAPH}/${igUserIdRecap}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: carousel.id, access_token: tokenRecap }) });
    log.posts = [...log.posts, { date, kind: 'recap', game_id: game.id, published: true, media_id: published.id, theme: THEME, posted_at: new Date().toISOString() }].slice(-120);
    writeLog(log);
    console.log(`Published recap: ${published.id}`);
    return { mediaId: published.id };
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

  const children = [];
  for (const item of cards) {
    const container = await createContainer(igUserId, token, { image_url: cardUrl(item.card, date, SITE_ORIGIN, { index: cards.indexOf(item) + 1, total: cards.length }), is_carousel_item: 'true', alt_text: item.alt });
    await waitForContainer(container.id, token);
    children.push(container.id);
    console.log(`  container ready: ${item.card}`);
  }

  const carousel = await createContainer(igUserId, token, { media_type: 'CAROUSEL', children: children.join(','), caption });
  await waitForContainer(carousel.id, token);
  const published = await fetchJson(`${GRAPH}/${igUserId}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: carousel.id, access_token: token }) });

  log.posts = [...log.posts.filter(post => post.date !== date), { date, published: true, media_id: published.id, theme: THEME, cards: cards.map(item => item.card), posted_at: new Date().toISOString() }].slice(-120);
  writeLog(log);
  console.log(`Published: ${published.id}`);
  return { mediaId: published.id };
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const dateArg = process.argv.find(arg => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  run(dateArg ? { date: dateArg } : {}).catch(error => {
    console.error(`Instagram post failed: ${error.message}`);
    process.exit(1);
  });
}
