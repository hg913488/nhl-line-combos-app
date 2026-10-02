// Who to feature in the midday "players to watch" post, and why. Pure: the
// caller passes the parsed data files, so the poster script and the card
// renderer choose from the same logic.
//
// Every reason is read from a field in prop_sheet.json / goals_against. A
// clause whose field is missing is left out, never invented.

/** How many of the featured players also get a slide of their own. */
export const PICKS_DEEP = 3;

export const POSITION_LABEL = { C: 'centers', LW: 'left wings', RW: 'right wings', D: 'defensemen' };

const LOW_LINES = new Set(['L3', 'L4', 'D3']);

export const titleCase = name =>
  String(name || '').toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, lead, letter) => lead + letter.toUpperCase());

/** Proper-cased name from spotlight.json (keyed by id) when it has one. */
export const properName = (player, spotlight) => {
  const hit = (spotlight?.players || []).find(entry => entry.id === player.id);
  return hit?.name || titleCase(player.name);
};

/** Higher is more worth watching tonight. */
export function scorePlayer(player) {
  const flags = new Set(player.flags || []);
  let score = 0;
  if (player.pp === 1) score += 2;
  if (flags.has('SOFT_MATCHUP')) score += 1 + Math.min(2, Math.max(0, ((player.opp_index || 0) - 1.2) * 2.5));
  if (flags.has('HOT')) score += 1.5;
  if (flags.has('ROLE_UP')) score += 1;
  if (flags.has('B2B')) score -= 0.5;
  if (LOW_LINES.has(player.line)) score -= 1;
  const games = Math.max(1, player.last10?.gp || 0);
  score += Math.min(2, (player.last10?.p || 0) / 5);
  score += Math.min(1, (player.last10?.sog || 0) / games / 4);
  return Math.round(score * 100) / 100;
}

/** Short, factual reasons, strongest first. No pronouns: the data has no gender. */
export function reasons(player, { allowed, league } = {}) {
  const flags = new Set(player.flags || []);
  const out = [];
  const gp = player.last10?.gp;
  if (flags.has('SOFT_MATCHUP') && player.opp_index > 1) {
    const pct = Math.round((player.opp_index - 1) * 100);
    const label = POSITION_LABEL[player.pos] || 'this position';
    out.push(`${player.opp} give up ${pct}% more goals to ${label} than the league average`);
  }
  if (flags.has('HOT') && gp) out.push(`${player.last10.p} points in the last ${gp} games`);
  if (flags.has('PP1')) out.push('On the first power-play unit');
  if (flags.has('ROLE_UP')) out.push(`Recently moved up to ${player.line}`);
  if (!out.length && gp && player.last10.sog) out.push(`${player.last10.sog} shots in the last ${gp} games`);
  return { clauses: out, allowed, league };
}


function toPick(player, { sheet, ga, spotlight, score = scorePlayer(player) }) {
  const allowed = ga?.teams?.[player.opp]?.l10?.[player.pos];
  const league = ga?.league?.l10_avg?.[player.pos];
  const game = (sheet.games || []).find(item => item.game_id === player.game_id);
  return {
    id: player.id,
    name: player.name,
    display: properName(player, spotlight),
    team: player.team,
    opp: player.opp,
    home: player.home,
    pos: player.pos,
    line: player.line,
    pp: player.pp,
    gameId: player.game_id,
    start: game?.start || null,
    score,
    last10: player.last10,
    oppIndex: player.opp_index,
    goalie: player.opp_goalie?.name ? { name: titleCase(player.opp_goalie.name), confirmed: player.opp_goalie.status === 'Confirmed' } : null,
    ...reasons(player, { allowed, league }),
  };
}

/** Rebuild specific players (a card asked for by id), in the order given. */
export function picksByIds(sheet, ids, { ga, spotlight } = {}) {
  if (!sheet || !Array.isArray(sheet.players)) return [];
  return ids
    .map(id => sheet.players.find(player => player.id === id))
    .filter(Boolean)
    .map(player => toPick(player, { sheet, ga, spotlight }));
}

/**
 * @param {object} sheet     parsed data/prop_sheet.json
 * @param {object} options
 * @param {string} options.date      ET date the post is for; a sheet for another day is stale
 * @param {Date}   [options.now]     games already underway are left out
 * @param {object} [options.ga]      parsed goals_against_by_position.json (for the matchup bar)
 * @param {object} [options.spotlight] parsed spotlight.json, for properly cased names
 * @param {number} [options.limit]   most players to feature
 * @param {number} [options.min]     fewest worth posting; below this the post is skipped
 * @returns {Array<object>} ranked players, or [] when there is nothing worth posting
 */
export function selectWatch(sheet, { date, now, ga, spotlight, limit = 5, min = 3, maxPerGame = 2 } = {}) {
  if (!sheet || sheet.date !== date || !Array.isArray(sheet.players)) return [];
  const upcoming = new Set((sheet.games || [])
    .filter(game => !now || Date.parse(game.start) > now.getTime())
    .map(game => game.game_id));

  const ranked = sheet.players
    .filter(player => player.name && player.team && upcoming.has(player.game_id))
    .map(player => ({ player, score: scorePlayer(player) }))
    .filter(item => item.score >= 3.5)
    .sort((a, b) => b.score - a.score || (b.player.last10?.p || 0) - (a.player.last10?.p || 0) || a.player.id - b.player.id);

  const teams = new Set();
  const perGame = new Map();
  const picked = [];
  for (const { player, score } of ranked) {
    if (picked.length >= limit) break;
    if (teams.has(player.team)) continue;
    if ((perGame.get(player.game_id) || 0) >= maxPerGame) continue;
    teams.add(player.team);
    perGame.set(player.game_id, (perGame.get(player.game_id) || 0) + 1);
    picked.push(toPick(player, { sheet, ga, spotlight, score }));
  }
  return picked.length >= min ? picked : [];
}

/** Instagram caption: names and reasons only, nothing about wagering. */
export function picksCaption(players, date, siteLabel) {
  const when = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const lines = players.map((player, i) => `${i + 1}. ${player.display} (${player.team}): ${player.clauses.slice(0, 2).join(', ')}`);
  const tags = [...new Set(players.flatMap(player => [player.team, player.opp]))].slice(0, 12).map(abbr => `#${abbr}`).join(' ');
  return [
    `Players to watch tonight, ${when}.`,
    '',
    ...lines,
    '',
    'Lineup roles, recent form and matchups, free and updated through the day.',
    siteLabel,
    '',
    `#NHL #hockey #NHLlines ${tags}`.trim(),
  ].join('\n');
}
