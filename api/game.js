// Game detail: trims NHL play-by-play + right-rail into a single scoreboard/shot-map payload.
const GAME_ID = /^\d{10}$/;

const SHOT_EVENTS = {
  'goal': 'goal',
  'shot-on-goal': 'shot',
  'missed-shot': 'miss',
  'blocked-shot': 'block',
};

const LIVE_STATES = new Set(['LIVE', 'CRIT']);
const DONE_STATES = new Set(['FINAL', 'OFF']);

function playerName(spot) {
  return [spot?.firstName?.default, spot?.lastName?.default].filter(Boolean).join(' ');
}

export function rosterIndex(rosterSpots) {
  const names = {};
  const teams = new Map();
  for (const spot of Array.isArray(rosterSpots) ? rosterSpots : []) {
    if (spot?.playerId == null) continue;
    names[spot.playerId] = playerName(spot);
    teams.set(spot.playerId, spot.teamId);
  }
  return { names, teams };
}

// situationCode is 4 digits: away goalie, away skaters, home skaters, home goalie.
export function parseSituation(code) {
  if (!/^\d{4}$/.test(String(code ?? ''))) return null;
  const [awayGoalie, awaySkaters, homeSkaters, homeGoalie] = String(code).split('').map(Number);
  return { awayGoalie, awaySkaters, homeSkaters, homeGoalie };
}

export function goalStrength(code, isHome) {
  const situation = parseSituation(code);
  if (!situation) return null;
  const opponentGoalie = isHome ? situation.awayGoalie : situation.homeGoalie;
  if (situation.awaySkaters <= 1 && situation.homeSkaters <= 1) return 'PS';
  if (!opponentGoalie) return 'EN';
  // Compare total players on the ice, so a pulled goalie reads as even strength rather than a power play.
  const players = situation.homeSkaters + situation.homeGoalie - situation.awaySkaters - situation.awayGoalie;
  const edge = isHome ? players : -players;
  if (edge > 0) return 'PP';
  if (edge < 0) return 'SH';
  return 'EV';
}

export function situationText(code, awayAbbr, homeAbbr) {
  const situation = parseSituation(code);
  if (!situation) return null;
  const { awaySkaters, homeSkaters, awayGoalie, homeGoalie } = situation;
  const parts = [];
  if (awaySkaters === homeSkaters) parts.push(`${awaySkaters}-on-${homeSkaters}`);
  else {
    const advantage = awaySkaters > homeSkaters ? awayAbbr : homeAbbr;
    parts.push(`${Math.max(awaySkaters, homeSkaters)}-on-${Math.min(awaySkaters, homeSkaters)} ${advantage} advantage`);
  }
  if (!awayGoalie) parts.push(`${awayAbbr} net empty`);
  if (!homeGoalie) parts.push(`${homeAbbr} net empty`);
  return parts.join(' · ');
}

// The NHL feed flips ends every period. homeTeamDefendingSide tells us which end the home
// team defends; when it is 'right' the home team attacks -x, so rotate the event 180°
// (negate x and y) to land every home shot on +x and every away shot on -x.
export function defendingSidesByPeriod(plays, homeTeamId) {
  const sides = new Map();
  const drift = new Map();
  for (const play of plays) {
    const period = play?.periodDescriptor?.number;
    if (period == null) continue;
    if (!sides.has(period) && (play.homeTeamDefendingSide === 'left' || play.homeTeamDefendingSide === 'right')) {
      sides.set(period, play.homeTeamDefendingSide);
    }
    // Fallback signal: which end the home team's own shots cluster toward this period.
    if (SHOT_EVENTS[play?.typeDescKey] && Number.isFinite(play?.details?.xCoord) && play?.details?.eventOwnerTeamId === homeTeamId) {
      drift.set(period, (drift.get(period) || 0) + Math.sign(play.details.xCoord));
    }
  }
  for (const [period, total] of drift) {
    if (!sides.has(period)) sides.set(period, total >= 0 ? 'left' : 'right');
  }
  return sides;
}

export function normalizePoint(x, y, side) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: null, y: null };
  return side === 'right' ? { x: -x, y: -y } : { x, y };
}

function teamAbbrFor(teamId, awayTeam, homeTeam) {
  if (teamId === homeTeam.id) return homeTeam.abbrev;
  if (teamId === awayTeam.id) return awayTeam.abbrev;
  return null;
}

function teamBlock(team) {
  return {
    id: team?.id ?? null,
    abbr: team?.abbrev || '',
    name: team?.commonName?.default || '',
    city: team?.placeName?.default || '',
    score: Number.isFinite(team?.score) ? team.score : 0,
    sog: Number.isFinite(team?.sog) ? team.sog : null,
  };
}

function shotsByPeriodFrom(rightRail, shots) {
  const rows = Array.isArray(rightRail?.shotsByPeriod) ? rightRail.shotsByPeriod : null;
  if (rows) {
    return rows
      .filter(row => row?.periodDescriptor?.periodType !== 'SO')
      .map(row => ({
        period: row?.periodDescriptor?.number ?? null,
        periodType: row?.periodDescriptor?.periodType || 'REG',
        away: Number.isFinite(row?.away) ? row.away : 0,
        home: Number.isFinite(row?.home) ? row.home : 0,
      }));
  }
  // Right rail is missing before puck drop and occasionally mid-game; rebuild from the plays.
  const totals = new Map();
  for (const shot of shots) {
    if (shot.type !== 'shot' && shot.type !== 'goal') continue;
    const row = totals.get(shot.period) || { period: shot.period, periodType: shot.periodType, away: 0, home: 0 };
    row[shot.side] += 1;
    totals.set(shot.period, row);
  }
  return [...totals.values()]
    .sort((a, b) => a.period - b.period)
    .map(({ period, periodType, away, home }) => ({ period, periodType, away, home }));
}

function teamStatsFrom(rightRail) {
  const stats = Array.isArray(rightRail?.teamGameStats) ? rightRail.teamGameStats : [];
  return stats
    .filter(stat => stat && typeof stat.category === 'string')
    .map(stat => ({ category: stat.category, away: stat.awayValue ?? null, home: stat.homeValue ?? null }));
}

export function buildGame(pbp, rightRail) {
  const awayTeam = pbp?.awayTeam || {};
  const homeTeam = pbp?.homeTeam || {};
  const plays = Array.isArray(pbp?.plays) ? pbp.plays : [];
  const { names, teams } = rosterIndex(pbp?.rosterSpots);
  const sides = defendingSidesByPeriod(plays, homeTeam.id);
  const state = pbp?.gameState || 'FUT';

  const shots = [];
  const goals = [];
  for (const play of plays) {
    const type = SHOT_EVENTS[play?.typeDescKey];
    // Shootout attempts are not shots on the ice sheet and never count toward SOG.
    if (!type || play?.periodDescriptor?.periodType === 'SO') continue;
    const details = play.details || {};
    const shooterId = details.shootingPlayerId ?? details.scoringPlayerId ?? null;
    const teamId = teams.get(shooterId) ?? details.eventOwnerTeamId;
    const abbr = teamAbbrFor(teamId, awayTeam, homeTeam);
    if (!abbr) continue;
    const period = play.periodDescriptor?.number ?? null;
    const { x, y } = normalizePoint(details.xCoord, details.yCoord, sides.get(period));
    const shot = {
      period,
      periodType: play.periodDescriptor?.periodType || 'REG',
      time: play.timeInPeriod || '',
      team: abbr,
      side: abbr === homeTeam.abbrev ? 'home' : 'away',
      shooter: names[shooterId] || null,
      type,
      shotType: details.shotType || null,
      x,
      y,
    };
    shots.push(shot);
    if (type === 'goal') {
      goals.push({
        period,
        periodType: shot.periodType,
        time: shot.time,
        team: abbr,
        side: shot.side,
        scorer: names[details.scoringPlayerId] || null,
        assists: [details.assist1PlayerId, details.assist2PlayerId]
          .filter(id => id != null)
          .map(id => names[id])
          .filter(Boolean),
        strength: goalStrength(play.situationCode, teamId === homeTeam.id),
        shotType: details.shotType || null,
        awayScore: Number.isFinite(details.awayScore) ? details.awayScore : null,
        homeScore: Number.isFinite(details.homeScore) ? details.homeScore : null,
        x,
        y,
      });
    }
  }

  const lastPlay = plays.length ? plays[plays.length - 1] : null;

  return {
    id: pbp?.id ?? null,
    state,
    gameType: pbp?.gameType ?? null,
    startTimeUTC: pbp?.startTimeUTC || null,
    venue: pbp?.venue?.default || null,
    period: pbp?.periodDescriptor?.number ?? null,
    periodType: pbp?.periodDescriptor?.periodType || null,
    clock: {
      timeRemaining: pbp?.clock?.timeRemaining || null,
      running: Boolean(pbp?.clock?.running),
      inIntermission: Boolean(pbp?.clock?.inIntermission),
    },
    situation: LIVE_STATES.has(state) ? situationText(lastPlay?.situationCode, awayTeam.abbrev, homeTeam.abbrev) : null,
    away: teamBlock(awayTeam),
    home: teamBlock(homeTeam),
    goals,
    shots,
    shotsByPeriod: shotsByPeriodFrom(rightRail, shots),
    teamStats: teamStatsFrom(rightRail),
    rosterNames: names,
  };
}

function cacheHeaderFor(state) {
  if (LIVE_STATES.has(state)) return 's-maxage=15, stale-while-revalidate=30';
  if (DONE_STATES.has(state)) return 's-maxage=3600';
  return 's-maxage=300';
}

export default async function handler(req, res) {
  const id = String(req.query?.id || '');
  if (!GAME_ID.test(id)) {
    return res.status(400).json({ error: 'Invalid game id' });
  }

  try {
    const options = { signal: AbortSignal.timeout(8000) };
    const [pbpResponse, railResponse] = await Promise.all([
      fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`, options),
      fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/right-rail`, options),
    ]);
    if (pbpResponse.status === 404) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (!pbpResponse.ok) {
      return res.status(502).json({ error: 'Game data is temporarily unavailable' });
    }

    const pbp = await pbpResponse.json();
    if (!pbp || typeof pbp !== 'object' || !pbp.awayTeam || !pbp.homeTeam) {
      throw new Error('Invalid NHL play-by-play response');
    }
    // The right rail carries team stats only; a failure there degrades the page instead of breaking it.
    const rightRail = railResponse.ok ? await railResponse.json().catch(() => null) : null;

    const game = buildGame(pbp, rightRail);
    res.setHeader('Cache-Control', cacheHeaderFor(game.state));
    return res.status(200).json(game);
  } catch {
    return res.status(502).json({ error: 'Could not load this game. Please try again.' });
  }
}
