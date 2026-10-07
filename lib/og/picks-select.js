// Who to feature in the midday "players to watch" post, and why. Pure: the
// caller passes the parsed data files, so the poster script and the card
// renderer choose from the same logic.
//
// Every reason is read from a field in prop_sheet.json / goals_against. A
// clause whose field is missing is left out, never invented.
import { NHL_TEAMS } from '../../src/teams.js';
import { formatDay, picksOpener, picksHook, risersOpener, risersHook } from '../captions/hooks.js';

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

const hookLines = hook => (hook ? [hook] : []);

/** Instagram caption: names and reasons only, nothing about wagering. */
export function picksCaption(players, date, siteLabel) {
  const when = formatDay(date);
  const lines = players.map((player, i) => `${i + 1}. ${player.display} (${player.team}): ${player.clauses.slice(0, 2).join(', ')}`);
  const tags = [...new Set(players.flatMap(player => [player.team, player.opp]))].slice(0, 12).map(abbr => `#${abbr}`).join(' ');
  return [
    picksOpener(date, when),
    ...hookLines(picksHook(players, date)),
    '',
    ...lines,
    '',
    'Lineup roles, recent form and matchups, free and updated through the day.',
    siteLabel,
    '',
    `#NHL #hockey #NHLlines ${tags}`.trim(),
  ].join('\n');
}


// ── Moving up: players promoted in the last 48 hours who play tonight ──────────────────────────
const ABBR_BY_SLUG = Object.fromEntries(Object.entries(NHL_TEAMS).map(([slug, team]) => [slug, team.abbr]));
const UNIT_LABEL = { forward_line: n => `line ${n}`, defense_pair: n => `pair ${n}`, power_play: n => `PP${n}` };
export const RISERS_WINDOW_HOURS = 48;

/** How big a promotion is: places gained, or a fixed bump for a newly gained slot. */
const jump = change => (change.from == null ? (change.type === 'power_play' && change.to === 1 ? 3 : 2) : change.from - change.to);
/** Worth a post: into the top six, the top pair, or a top-two power-play unit. */
const notable = change => change.to != null && (
  (change.type === 'forward_line' && change.to <= 2) ||
  (change.type === 'defense_pair' && change.to <= 1) ||
  (change.type === 'power_play' && change.to <= 2));

/** The player's strongest promotion inside the window, or null. */
export function latestPromotion(changes, { team, name, now = new Date(), hours = RISERS_WINDOW_HOURS }) {
  const floor = now.getTime() - hours * 3600 * 1000;
  let best = null;
  for (const event of changes?.events || []) {
    if (ABBR_BY_SLUG[event.team] !== team || String(event.player || '').toUpperCase() !== String(name || '').toUpperCase()) continue;
    const at = Date.parse(event.occurred_at);
    if (!Number.isFinite(at) || at < floor || at > now.getTime()) continue;
    for (const change of event.changes || []) {
      if (change.direction !== 'promoted' || !UNIT_LABEL[change.type] || !notable(change)) continue;
      const candidate = { type: change.type, from: change.from ?? null, to: change.to, jump: jump(change), at, hoursAgo: Math.max(1, Math.round((now.getTime() - at) / 3600000)) };
      if (!best || candidate.jump > best.jump || (candidate.jump === best.jump && candidate.at > best.at)) best = candidate;
    }
  }
  return best;
}

const moveClause = move => {
  const unit = UNIT_LABEL[move.type];
  const ago = `${move.hoursAgo} ${move.hoursAgo === 1 ? 'hour' : 'hours'} ago`;
  if (move.type === 'power_play') return move.from == null ? `Added to power-play unit ${move.to}, ${ago}` : `Moved up from PP${move.from} to PP${move.to}, ${ago}`;
  return move.from == null ? `Moved into ${unit(move.to)}, ${ago}` : `Moved up from ${unit(move.from)} to ${unit(move.to)}, ${ago}`;
};

/**
 * Players whose role just improved and who play tonight. Same card shape as selectWatch, plus
 * `move` ({ type, from, to, jump, hoursAgo }); `exclude` keeps names already featured elsewhere
 * that day from repeating. Fewer than `min` returns [] so the post is skipped, not padded.
 */
export function selectRisers(sheet, changes, { date, now = new Date(), ga, spotlight, limit = 5, min = 3, maxPerGame = 2, exclude = [] } = {}) {
  if (!sheet || sheet.date !== date || !Array.isArray(sheet.players)) return [];
  const upcoming = new Set((sheet.games || []).filter(game => !now || Date.parse(game.start) > now.getTime()).map(game => game.game_id));
  const skip = new Set(exclude);
  const ranked = sheet.players
    .filter(player => player.name && player.team && upcoming.has(player.game_id) && !skip.has(player.id) && (player.flags || []).includes('ROLE_UP'))
    .map(player => ({ player, move: latestPromotion(changes, { team: player.team, name: player.name, now }) }))
    .filter(item => item.move)
    .map(item => ({ ...item, score: item.move.jump * 2 + Math.min(2, (item.player.last10?.p || 0) / 5) + ((item.player.flags || []).includes('SOFT_MATCHUP') ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score || (b.player.last10?.p || 0) - (a.player.last10?.p || 0) || a.player.id - b.player.id);

  const teams = new Set();
  const perGame = new Map();
  const picked = [];
  for (const { player, move, score } of ranked) {
    if (picked.length >= limit) break;
    if (teams.has(player.team) || (perGame.get(player.game_id) || 0) >= maxPerGame) continue;
    teams.add(player.team);
    perGame.set(player.game_id, (perGame.get(player.game_id) || 0) + 1);
    const pick = toPick(player, { sheet, ga, spotlight, score });
    pick.move = move;
    pick.clauses = [moveClause(move), ...pick.clauses.filter(clause => !/^Recently moved up/.test(clause))];
    picked.push(pick);
  }
  return picked.length >= min ? picked : [];
}

/** Rebuild specific risers by id (a card asked for by id), in the order given. */
export function risersByIds(sheet, changes, ids, { ga, spotlight, now = new Date() } = {}) {
  const found = picksByIds(sheet, ids, { ga, spotlight });
  return found.map(pick => {
    const move = latestPromotion(changes, { team: pick.team, name: pick.name, now });
    if (!move) return pick;
    return { ...pick, move, clauses: [moveClause(move), ...pick.clauses.filter(clause => !/^Recently moved up/.test(clause))] };
  });
}

/** Instagram caption for the risers post: names and reasons only, nothing about wagering. */
export function risersCaption(players, date, siteLabel) {
  const when = formatDay(date);
  const lines = players.map((player, i) => `${i + 1}. ${player.display} (${player.team}): ${player.clauses[0]}${player.last10?.gp ? `, ${player.last10.p} points in the last ${player.last10.gp} games` : ''}`);
  const tags = [...new Set(players.flatMap(player => [player.team, player.opp]))].slice(0, 12).map(abbr => `#${abbr}`).join(' ');
  return [
    risersOpener(date, when),
    ...hookLines(risersHook(players, date)),
    '',
    ...lines,
    '',
    'Promotions in the last 48 hours for players in action tonight. Lines can change before puck drop.',
    siteLabel,
    '',
    `#NHL #hockey #NHLlines ${tags}`.trim(),
  ].join('\n');
}
