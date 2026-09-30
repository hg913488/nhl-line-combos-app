// Lineup wording shared by the slate, the player card and Spotlight. Pure, so it is unit tested.
import { normalizeName } from './data-client.js';

export const titleCase = name => name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, match => match.toUpperCase());
export const surname = name => titleCase(name.split(' ').slice(-1)[0]);

// One readable clause per lineup change, e.g. "drops to line 3", "joins PP1".
export function moveClause(change) {
  const { type, from, to } = change;
  if (type === 'addition') return 'enters the lineup';
  if (type === 'removal') return 'is out of the lineup';
  if (type === 'team') return 'joins from a new team';
  const unit = type === 'forward_line' ? 'line' : type === 'defense_pair' ? 'pair' : 'PP';
  const label = value => (unit === 'PP' ? `PP${value}` : `${unit} ${value}`);
  if (from == null) return `slots onto ${label(to)}`;
  if (to == null) return `comes off ${label(from)}`;
  return to < from ? `moves up to ${label(to)}` : `drops to ${label(to)}`;
}

// Where a player sits in a team's current lineup (data/lines.json shape), or null if absent.
export function playerRole(team, name) {
  if (!team || !name) return null;
  const key = normalizeName(name);
  const slot = (groups = []) => groups.findIndex(group => group.some(player => normalizeName(player) === key)) + 1;
  const line = slot(team.forwards);
  const pair = slot(team.defense);
  const goalie = slot(team.goalies);
  const pp = [team.pp1, team.pp2].findIndex(unit => unit?.some(player => normalizeName(player) === key)) + 1;
  if (!line && !pair && !goalie && !pp) return null;
  return {
    slot: line ? `Line ${line}` : pair ? `Pair ${pair}` : goalie ? (goalie === 1 ? 'Starter' : 'Backup') : null,
    pp: pp ? `PP${pp}` : null,
  };
}

// The newest lineup_changes.json event for this player on this team (events are newest first).
export function latestMove(events, teamSlug, name) {
  const key = normalizeName(name || '');
  return events.find(event => event.team === teamSlug && normalizeName(event.player) === key) || null;
}
