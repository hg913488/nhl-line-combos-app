// Deterministic caption hooks. Every function is a pure function of its inputs: the same post
// (kind + date/game + data) always yields the same words, because publish recovery matches a
// published post by exact caption text. Variety comes from the data and from a seed built from the
// date, never from Math.random or the clock.
//
// No wagering language and no pronouns for players: the data has no gender.

/** FNV-1a string hash, unsigned. */
export function hashSeed(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Rotate through options by seed. */
export const pick = (options, seed) => options[seed % options.length];

export const formatDay = date =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const POSITION_LABEL = { C: 'centers', LW: 'left wings', RW: 'right wings', D: 'defensemen' };

/** First candidate chosen by seed among the hooks that apply; null when none apply. */
const choose = (candidates, seed) => {
  const live = candidates.filter(Boolean);
  return live.length ? pick(live, seed) : null;
};

// ── Daily slate ────────────────────────────────────────────────────────────────────────────────
const RIVALRIES = [['TOR', 'MTL'], ['BOS', 'MTL'], ['NYR', 'NYI'], ['PHI', 'PIT'], ['EDM', 'CGY'], ['CHI', 'STL'], ['DET', 'TOR'], ['BOS', 'TOR']];

export function slateOpener(games, date) {
  const when = formatDay(date);
  const seed = hashSeed(`daily:${date}`);
  const count = games.length;
  return pick([
    `${when}: ${plural(count, 'game', 'games')} on the slate.`,
    `${plural(count, 'game', 'games')} tonight, ${when}.`,
    `${when}. ${plural(count, 'game', 'games')} to track.`,
  ], seed);
}

export function slateHook(games, date) {
  const seed = hashSeed(`daily-hook:${date}`);
  const pairs = new Set(games.map(game => [game.away, game.home].sort().join('-')));
  const rivalry = RIVALRIES.find(pair => pairs.has([...pair].sort().join('-')));
  const count = games.length;
  return choose([
    rivalry && `${rivalry[0]} and ${rivalry[1]} meet tonight.`,
    count >= 12 && 'A full slate: most of the league is in action.',
    count > 0 && count <= 3 && 'A quiet night, so every lineup matters.',
  ], seed);
}

// ── Recap ──────────────────────────────────────────────────────────────────────────────────────
export function recapHook(game, date = '') {
  const home = game.homeTeam.score ?? 0;
  const away = game.awayTeam.score ?? 0;
  const margin = Math.abs(home - away);
  const total = home + away;
  const period = game.gameOutcome?.lastPeriodType;
  const seed = hashSeed(`recap:${game.id ?? ''}:${date}`);
  return choose([
    period === 'SO' && 'It took a shootout.',
    period === 'OT' && 'It needed overtime.',
    margin === 1 && period === 'REG' && 'A one-goal game in regulation.',
    margin >= 4 && `A ${margin}-goal margin.`,
    total >= 9 && `${total} goals between the two teams.`,
    (home === 0 || away === 0) && 'A shutout.',
  ], seed);
}

// ── Scoreboard ─────────────────────────────────────────────────────────────────────────────────
export function scoreboardHook(finished, date) {
  const seed = hashSeed(`scoreboard:${date}`);
  const totals = finished.map(game => (game.homeTeam.score ?? 0) + (game.awayTeam.score ?? 0));
  const overtime = finished.filter(game => game.gameOutcome?.lastPeriodType && game.gameOutcome.lastPeriodType !== 'REG').length;
  const oneGoal = finished.filter(game => Math.abs((game.homeTeam.score ?? 0) - (game.awayTeam.score ?? 0)) === 1).length;
  const shutouts = finished.filter(game => game.homeTeam.score === 0 || game.awayTeam.score === 0).length;
  const most = Math.max(0, ...totals);
  return choose([
    overtime > 0 && `${plural(overtime, 'game', 'games')} went past 60 minutes.`,
    oneGoal >= 3 && `${oneGoal} of the finals were one-goal games.`,
    shutouts > 0 && `${plural(shutouts, 'shutout', 'shutouts')} on the night.`,
    most >= 9 && `The highest-scoring game had ${most} goals.`,
  ], seed);
}

// ── Players to watch / Moving up ───────────────────────────────────────────────────────────────
export const picksOpener = (date, when) =>
  pick([
    `Players to watch tonight, ${when}.`,
    `Who to watch tonight, ${when}.`,
    `Tonight's players to watch, ${when}.`,
  ], hashSeed(`picks:${date}`));

export function picksHook(players, date) {
  const seed = hashSeed(`picks-hook:${date}`);
  const soft = [...players].filter(p => p.oppIndex > 1.2).sort((a, b) => b.oppIndex - a.oppIndex)[0];
  const hot = [...players].filter(p => p.last10?.gp).sort((a, b) => b.last10.p - a.last10.p)[0];
  const unconfirmed = players.filter(p => p.goalie && !p.goalie.confirmed).length;
  return choose([
    soft && `Softest matchup on the list: ${soft.opp} allow ${Math.round((soft.oppIndex - 1) * 100)}% more goals to ${POSITION_LABEL[soft.pos] || 'this position'} than the league average.`,
    hot && hot.last10.p >= 5 && `Hottest on the list: ${hot.display} with ${hot.last10.p} points in the last ${hot.last10.gp} games.`,
    unconfirmed > 0 && `${plural(unconfirmed, 'opposing goalie', 'opposing goalies')} still unconfirmed at post time.`,
  ], seed);
}

export const risersOpener = (date, when) =>
  pick([
    `Moving up the lineup, ${when}.`,
    `Promoted in the last 48 hours, ${when}.`,
    `Lineup risers tonight, ${when}.`,
  ], hashSeed(`risers:${date}`));

export function risersHook(players, date) {
  const seed = hashSeed(`risers-hook:${date}`);
  const biggest = [...players].filter(p => p.move?.from != null && p.move.jump > 1).sort((a, b) => b.move.jump - a.move.jump)[0];
  const powerPlay = players.filter(p => p.move?.type === 'power_play').length;
  return choose([
    biggest && `Biggest jump: ${biggest.display} (${biggest.team}) moved up ${biggest.move.jump} spots.`,
    powerPlay > 0 && `${plural(powerPlay, 'power-play promotion', 'power-play promotions')} on the list.`,
    players.length > 0 && `${plural(players.length, 'promotion', 'promotions')} for players in action tonight.`,
  ], seed);
}
