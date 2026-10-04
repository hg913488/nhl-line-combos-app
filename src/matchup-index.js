// Display-only defensive index: goals allowed per game by position, blended with last season while
// the current one is young, then divided by the league mean (1.00 = average). Picks keep their own
// last-10 index in picks-signal.js; nothing here feeds them.

export const POSITIONS = ['C', 'LW', 'RW', 'D'];
export const ALL = 'ALL';
export const PRIOR_GAMES = 12; // last season counts as this many games of evidence
export const PREV_SEASON_GAMES = 82; // the file stores season totals, not games played

const sum = values => values.reduce((total, value) => total + value, 0);

/**
 * @param {object} data parsed goals_against_by_position.json
 * @returns {{ teams: Record<string, { gp: number, weight: number, rate: Record<string, number>, index: Record<string, number>, rank: Record<string, number> }>, size: number }}
 */
export function buildIndex(data) {
  const teams = {};
  const abbrs = Object.keys(data?.teams || {});
  for (const abbr of abbrs) {
    const team = data.teams[abbr];
    const prior = data.previous?.teams?.[abbr];
    const gp = (team.l10_games || []).filter(game => game.season === data.season_id).length;
    const k = prior ? PRIOR_GAMES : 0;
    const rate = {};
    for (const pos of POSITIONS) {
      const prevPerGame = prior ? (prior.ytd?.[pos] || 0) / PREV_SEASON_GAMES : 0;
      const denominator = gp + k;
      rate[pos] = denominator > 0 ? ((team.ytd?.[pos] || 0) + k * prevPerGame) / denominator : 0;
    }
    rate[ALL] = sum(POSITIONS.map(pos => rate[pos]));
    teams[abbr] = { gp, weight: gp + k > 0 ? gp / (gp + k) : 1, rate, index: {}, rank: {} };
  }
  for (const key of [...POSITIONS, ALL]) {
    const mean = abbrs.length ? sum(abbrs.map(abbr => teams[abbr].rate[key])) / abbrs.length : 0;
    abbrs.forEach(abbr => { teams[abbr].index[key] = mean > 0 ? teams[abbr].rate[key] / mean : 1; });
    [...abbrs]
      .sort((a, b) => teams[b].index[key] - teams[a].index[key] || a.localeCompare(b))
      .forEach((abbr, i) => { teams[abbr].rank[key] = i + 1; });
  }
  return { teams, size: abbrs.length };
}

/** Both sides of a game: what each defence allows to the other team's skaters, plus the best spot. */
export function matchupEdges(built, away, home) {
  const a = built.teams[away], h = built.teams[home];
  if (!a || !h) return null;
  const rows = POSITIONS.map(pos => ({ pos, awaySkaters: h.index[pos], homeSkaters: a.index[pos] }));
  const options = rows.flatMap(row => [
    { team: away, vs: home, pos: row.pos, index: row.awaySkaters },
    { team: home, vs: away, pos: row.pos, index: row.homeSkaters },
  ]).sort((x, y) => y.index - x.index);
  return { rows, best: options[0], weight: (a.weight + h.weight) / 2, gp: [a.gp, h.gp] };
}
