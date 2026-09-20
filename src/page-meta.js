// Per-route page metadata. Pure string logic (no DOM, no imports beyond team data)
// so it can be shared by the client (document.title), the edge middleware
// (static <head> rewriting), and unit tests.

import { NHL_TEAMS } from './teams.js';

export const SITE_NAME = 'Between the Lines';
export const SITE_TAGLINE = 'Hockey, in context.';
// Flip this to the custom domain once it is live; every canonical/OG URL follows.
export const SITE_URL = 'https://www.betweenthelineshockey.com';

const DEFAULT_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`;

// card -> { title, description, path }. `card` doubles as the /api/og card id.
const ROUTES = {
  home: {
    path: '/',
    title: `${SITE_NAME} — Tonight in the NHL`,
    description:
      'NHL line combinations, line moves, starting goalies, and injuries for every team — updated throughout the day.',
  },
  teams: {
    path: '/teams',
    title: `NHL Line Combinations — ${SITE_NAME}`,
    description:
      'Forward lines, defense pairs, and power-play units for all 32 NHL teams, updated throughout the day.',
  },
  compare: {
    path: '/compare',
    title: `Compare NHL Lineups — ${SITE_NAME}`,
    description: 'Put NHL lineups side by side and see how the forward lines, pairs, and power-play units match up.',
  },
  news: {
    path: '/news',
    title: `NHL News — ${SITE_NAME}`,
    description: 'The NHL headlines that move lineups, gathered in one place and read in the context of tonight’s games.',
  },
  reporters: {
    path: '/reporters',
    title: `NHL Beat Reporters — ${SITE_NAME}`,
    description: 'Beat-reporter lineup notes from morning skate and warmups, collected team by team.',
  },
  moves: {
    path: '/line-moves',
    title: `NHL Line Moves — ${SITE_NAME}`,
    description: 'Every promotion, demotion, scratch, and power-play change across the league, newest first.',
  },
  injuries: {
    path: '/injuries',
    title: `NHL Injuries — ${SITE_NAME}`,
    description: 'League-wide NHL injury report with the lineup hole each absence leaves behind.',
  },
  players: {
    path: '/players',
    title: `NHL Player Stats — ${SITE_NAME}`,
    description: 'Look up any NHL skater or goalie and see recent form next to their current lineup role.',
  },
  matchups: {
    path: '/matchups',
    title: `NHL Matchups — ${SITE_NAME}`,
    description: 'Goals against by position, matchup edges, and the numbers behind tonight’s NHL slate.',
  },
  playoffs: {
    path: '/playoffs',
    title: `NHL Playoffs — ${SITE_NAME}`,
    description: 'The Stanley Cup Playoff bracket with series lineups, line moves, and starting goalies.',
  },
  picks: {
    path: '/picks',
    title: `Picks — ${SITE_NAME}`,
    description: 'The daily model picks log, graded honestly, with every result kept on the record.',
  },
  game: {
    path: '/games',
    title: `NHL Game — ${SITE_NAME}`,
    description: 'Lineups, line moves, and starting goalies for tonight’s NHL matchup.',
  },
  team: {
    path: '/teams',
    title: `NHL Team Lines — ${SITE_NAME}`,
    description: 'Forward lines, defense pairs, and power-play units, updated throughout the day.',
  },
};

const PATH_TO_CARD = new Map([
  ['', 'home'],
  ['teams', 'teams'],
  ['compare', 'compare'],
  ['news', 'news'],
  ['reporters', 'reporters'],
  ['line-moves', 'moves'],
  ['injuries', 'injuries'],
  ['players', 'players'],
  ['matchups', 'matchups'],
  ['playoffs', 'playoffs'],
  ['picks', 'picks'],
]);

const ET_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
});

const ET_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
});

/** "Sep 19" in Eastern time, or null when the date is missing or unparseable. */
export function etDate(startTimeUTC) {
  const time = Date.parse(startTimeUTC || '');
  return Number.isFinite(time) ? ET_DATE.format(new Date(time)) : null;
}

/** "7:00 PM ET" in Eastern time, or null when the date is missing or unparseable. */
export function etTime(startTimeUTC) {
  const time = Date.parse(startTimeUTC || '');
  return Number.isFinite(time) ? `${ET_TIME.format(new Date(time))} ET` : null;
}

const segmentsOf = pathname => String(pathname || '').toLowerCase().split('/').filter(Boolean);

const absolute = (origin, path) => `${(origin || SITE_URL).replace(/\/$/, '')}${path}`;

function ogImage(origin, params) {
  const query = new URLSearchParams({ type: 'page', ...params });
  return absolute(origin, `/api/og?${query}`);
}

function teamMeta(slug, origin) {
  const team = NHL_TEAMS[slug];
  if (!team) return null;
  const full = `${team.city} ${team.name}`;
  return {
    title: `${full} Lines — ${SITE_NAME}`,
    description: `${full} forward lines, defense pairs, power-play units, starting goalie, and injuries — updated throughout the day.`,
    canonical: absolute(SITE_URL, `/teams/${slug}`),
    image: ogImage(origin, { card: 'team', team: slug }),
    imageAlt: `${full} line combinations on ${SITE_NAME}`,
  };
}

function gameMeta(gameId, origin, game) {
  const away = (game?.away || '').toUpperCase();
  const home = (game?.home || '').toUpperCase();
  const day = etDate(game?.startTimeUTC);
  const canonical = absolute(SITE_URL, `/games/${gameId}`);
  if (!away || !home) {
    return {
      title: ROUTES.game.title,
      description: ROUTES.game.description,
      canonical,
      image: ogImage(origin, { card: 'game' }),
      imageAlt: DEFAULT_ALT,
    };
  }
  const when = day ? ` — ${day}` : '';
  const timeText = etTime(game?.startTimeUTC);
  return {
    title: `${away} @ ${home}${when} · ${SITE_NAME}`,
    description: `Projected lines, line moves, starting goalies, and injuries for ${away} at ${home}${
      day ? ` on ${day}` : ''
    }${timeText ? `, ${timeText}` : ''}.`,
    canonical,
    image: ogImage(origin, {
      card: 'game',
      away,
      home,
      ...(game?.startTimeUTC ? { start: game.startTimeUTC } : {}),
    }),
    imageAlt: `${away} at ${home} lineup preview on ${SITE_NAME}`,
  };
}

function staticMeta(card, origin, { canonicalPath } = {}) {
  const route = ROUTES[card] || ROUTES.home;
  return {
    title: route.title,
    description: route.description,
    canonical: absolute(SITE_URL, canonicalPath || route.path),
    image: ogImage(origin, { card }),
    imageAlt: card === 'home' ? DEFAULT_ALT : `${route.title.split(' — ')[0]} — ${SITE_NAME}`,
  };
}

/**
 * Metadata for a route.
 * @param {string} pathname e.g. "/teams/edmonton-oilers"
 * @param {string} search   e.g. "?teams=a,b"
 * @param {{origin?: string, game?: {away?: string, home?: string, startTimeUTC?: string}}} [context]
 * @returns {{title: string, description: string, canonical: string, image: string, imageAlt: string}}
 */
export function pageMeta(pathname, search = '', context = {}) {
  const { origin, game } = context;
  const [first = '', second] = segmentsOf(pathname);

  if (first === 'teams' && second) {
    const team = teamMeta(second, origin);
    if (team) return team;
    return staticMeta('teams', origin);
  }

  if (first === 'games' && second) return gameMeta(second, origin, game);

  if (first === 'compare') {
    const teams = new URLSearchParams(search || '')
      .get('teams')
      ?.split(',')
      .map(slug => slug.trim().toLowerCase())
      .filter(slug => NHL_TEAMS[slug]) || [];
    if (teams.length >= 2) {
      const names = teams.map(slug => `${NHL_TEAMS[slug].city} ${NHL_TEAMS[slug].name}`);
      const headline = names.slice(0, 2).join(' vs ');
      return {
        title: `${headline} Lineups — ${SITE_NAME}`,
        description: `${names.join(', ')} lineups side by side: forward lines, defense pairs, and power-play units.`,
        canonical: absolute(SITE_URL, `/compare?teams=${teams.join(',')}`),
        image: ogImage(origin, { card: 'compare', teams: teams.join(',') }),
        imageAlt: `${headline} lineup comparison on ${SITE_NAME}`,
      };
    }
    return staticMeta('compare', origin);
  }

  const card = PATH_TO_CARD.get(first);
  return staticMeta(card || 'home', origin);
}

/** Page title only — what the client should assign to document.title. */
export function pageTitle(pathname, search = '', context = {}) {
  return pageMeta(pathname, search, context).title;
}

const escapeAttr = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Replaces the first match, or queues the tag for insertion before </head>
// when the static HTML does not carry it yet.
const upsertTag = (html, pattern, tag, pending) => {
  let replaced = false;
  const out = html.replace(pattern, () => {
    replaced = true;
    return tag;
  });
  if (!replaced) pending.push(tag);
  return out;
};

/**
 * Rewrites the <head> of the static index.html so crawlers and link unfurlers
 * see route-specific metadata. Pure: takes HTML in, returns HTML out.
 */
export function applyPageMeta(html, meta) {
  if (typeof html !== 'string' || !meta) return html;
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const canonical = escapeAttr(meta.canonical);
  const image = escapeAttr(meta.image);
  const imageAlt = escapeAttr(meta.imageAlt);

  const pending = [];
  let out = html;
  out = upsertTag(out, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`, pending);
  out = upsertTag(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${description}" />`,
    pending
  );
  out = upsertTag(
    out,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${canonical}" />`,
    pending
  );

  const metaTags = [
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['property', 'og:image', image],
    ['property', 'og:image:alt', imageAlt],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', imageAlt],
  ];

  for (const [attr, key, value] of metaTags) {
    const pattern = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`, 'i');
    out = upsertTag(out, pattern, `<meta ${attr}="${key}" content="${value}" />`, pending);
  }

  if (pending.length && /<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `    ${pending.join('\n    ')}\n  </head>`);
  }
  return out;
}
