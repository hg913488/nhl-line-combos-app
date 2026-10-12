import { pickStatus } from './picks-results.js';
export const POSITION_NAMES = { C: 'Centers', LW: 'Left wings', RW: 'Right wings', D: 'Defensemen' };
export function dailyMatchups(picks, date) {
  const groups = new Map();
  for (const pick of picks.filter(p => p.date === date)) {
    let group = groups.get(pick.game_id);
    if (!group) { group = { id: pick.game_id, start: pick.start_time_utc, picks: [] }; groups.set(pick.game_id, group); }
    group.picks.push(pick);
    if (pick.venue === 'away') { group.away = pick.offense; group.home = pick.defense; }
    if (pick.venue === 'home') { group.home = pick.offense; group.away = pick.defense; }
  }
  return [...groups.values()].sort((a,b) => a.start.localeCompare(b.start) || a.id-b.id);
}
export function pickReason(pick) {
  const index = pick.index?.[pick.watch];
  if (!Number.isFinite(index)) return 'Matchup signal saved before puck drop.';
  if (index > 1) return `${pick.defense} allowed ${Math.round((index-1)*100)}% more goals to ${POSITION_NAMES[pick.watch]?.toLowerCase() || pick.watch} than the league average.`;
  return 'The strongest relative position matchup in the saved model. Below-average scoring allowed.';
}
export function matchingScorers(pick, game) {
  const positions = { L: 'LW', R: 'RW', C: 'C', D: 'D' };
  const saved = (pick.result?.scorers || []).filter(s => (s.position || s.pos) === pick.watch && s.goals > 0);
  if (saved.length) return saved.map(s => ({id:s.player_id, name:s.name, goals:s.goals, headshot:s.player_id ? `https://assets.nhle.com/mugs/nhl/${pick.season}/${pick.offense}/${s.player_id}.png` : null}));
  // Enrichment supplies faces/names only; the locked log remains the grading source.
  const found = new Map();
  for (const goal of game?.goals || []) {
    if (goal.team !== pick.offense || positions[goal.scorerPosition] !== pick.watch) continue;
    const previous = found.get(goal.scorerId);
    if (previous) previous.goals += 1;
    else found.set(goal.scorerId, {id:goal.scorerId, name:goal.scorer, headshot:goal.headshot, goals:1});
  }
  return [...found.values()];
}
export function dayOutcome(picks) {
  const statuses = picks.map(pickStatus);
  return { hits:statuses.filter(s=>s==='hit').length, settled:statuses.filter(s=>s==='hit'||s==='miss').length, pending:statuses.filter(s=>s==='pending').length, review:statuses.filter(s=>s==='review').length };
}
