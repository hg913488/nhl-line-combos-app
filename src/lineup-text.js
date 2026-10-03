// Lineup wording shared by the slate, the player card and Spotlight. Pure, so it is unit tested.
import { firstAndLast, normalizeName, positionGroup } from './data-client.js';

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

// Symbol-first version of moveClause for tight spaces; callers keep the full clause as a tooltip.
export function moveGlyph(change) {
  const { type, from, to } = change;
  if (type === 'addition') return { mark: '+', kind: 'in', text: 'in' };
  if (type === 'removal') return { mark: '✕', kind: 'out', text: 'out' };
  if (type === 'team') return { mark: '→', kind: 'in', text: 'new team' };
  const unit = type === 'forward_line' ? 'line' : type === 'defense_pair' ? 'pair' : 'PP';
  const label = value => (unit === 'PP' ? `PP${value}` : `${unit} ${value}`);
  if (from == null) return { mark: '→', kind: 'up', text: label(to) };
  if (to == null) return { mark: '✕', kind: 'out', text: `off ${label(from)}` };
  return to < from ? { mark: '↑', kind: 'up', text: label(to) } : { mark: '↓', kind: 'down', text: label(to) };
}

// The spelling a team's lineup uses for this player, or null. Searches only the player's own
// group when the position is known, and accepts a lineup middle name ("Elias Nils Pettersson"),
// so two teammates who share a name don't take each other's slot.
export function lineupName(team, name, pos) {
  if (!team || !name) return null;
  const key = normalizeName(name);
  const groups = { F: team.forwards, D: team.defense, G: team.goalies }[positionGroup(pos)];
  const names = (groups ? [groups] : [team.forwards, team.defense, team.goalies, [team.pp1, team.pp2]])
    .flatMap(list => (list || []).flat()).filter(player => typeof player === 'string');
  return names.find(player => normalizeName(player) === key)
    || names.find(player => firstAndLast(player) === key)
    || null;
}

// Where a player sits in a team's current lineup (data/lines.json shape), or null if absent.
export function playerRole(team, name, pos) {
  const found = lineupName(team, name, pos);
  if (!found) return null;
  const has = list => list?.some(player => player === found);
  const slot = (groups = []) => groups.findIndex(has) + 1;
  const line = slot(team.forwards);
  const pair = slot(team.defense);
  const goalie = slot(team.goalies);
  const pp = [team.pp1, team.pp2].findIndex(has) + 1;
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

// 'F' or 'D' for a line-move event, from its line or pair changes; null for PP-only moves.
export function movePosition(event) {
  const types = new Set((event?.changes || []).map(change => change.type));
  if (types.has('defense_pair')) return 'D';
  return types.has('forward_line') ? 'F' : null;
}
