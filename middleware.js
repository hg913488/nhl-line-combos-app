// Routing Middleware: serves the SPA shell with route-specific <head> metadata
// so crawlers and link unfurlers see the right title, description and share card.
// Runs on the default edge runtime. Any failure falls through to the untouched
// static response — this must never be able to break the page.
// Docs: https://vercel.com/docs/routing-middleware/api
import { next } from '@vercel/functions';
import { pageMeta, applyPageMeta } from './src/page-meta.js';

export const config = {
  // Everything except API routes, build assets, Vercel internals, and any path
  // with a file extension (favicon.svg, og-image.png, index.html, ...).
  matcher: ['/((?!api/|assets/|data/|_vercel|.*\\.[^/]*$).*)'],
};

const HTML_CACHE = 's-maxage=300, stale-while-revalidate=600';
const SHELL_HEADER = 'x-btl-shell';
const GAME_LANDING_TIMEOUT_MS = 1200;
const SHELL_TIMEOUT_MS = 2500;

const SKIP_PREFIXES = ['/api/', '/assets/', '/data/', '/_vercel'];

function shouldHandle(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  // Guard against recursing into ourselves when we fetch the shell.
  if (request.headers.get(SHELL_HEADER)) return false;
  const accept = request.headers.get('accept') || '';
  if (accept && !accept.includes('text/html') && !accept.includes('*/*')) return false;
  const { pathname } = url;
  if (SKIP_PREFIXES.some(prefix => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix))) return false;
  // Any path segment with a file extension is a static asset, not a page.
  if (/\.[^/]*$/.test(pathname)) return false;
  return true;
}

/** Best-effort team/start lookup for /games/:id. Never throws. */
async function fetchGame(pathname) {
  const match = /^\/games\/(\d{6,12})\/?$/.exec(pathname);
  if (!match) return undefined;
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/gamecenter/${match[1]}/landing`, {
      signal: AbortSignal.timeout(GAME_LANDING_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    const away = data?.awayTeam?.abbrev;
    const home = data?.homeTeam?.abbrev;
    if (!away || !home) return undefined;
    return { away, home, startTimeUTC: data?.startTimeUTC };
  } catch {
    return undefined;
  }
}

export default async function middleware(request) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return next();
  }
  if (!shouldHandle(request, url)) return next();

  try {
    const [shell, game] = await Promise.all([
      fetch(new URL('/index.html', url.origin), {
        headers: { [SHELL_HEADER]: '1', accept: 'text/html' },
        signal: AbortSignal.timeout(SHELL_TIMEOUT_MS),
      }),
      fetchGame(url.pathname),
    ]);
    if (!shell.ok) return next();

    const html = await shell.text();
    if (!html.includes('<head>')) return next();

    const meta = pageMeta(url.pathname, url.search, { origin: url.origin, game });
    return new Response(applyPageMeta(html, meta), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': `public, ${HTML_CACHE}`,
        'x-btl-meta': 'hit',
      },
    });
  } catch {
    return next();
  }
}
