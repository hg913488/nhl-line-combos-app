import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pageMeta, pageTitle, applyPageMeta, etDate, etTime, SITE_NAME, SITE_URL } from '../src/page-meta.js';

const ORIGIN = 'https://preview.example';
const INDEX_HTML = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

const ROUTE_CASES = [
  ['/', '', `${SITE_NAME} — Tonight in the NHL`, `${SITE_URL}/`, 'card=home'],
  ['/teams', '', `NHL Line Combinations — ${SITE_NAME}`, `${SITE_URL}/teams`, 'card=teams'],
  ['/compare', '', `Compare NHL Lineups — ${SITE_NAME}`, `${SITE_URL}/compare`, 'card=compare'],
  ['/news', '', `NHL News — ${SITE_NAME}`, `${SITE_URL}/news`, 'card=news'],
  ['/reporters', '', `NHL Beat Reporters — ${SITE_NAME}`, `${SITE_URL}/reporters`, 'card=reporters'],
  ['/line-moves', '', `NHL Line Moves — ${SITE_NAME}`, `${SITE_URL}/line-moves`, 'card=moves'],
  ['/injuries', '', `NHL Injuries — ${SITE_NAME}`, `${SITE_URL}/injuries`, 'card=injuries'],
  ['/players', '', `NHL Player Stats — ${SITE_NAME}`, `${SITE_URL}/players`, 'card=players'],
  ['/matchups', '', `NHL Matchups — ${SITE_NAME}`, `${SITE_URL}/matchups`, 'card=matchups'],
  ['/playoffs', '', `NHL Playoffs — ${SITE_NAME}`, `${SITE_URL}/playoffs`, 'card=playoffs'],
  ['/picks', '', `Picks — ${SITE_NAME}`, `${SITE_URL}/picks`, 'card=picks'],
  ['/disclaimer', '', `Disclaimer — ${SITE_NAME}`, `${SITE_URL}/disclaimer`, 'card=disclaimer'],
];

test('every static route has title, description, canonical and an OG image', () => {
  for (const [pathname, search, title, canonical, imageQuery] of ROUTE_CASES) {
    const meta = pageMeta(pathname, search, { origin: ORIGIN });
    assert.equal(meta.title, title, pathname);
    assert.equal(meta.canonical, canonical, pathname);
    assert.ok(meta.description.length > 40 && meta.description.length < 200, `${pathname} description length`);
    assert.ok(meta.image.startsWith(`${ORIGIN}/api/og?type=page`), pathname);
    assert.ok(meta.image.includes(imageQuery), `${pathname} -> ${meta.image}`);
    assert.ok(meta.imageAlt.length > 0, pathname);
  }
});

test('titles are unique across routes', () => {
  const titles = ROUTE_CASES.map(([pathname]) => pageTitle(pathname));
  assert.equal(new Set(titles).size, titles.length);
});

test('team pages get team-specific title, description and image', () => {
  const meta = pageMeta('/teams/edmonton-oilers', '', { origin: ORIGIN });
  assert.equal(meta.title, `Edmonton Oilers Lines — ${SITE_NAME}`);
  assert.match(meta.description, /^Edmonton Oilers forward lines/);
  assert.equal(meta.canonical, `${SITE_URL}/teams/edmonton-oilers`);
  assert.ok(meta.image.includes('card=team'));
  assert.ok(meta.image.includes('team=edmonton-oilers'));
  assert.match(meta.imageAlt, /Edmonton Oilers/);
});

test('unknown team slug falls back to the teams index meta', () => {
  assert.deepEqual(pageMeta('/teams/not-a-team', '', { origin: ORIGIN }), pageMeta('/teams', '', { origin: ORIGIN }));
});

test('compare with two valid teams names both teams', () => {
  const meta = pageMeta('/compare', '?teams=edmonton-oilers,dallas-stars', { origin: ORIGIN });
  assert.equal(meta.title, `Edmonton Oilers vs Dallas Stars Lineups — ${SITE_NAME}`);
  assert.equal(meta.canonical, `${SITE_URL}/compare?teams=edmonton-oilers,dallas-stars`);
  assert.ok(meta.image.includes('card=compare'));
});

test('compare with junk teams falls back to the generic compare meta', () => {
  assert.deepEqual(
    pageMeta('/compare', '?teams=nope,also-nope', { origin: ORIGIN }),
    pageMeta('/compare', '', { origin: ORIGIN })
  );
});

test('game pages use the matchup and Eastern date', () => {
  const game = { away: 'DAL', home: 'STL', startTimeUTC: '2026-09-19T23:00:00Z' };
  const meta = pageMeta('/games/2026010001', '', { origin: ORIGIN, game });
  assert.equal(meta.title, `DAL @ STL — Sep 19 · ${SITE_NAME}`);
  assert.equal(meta.canonical, `${SITE_URL}/games/2026010001`);
  assert.match(meta.description, /DAL at STL on Sep 19, 7:00 PM ET/);
  assert.ok(meta.image.includes('away=DAL'));
  assert.ok(meta.image.includes('home=STL'));
  assert.ok(meta.image.includes('start=2026-09-19T23%3A00%3A00Z'));
});

test('game pages fall back to generic meta without game data', () => {
  const meta = pageMeta('/games/2026010001', '', { origin: ORIGIN });
  assert.equal(meta.title, `NHL Game — ${SITE_NAME}`);
  assert.equal(meta.canonical, `${SITE_URL}/games/2026010001`);
  assert.ok(meta.image.includes('card=game'));
});

test('unknown paths fall back to home meta', () => {
  assert.deepEqual(pageMeta('/nope/nope', '', { origin: ORIGIN }), pageMeta('/', '', { origin: ORIGIN }));
});

test('origin defaults to SITE_URL and trailing slashes are not doubled', () => {
  assert.ok(pageMeta('/teams').image.startsWith(`${SITE_URL}/api/og?`));
  assert.ok(pageMeta('/teams', '', { origin: `${ORIGIN}/` }).image.startsWith(`${ORIGIN}/api/og?`));
});

test('Eastern time helpers handle missing and invalid input', () => {
  assert.equal(etDate('2026-09-19T23:00:00Z'), 'Sep 19');
  assert.equal(etTime('2026-09-20T00:30:00Z'), '8:30 PM ET');
  assert.equal(etDate(undefined), null);
  assert.equal(etTime('not a date'), null);
});

test('applyPageMeta rewrites the real index.html head', () => {
  const meta = pageMeta('/teams/edmonton-oilers', '', { origin: ORIGIN });
  const html = applyPageMeta(INDEX_HTML, meta);

  assert.match(html, /<title>Edmonton Oilers Lines — Between the Lines<\/title>/);
  assert.equal(html.match(/<title>/g).length, 1);
  assert.ok(html.includes(`<meta name="description" content="${meta.description}" />`));
  assert.ok(html.includes(`<link rel="canonical" href="${meta.canonical}" />`));
  for (const [attr, key] of [
    ['property', 'og:title'],
    ['property', 'og:description'],
    ['property', 'og:url'],
    ['property', 'og:image'],
    ['property', 'og:image:alt'],
    ['name', 'twitter:title'],
    ['name', 'twitter:description'],
    ['name', 'twitter:image'],
    ['name', 'twitter:image:alt'],
  ]) {
    const matches = html.match(new RegExp(`<meta ${attr}="${key}" content="[^"]*"`, 'g')) || [];
    assert.equal(matches.length, 1, `${key} should appear exactly once`);
  }
  // Untouched tags survive.
  assert.ok(html.includes('<meta name="theme-color" content="#17191D" />'));
  assert.ok(html.includes('<script type="module" src="/src/main.jsx"></script>'));
  assert.ok(html.includes('og:image:width'));
  // No stale values from the static file.
  assert.ok(!html.includes('Tonight in the NHL'));
  assert.ok(!html.includes(`${SITE_URL}/og-image.png`));
});

test('applyPageMeta escapes quotes and angle brackets', () => {
  const html = applyPageMeta(INDEX_HTML, {
    title: 'Evil " <script>',
    description: 'a "b" <c>',
    canonical: `${SITE_URL}/`,
    image: `${SITE_URL}/api/og?a=1&b=2`,
    imageAlt: 'alt "quoted"',
  });
  assert.ok(!html.includes('content="a "b"'));
  assert.ok(html.includes('&quot;'));
  assert.ok(html.includes('a=1&amp;b=2'));
  assert.ok(!/<title>Evil " <script>/.test(html));
});

test('applyPageMeta is a no-op for non-string input', () => {
  assert.equal(applyPageMeta(null, pageMeta('/')), null);
  assert.equal(applyPageMeta('<html></html>', null), '<html></html>');
});

// --- middleware (shares the same pure meta helpers) -------------------------

const { default: middleware, config: middlewareConfig } = await import('../middleware.js');

const withStubbedFetch = async (impl, run) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
};

const htmlRequest = (path, init = {}) =>
  new Request(`https://www.betweenthelineshockey.com${path}`, {
    headers: { accept: 'text/html,application/xhtml+xml' },
    ...init,
  });

const shellResponse = () => new Response(INDEX_HTML, { status: 200, headers: { 'content-type': 'text/html' } });

test('middleware matcher skips api, assets and files with extensions', () => {
  const matcher = new RegExp(`^${middlewareConfig.matcher[0]}$`);
  for (const pathname of ['/', '/teams', '/teams/edmonton-oilers', '/games/2026010001', '/line-moves']) {
    assert.ok(matcher.test(pathname), `should match ${pathname}`);
  }
  for (const pathname of ['/api/og', '/assets/index-abc.js', '/index.html', '/favicon.svg', '/og-image.png']) {
    assert.ok(!matcher.test(pathname), `should not match ${pathname}`);
  }
});

test('middleware serves the shell with route metadata injected', async () => {
  const response = await withStubbedFetch(
    async url => (String(url).endsWith('/index.html') ? shellResponse() : new Response('nope', { status: 404 })),
    () => middleware(htmlRequest('/teams/edmonton-oilers'))
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(response.headers.get('cache-control'), /s-maxage=300, stale-while-revalidate=600/);
  const body = await response.text();
  assert.match(body, /<title>Edmonton Oilers Lines — Between the Lines<\/title>/);
});

test('middleware fills game pages from the NHL landing endpoint', async () => {
  const response = await withStubbedFetch(async url => {
    if (String(url).includes('api-web.nhle.com')) {
      return Response.json({
        awayTeam: { abbrev: 'DAL' },
        homeTeam: { abbrev: 'STL' },
        startTimeUTC: '2026-09-19T23:00:00Z',
      });
    }
    return shellResponse();
  }, () => middleware(htmlRequest('/games/2026010001')));
  const body = await response.text();
  assert.match(body, /<title>DAL @ STL — Sep 19 · Between the Lines<\/title>/);
  assert.match(body, /og:image[^>]*away=DAL/);
});

test('middleware passes through when the NHL endpoint fails', async () => {
  const response = await withStubbedFetch(async url => {
    if (String(url).includes('api-web.nhle.com')) throw new Error('offline');
    return shellResponse();
  }, () => middleware(htmlRequest('/games/2026010001')));
  const body = await response.text();
  assert.match(body, /<title>NHL Game — Between the Lines<\/title>/);
});

test('middleware passes the request through when the shell cannot be fetched', async () => {
  for (const impl of [async () => new Response('boom', { status: 500 }), async () => { throw new Error('down'); }]) {
    const response = await withStubbedFetch(impl, () => middleware(htmlRequest('/teams')));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});

test('middleware ignores non-GET, asset and self-referential requests', async () => {
  const cases = [
    htmlRequest('/teams', { method: 'POST' }),
    htmlRequest('/favicon.svg'),
    htmlRequest('/api/og'),
    htmlRequest('/teams', { headers: { accept: 'text/html', 'x-btl-shell': '1' } }),
    htmlRequest('/teams', { headers: { accept: 'application/json' } }),
  ];
  for (const request of cases) {
    const response = await withStubbedFetch(async () => {
      throw new Error('should not fetch');
    }, () => middleware(request));
    assert.equal(response.headers.get('x-middleware-next'), '1', request.url);
  }
});
