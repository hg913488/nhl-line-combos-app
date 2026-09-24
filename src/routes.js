// URL <-> view state. Kept free of React so it can be unit tested with node --test.

const MAX_COMPARE = 10;

export const DEFAULT_VIEW = Object.freeze({ tab: 'today', teamMode: 'quick', newsSource: 'nhl', team: null, compare: [], gameId: null });

const GAME_ID = /^\d{10}$/;

// path segment -> partial view; order also defines the canonical path for each view
const STATIC_ROUTES = [
  ['', { tab: 'today' }],
  ['teams', { tab: 'all', teamMode: 'quick' }],
  ['news', { tab: 'news', newsSource: 'nhl' }],
  ['reporters', { tab: 'news', newsSource: 'reporters' }],
  ['line-moves', { tab: 'moves' }],
  ['injuries', { tab: 'injuries' }],
  ['players', { tab: 'player' }],
  ['matchups', { tab: 'stats' }],
  ['playoffs', { tab: 'playoffs' }],
  ['picks', { tab: 'picks' }],
  ['disclaimer', { tab: 'disclaimer' }],
];


const segmentsOf = pathname => pathname.toLowerCase().split('/').filter(Boolean);

function parseCompare(search, validTeams) {
  const raw = new URLSearchParams(search).get('teams') || '';
  const valid = new Set(validTeams);
  return [...new Set(raw.split(',').map(slug => slug.trim().toLowerCase()))]
    .filter(slug => valid.has(slug))
    .slice(0, MAX_COMPARE);
}

export function parseLocation(pathname, search, validTeams) {
  const [first = '', second] = segmentsOf(pathname);
  if (first === 'teams' && second) {
    return validTeams.includes(second)
      ? { ...DEFAULT_VIEW, tab: 'all', teamMode: 'focus', team: second }
      : { ...DEFAULT_VIEW, tab: 'all', teamMode: 'quick' };
  }
  if (first === 'games') return second && GAME_ID.test(second) ? { ...DEFAULT_VIEW, tab: 'game', gameId: second } : { ...DEFAULT_VIEW };
  if (first === 'compare') return { ...DEFAULT_VIEW, tab: 'compare', compare: parseCompare(search, validTeams) };
  const match = STATIC_ROUTES.find(([segment]) => segment === first);
  return { ...DEFAULT_VIEW, ...(match ? match[1] : {}) };
}

export function buildPath(view) {
  if (view.tab === 'all') return view.teamMode === 'focus' && view.team ? `/teams/${view.team}` : '/teams';
  if (view.tab === 'game') return view.gameId ? `/games/${view.gameId}` : '/';
  if (view.tab === 'compare') return view.compare?.length ? `/compare?teams=${view.compare.join(',')}` : '/compare';
  const match = STATIC_ROUTES.find(([, partial]) => Object.entries(partial).every(([key, value]) => view[key] === value));
  return `/${match ? match[0] : ''}`;
}

// Route pattern for analytics grouping, e.g. /teams/[team]
export function routePattern(view) {
  if (view.tab === 'all' && view.teamMode === 'focus' && view.team) return '/teams/[team]';
  if (view.tab === 'compare') return '/compare';
  if (view.tab === 'game') return '/games/[id]';
  return buildPath(view);
}
