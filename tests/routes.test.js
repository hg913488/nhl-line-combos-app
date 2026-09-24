import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW, parseLocation, buildPath, routePattern } from '../src/routes.js';

const TEAMS = ['edmonton-oilers', 'vancouver-canucks', 'toronto-maple-leafs'];

test('root path opens the Tonight landing view', () => {
  assert.deepEqual(parseLocation('/', '', TEAMS), DEFAULT_VIEW);
  assert.equal(DEFAULT_VIEW.tab, 'today');
});

test('every static route round-trips through build and parse', () => {
  const views = [
    { tab: 'today' },
    { tab: 'all', teamMode: 'quick' },
    { tab: 'news', newsSource: 'nhl' },
    { tab: 'news', newsSource: 'reporters' },
    { tab: 'moves' },
    { tab: 'injuries' },
    { tab: 'player' },
    { tab: 'stats' },
    { tab: 'playoffs' },
    { tab: 'picks' },
    { tab: 'disclaimer' },
  ];
  for (const view of views) {
    const url = new URL(buildPath(view), 'https://example.test');
    assert.deepEqual(parseLocation(url.pathname, url.search, TEAMS), { ...DEFAULT_VIEW, ...view }, buildPath(view));
  }
});

test('focused team route carries a valid team slug', () => {
  const view = { tab: 'all', teamMode: 'focus', team: 'edmonton-oilers' };
  assert.equal(buildPath(view), '/teams/edmonton-oilers');
  assert.deepEqual(parseLocation('/teams/edmonton-oilers', '', TEAMS), { ...DEFAULT_VIEW, ...view });
});

test('focused mode without a team links to the teams index', () => {
  assert.equal(buildPath({ tab: 'all', teamMode: 'focus', team: null }), '/teams');
});

test('unknown team slug falls back to the quick scan', () => {
  assert.deepEqual(parseLocation('/teams/not-a-team', '', TEAMS), { ...DEFAULT_VIEW, tab: 'all', teamMode: 'quick' });
});

test('compare route keeps selected teams in order and drops invalid or duplicate ones', () => {
  const view = { tab: 'compare', compare: ['vancouver-canucks', 'edmonton-oilers'] };
  assert.equal(buildPath(view), '/compare?teams=vancouver-canucks,edmonton-oilers');
  const parsed = parseLocation('/compare', '?teams=vancouver-canucks,bogus,edmonton-oilers,vancouver-canucks', TEAMS);
  assert.deepEqual(parsed.compare, ['vancouver-canucks', 'edmonton-oilers']);
  assert.equal(buildPath({ tab: 'compare', compare: [] }), '/compare');
});

test('compare route caps selections at ten teams', () => {
  const many = Array.from({ length: 12 }, (_, i) => `team-${i}`);
  const parsed = parseLocation('/compare', `?teams=${many.join(',')}`, many);
  assert.equal(parsed.compare.length, 10);
});

test('game route carries a numeric NHL game id', () => {
  const view = { tab: 'game', gameId: '2026020001' };
  assert.equal(buildPath(view), '/games/2026020001');
  assert.deepEqual(parseLocation('/games/2026020001', '', TEAMS), { ...DEFAULT_VIEW, ...view });
  assert.equal(routePattern(view), '/games/[id]');
});

test('invalid game ids fall back to Tonight', () => {
  assert.deepEqual(parseLocation('/games/abc', '', TEAMS), DEFAULT_VIEW);
  assert.deepEqual(parseLocation('/games/123', '', TEAMS), DEFAULT_VIEW);
});

test('trailing slashes and casing are tolerated; unknown paths go home', () => {
  assert.equal(parseLocation('/Line-Moves/', '', TEAMS).tab, 'moves');
  assert.deepEqual(parseLocation('/definitely-not-a-page', '', TEAMS), DEFAULT_VIEW);
});
