// Which finished games get an Instagram recap, and when the night's
// final-scores roundup is due. Pure functions: no network, no log writes.
//
// Slots are claimed in the order games finish and never re-ranked. Re-ranking
// the night's "best N" on every run let a later run choose different games than
// an earlier one and post extra recaps for the same night.

import { formatDay, scoreboardHook } from '../../lib/captions/hooks.js';

export const isFinal = game => ['FINAL', 'OFF'].includes(game.gameState);
export const goalsIn = game => (game.homeTeam?.score ?? 0) + (game.awayTeam?.score ?? 0);
export const marginIn = game => Math.abs((game.homeTeam?.score ?? 0) - (game.awayTeam?.score ?? 0));
// OT and shootout games are as close as a game can finish.
export const wentPast60 = game => Boolean(game.gameOutcome?.lastPeriodType && game.gameOutcome.lastPeriodType !== 'REG');

export const DEFAULT_SLOTS = 4;
export const SCORES_PER_SLIDE = 8;

export function recapSlots(value = process.env.IG_RECAP_SLOTS) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_SLOTS;
}

/**
 * Is this finished game worth its own four-slide recap? The last slot is held
 * back for a game nobody would argue with: overtime, a shootout, or a track meet.
 */
export function qualifies(game, used, slots = DEFAULT_SLOTS) {
  if (used >= slots) return false;
  const standout = wentPast60(game) || goalsIn(game) >= 9;
  if (used === slots - 1) return standout;
  return standout || marginIn(game) <= 1 || goalsIn(game) >= 7 || marginIn(game) >= 4;
}

/**
 * The games to recap right now. `recapped` holds ids already posted; `used` is
 * how many recaps that night's log already carries (so a rerun cannot claim a
 * second batch of slots).
 */
export function claimRecaps({ games, recapped = new Set(), used = 0, slots = DEFAULT_SLOTS }) {
  const claimed = [];
  const finished = games
    .filter(isFinal)
    .sort((a, b) => String(a.startTimeUTC).localeCompare(String(b.startTimeUTC)) || a.id - b.id);
  for (const game of finished) {
    if (recapped.has(String(game.id))) continue;
    if (qualifies(game, used + claimed.length, slots)) claimed.push(game);
  }
  return claimed;
}

export const shiftDate = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const etParts = (now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
};

/**
 * The roundup posts once every game of the night is final, or at 9 AM ET the
 * next morning for whatever finished (a postponed game would otherwise hold it
 * back forever). `games` is the night's full list, finished or not.
 */
export function scoreboardDue({ games, date, now = new Date() }) {
  const finished = games.filter(isFinal);
  if (!finished.length) return false;
  if (finished.length === games.length) return true;
  const next = shiftDate(date, 1);
  const { day, hour } = etParts(now);
  return day > next || (day === next && hour >= 9);
}

export function scoreboardPages(count) {
  return Math.max(1, Math.ceil(count / SCORES_PER_SLIDE));
}

const resultLine = game => {
  const home = game.homeTeam;
  const away = game.awayTeam;
  const [winner, loser] = (home.score ?? 0) > (away.score ?? 0) ? [home, away] : [away, home];
  const extra = wentPast60(game) ? ` (${game.gameOutcome.lastPeriodType})` : '';
  return `${winner.abbrev} ${winner.score ?? 0}, ${loser.abbrev} ${loser.score ?? 0}${extra}`;
};

export function scoreboardCaption(games, date, siteLabel) {
  const when = formatDay(date);
  const finished = games.filter(isFinal);
  const tags = [...new Set(finished.flatMap(game => [game.awayTeam.abbrev, game.homeTeam.abbrev]))].slice(0, 12).map(abbr => `#${abbr}`).join(' ');
  return [
    `${when}: ${finished.length} ${finished.length === 1 ? 'final' : 'finals'} from around the league.`,
    ...(scoreboardHook(finished, date) ? [scoreboardHook(finished, date)] : []),
    finished.slice(0, 16).map(resultLine).join(' · '),
    '',
    'Goals, shots and the numbers behind every game.',
    siteLabel,
    '',
    `#NHL #hockey #NHLscores ${tags}`.trim(),
  ].join('\n');
}
