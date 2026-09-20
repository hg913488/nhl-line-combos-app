// Card content derived from the committed data files plus the live NHL schedule.
// Every reader is defensive: a missing or malformed file yields an empty card
// rather than a failed image.
import { readFileSync } from 'node:fs';
import { NHL_TEAMS } from '../../src/teams.js';
import { etTime } from '../../src/page-meta.js';

const SCHEDULE_TIMEOUT_MS = 3000;

const BY_ABBR = Object.fromEntries(Object.entries(NHL_TEAMS).map(([slug, team]) => [team.abbr, { ...team, slug }]));

export const abbrOf = slug => NHL_TEAMS[slug]?.abbr || String(slug || '').slice(0, 3).toUpperCase();
export const teamName = slug => (NHL_TEAMS[slug] ? `${NHL_TEAMS[slug].city} ${NHL_TEAMS[slug].name}` : slug);
export const nameOfAbbr = abbr => (BY_ABBR[abbr] ? `${BY_ABBR[abbr].city} ${BY_ABBR[abbr].name}` : abbr);

const cache = new Map();

// Literal URLs, so Vercel's file tracing sees each data file and bundles it
// with the function. A computed path would be missed and the cards would come
// out empty in production.
const FILES = {
  lines: new URL('../../data/lines.json', import.meta.url),
  lineupChanges: new URL('../../data/lineup_changes.json', import.meta.url),
  goalies: new URL('../../data/goalies.json', import.meta.url),
  goalsAgainst: new URL('../../data/goals_against_by_position.json', import.meta.url),
  propSheet: new URL('../../data/prop_sheet.json', import.meta.url),
};

/** Reads one of the committed data files. Returns null if absent or invalid. */
function readData(key) {
  if (cache.has(key)) return cache.get(key);
  let parsed = null;
  try {
    parsed = JSON.parse(readFileSync(FILES[key], 'utf8'));
  } catch {
    parsed = null;
  }
  cache.set(key, parsed);
  return parsed;
}

export const lines = () => readData('lines');
export const lineupChanges = () => readData('lineupChanges');
export const goalies = () => readData('goalies');
export const goalsAgainst = () => readData('goalsAgainst');
export const propSheet = () => readData('propSheet');

export const todayET = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/**
 * Tonight's games from the live NHL schedule.
 * @returns {Promise<Array<{id: number, away: string, home: string, startTimeUTC: string, gameType: number}>>}
 */
export async function slate(date = todayET()) {
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, {
      signal: AbortSignal.timeout(SCHEDULE_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const day = (data?.gameWeek || []).find(entry => entry.date === date);
    return (day?.games || []).map(game => ({
      id: game.id,
      away: game.awayTeam?.abbrev,
      home: game.homeTeam?.abbrev,
      startTimeUTC: game.startTimeUTC,
      gameType: game.gameType,
      time: etTime(game.startTimeUTC) || 'TBD',
    })).filter(game => game.away && game.home);
  } catch {
    return [];
  }
}

const MOVE_LABELS = {
  forward_line: (from, to) => `Line ${from ?? '—'} → Line ${to ?? '—'}`,
  defense_pair: (from, to) => `Pair ${from ?? '—'} → Pair ${to ?? '—'}`,
  power_play: (from, to) => (to ? `PP${to} unit` : 'Off the power play'),
  goalie_slot: (from, to) => `Goalie depth ${from ?? '—'} → ${to ?? '—'}`,
  removal: () => 'Out of the lineup',
  addition: () => 'Into the lineup',
  team: (from, to) => `${abbrOf(from)} → ${abbrOf(to)}`,
};

const directionOf = change => {
  if (change.type === 'removal') return 'down';
  if (change.type === 'addition') return 'up';
  if (change.direction === 'promoted') return 'up';
  if (change.direction === 'demoted') return 'down';
  return 'flat';
};

/**
 * Most notable lineup changes inside a window.
 * @returns {Array<{player: string, team: string, abbr: string, note: string, direction: 'up'|'down'|'flat', at: number}>}
 */
export function recentMoves({ hours = 24, limit = 6, now = Date.now() } = {}) {
  const events = lineupChanges()?.events;
  if (!Array.isArray(events)) return [];
  const cutoff = now - hours * 3600 * 1000;
  const weight = { high: 0, medium: 1, low: 2 };
  return events
    .filter(event => Date.parse(event.occurred_at || '') >= cutoff)
    .sort((a, b) => (weight[a.importance] ?? 3) - (weight[b.importance] ?? 3) || Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, limit)
    .map(event => {
      const change = event.changes?.[0] || {};
      const describe = MOVE_LABELS[change.type];
      return {
        player: event.player,
        team: event.team,
        abbr: abbrOf(event.team),
        note: describe ? describe(change.from, change.to) : 'Lineup change',
        direction: directionOf(change),
        at: Date.parse(event.occurred_at || '') || 0,
      };
    });
}

const firstGoalie = slug => lines()?.teams?.[slug]?.goalies?.[0]?.[0] || null;

/**
 * Confirmed goalie duels, or projected starters for tonight's slate when the
 * scraper has not posted matchups yet.
 * @returns {Promise<{projected: boolean, duels: Array<{away: object, home: object, time: string}>}>}
 */
export async function goalieDuels({ limit = 6, date = todayET() } = {}) {
  const matchups = goalies()?.matchups;
  if (Array.isArray(matchups) && matchups.length) {
    return {
      projected: false,
      duels: matchups.slice(0, limit).map(matchup => ({
        away: { abbr: abbrOf(matchup.away?.team), goalie: matchup.away?.goalie, status: matchup.away?.status },
        home: { abbr: abbrOf(matchup.home?.team), goalie: matchup.home?.goalie, status: matchup.home?.status },
        time: matchup.time || '',
      })),
    };
  }
  const games = await slate(date);
  const slugOf = abbr => BY_ABBR[abbr]?.slug;
  const duels = games
    .slice(0, limit)
    .map(game => ({
      away: { abbr: game.away, goalie: firstGoalie(slugOf(game.away)), status: 'Projected' },
      home: { abbr: game.home, goalie: firstGoalie(slugOf(game.home)), status: 'Projected' },
      time: game.time,
    }))
    .filter(duel => duel.away.goalie || duel.home.goalie);
  return { projected: true, duels };
}

const POSITION_LABEL = { C: 'centers', LW: 'left wings', RW: 'right wings', D: 'defensemen' };

/**
 * Matchup signals for the watch card: prop_sheet.json when the other pipeline
 * has produced it, otherwise team-level goals-against leaders.
 * @returns {Promise<{source: 'props'|'teams'|'none', subtitle: string, rows: Array<{primary: string, secondary: string, value: string, abbr: string}>}>}
 */
export async function watchSignals({ limit = 6, date = todayET() } = {}) {
  const sheet = propSheet();
  const players = Array.isArray(sheet?.players) ? sheet.players : [];
  if (players.length) {
    const scored = players
      .filter(player => player.name && player.team)
      .map(player => ({
        primary: player.name,
        secondary: [player.pos, player.line ? `L${player.line}` : null, player.pp ? `PP${player.pp}` : null, player.opp ? `vs ${player.opp}` : null]
          .filter(Boolean)
          .join(' · '),
        value: (player.flags || [])[0] || (Number.isFinite(player.opp_index) ? `IDX ${player.opp_index}` : ''),
        abbr: String(player.team).toUpperCase(),
        rank: Number.isFinite(player.opp_index) ? -player.opp_index : 0,
      }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);
    if (scored.length) return { source: 'props', subtitle: 'Lineup roles meeting soft matchups', rows: scored };
  }

  const ga = goalsAgainst();
  const games = await slate(date);
  const playing = new Set(games.flatMap(game => [game.away, game.home]));
  const teams = ga?.teams || {};
  const rows = Object.entries(teams)
    .filter(([abbr]) => !playing.size || playing.has(abbr))
    .flatMap(([abbr, stats]) =>
      Object.entries(stats?.l10 || {}).map(([position, goals]) => ({
        primary: nameOfAbbr(abbr),
        secondary: `Goals allowed to ${POSITION_LABEL[position] || position} · last 10`,
        value: String(goals),
        abbr,
        rank: Number(goals) || 0,
      }))
    )
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);
  if (!rows.length) return { source: 'none', subtitle: '', rows: [] };
  return { source: 'teams', subtitle: 'Where tonight’s opponents are leaking goals', rows };
}
