import { currentSeason, validSeason } from './gamelog.js';

const GAME_TYPES = new Set(['2', '3']);
const RECENT_GAME_LIMIT = 10;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function parseToi(value) {
  if (typeof value !== 'string' || !/^\d+:\d{2}$/.test(value)) return null;
  const [minutes, seconds] = value.split(':').map(Number);
  if (seconds > 59) return null;
  return minutes * 60 + seconds;
}

function formatToi(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

// Share as a percentage with one decimal, or null when there is nothing to divide by.
function percent(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function gameDateValue(game) {
  const timestamp = Date.parse(game?.gameDate || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortGames(games) {
  return [...games].sort((a, b) =>
    gameDateValue(b) - gameDateValue(a) || finiteNumber(b?.gameId) - finiteNumber(a?.gameId)
  );
}

export function summarizeGames(games, seasonSummary = null) {
  const totals = games.reduce((summary, game) => {
    summary.goals += finiteNumber(game?.goals);
    summary.assists += finiteNumber(game?.assists);
    summary.points += game?.points == null
      ? finiteNumber(game?.goals) + finiteNumber(game?.assists)
      : finiteNumber(game.points);
    summary.shots += finiteNumber(game?.shots);
    summary.powerPlayGoals += finiteNumber(game?.powerPlayGoals);
    summary.powerPlayPoints += finiteNumber(game?.powerPlayPoints);
    const toi = parseToi(game?.toi);
    if (toi != null) {
      summary.toiSeconds += toi;
      summary.toiGames += 1;
    }
    return summary;
  }, { goals: 0, assists: 0, points: 0, shots: 0, powerPlayGoals: 0, powerPlayPoints: 0, toiSeconds: 0, toiGames: 0 });

  const gameCount = games.length;
  const perGame = {
    goals: gameCount ? rounded(totals.goals / gameCount) : null,
    assists: gameCount ? rounded(totals.assists / gameCount) : null,
    points: gameCount ? rounded(totals.points / gameCount) : null,
    shots: gameCount ? rounded(totals.shots / gameCount) : null,
  };
  const averageToiSeconds = totals.toiGames ? Math.round(totals.toiSeconds / totals.toiGames) : null;
  const summary = {
    games: gameCount,
    goals: totals.goals,
    assists: totals.assists,
    points: totals.points,
    shots: totals.shots,
    powerPlayGoals: totals.powerPlayGoals,
    powerPlayPoints: totals.powerPlayPoints,
    shootingPct: percent(totals.goals, totals.shots),
    averageToi: formatToi(averageToiSeconds),
    averageToiSeconds,
    perGame,
  };

  if (seasonSummary) {
    summary.versusSeason = {
      goalsPerGame: perGame.goals == null ? null : rounded(perGame.goals - seasonSummary.perGame.goals),
      assistsPerGame: perGame.assists == null ? null : rounded(perGame.assists - seasonSummary.perGame.assists),
      pointsPerGame: perGame.points == null ? null : rounded(perGame.points - seasonSummary.perGame.points),
      shotsPerGame: perGame.shots == null ? null : rounded(perGame.shots - seasonSummary.perGame.shots),
      averageToiSeconds: averageToiSeconds == null || seasonSummary.averageToiSeconds == null
        ? null
        : averageToiSeconds - seasonSummary.averageToiSeconds,
    };
  }

  return summary;
}

function consecutiveGames(games, predicate) {
  let count = 0;
  for (const game of games) {
    if (!predicate(game)) break;
    count += 1;
  }
  return count;
}

export function buildLabels(games, season, last5) {
  if (!games.length) {
    return [{ type: 'no-games', label: 'No games recorded for this season', sampleSize: 0 }];
  }

  const labels = [];
  const pointStreak = consecutiveGames(games, game =>
    finiteNumber(game?.points) || finiteNumber(game?.goals) + finiteNumber(game?.assists)
  );
  const goalStreak = consecutiveGames(games, game => finiteNumber(game?.goals) > 0);
  const pointDrought = consecutiveGames(games, game =>
    !(finiteNumber(game?.points) || finiteNumber(game?.goals) + finiteNumber(game?.assists))
  );
  const goalDrought = consecutiveGames(games, game => !finiteNumber(game?.goals));
  if (pointStreak >= 2) labels.push({ type: 'point-streak', label: `${pointStreak}-game point streak`, sampleSize: pointStreak });
  if (goalStreak >= 2) labels.push({ type: 'goal-streak', label: `${goalStreak}-game goal streak`, sampleSize: goalStreak });
  // Droughts are plain counts, so they show even before the trend sample is big enough.
  if (pointDrought >= 3) labels.push({ type: 'point-drought', label: `No points in ${pointDrought} games`, sampleSize: pointDrought });
  else if (goalDrought >= 5) labels.push({ type: 'goal-drought', label: `No goals in ${goalDrought} games`, sampleSize: goalDrought });

  if (season.games < 10 || last5.games < 5) {
    labels.push({
      type: 'small-sample',
      label: 'Early sample; trend comparisons withheld',
      sampleSize: last5.games,
    });
    return labels;
  }

  const comparison = last5.versusSeason;
  if (comparison.pointsPerGame >= 0.3) labels.push({ type: 'points-up', label: 'Points pace up over last 5', sampleSize: 5 });
  if (comparison.pointsPerGame <= -0.3) labels.push({ type: 'points-down', label: 'Points pace down over last 5', sampleSize: 5 });
  if (comparison.shotsPerGame >= 0.75) labels.push({ type: 'shots-up', label: 'Shot volume up over last 5', sampleSize: 5 });
  if (comparison.shotsPerGame <= -0.75) labels.push({ type: 'shots-down', label: 'Shot volume down over last 5', sampleSize: 5 });
  if (comparison.averageToiSeconds >= 60) labels.push({ type: 'toi-up', label: 'Ice time up over last 5', sampleSize: 5 });
  if (comparison.averageToiSeconds <= -60) labels.push({ type: 'toi-down', label: 'Ice time down over last 5', sampleSize: 5 });
  return labels;
}

// Shooting luck and power-play reliance, from data the handler already fetched.
export function buildContext(seasonSummary, last5, last10, landing) {
  const careerTotals = landing?.careerTotals?.regularSeason;
  const careerShooting = number(careerTotals?.shootingPctg);
  const career = careerTotals ? {
    games: finiteNumber(careerTotals.gamesPlayed),
    shootingPct: careerShooting == null ? null : Math.round(careerShooting * 1000) / 10,
    pointsPerGame: careerTotals.gamesPlayed ? rounded(finiteNumber(careerTotals.points) / careerTotals.gamesPlayed) : null,
  } : null;
  return {
    career,
    shooting: {
      season: seasonSummary.shootingPct,
      last10: last10.shootingPct,
      career: career?.shootingPct ?? null,
      delta: seasonSummary.shootingPct == null || career?.shootingPct == null
        ? null
        : Math.round((seasonSummary.shootingPct - career.shootingPct) * 10) / 10,
    },
    powerPlay: {
      seasonPoints: seasonSummary.powerPlayPoints,
      seasonShare: percent(seasonSummary.powerPlayPoints, seasonSummary.points),
      last5Points: last5.powerPlayPoints,
    },
  };
}

function number(value) {
  const parsed = Number(value);
  return value != null && value !== '' && Number.isFinite(parsed) ? parsed : null;
}

function normalizePlayer(landing, playerId) {
  const firstName = landing?.firstName?.default || '';
  const lastName = landing?.lastName?.default || '';
  return {
    id: String(playerId),
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    team: landing?.currentTeamAbbrev || '',
    position: landing?.position || '',
    sweaterNumber: landing?.sweaterNumber ?? null,
    headshot: landing?.headshot || null,
  };
}

export default async function handler(req, res) {
  const playerId = String(req.query?.playerId || '');
  const season = String(req.query?.season || currentSeason());
  const gameType = String(req.query?.gameType || '2');
  if (!/^\d{1,10}$/.test(playerId) || Number(playerId) < 1 || !validSeason(season) || !GAME_TYPES.has(gameType)) {
    return res.status(400).json({ error: 'Invalid player, season, or game type' });
  }

  try {
    const options = { signal: AbortSignal.timeout(12000) };
    const [landingResponse, logResponse] = await Promise.all([
      fetch(`https://api-web.nhle.com/v1/player/${playerId}/landing`, options),
      fetch(`https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/${gameType}`, options),
    ]);
    if (!landingResponse.ok || !logResponse.ok) {
      return res.status(502).json({ error: 'Player momentum is temporarily unavailable' });
    }

    const [landing, log] = await Promise.all([landingResponse.json(), logResponse.json()]);
    if (!landing || typeof landing !== 'object' || !Array.isArray(log?.gameLog)) {
      throw new Error('Invalid NHL player response');
    }

    const games = sortGames(log.gameLog);
    const seasonSummary = summarizeGames(games);
    const last5 = summarizeGames(games.slice(0, 5), seasonSummary);
    const last10 = summarizeGames(games.slice(0, 10), seasonSummary);
    const labels = buildLabels(games, seasonSummary, last5);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({
      player: normalizePlayer(landing, playerId),
      season,
      gameType: Number(gameType),
      summaries: { season: seasonSummary, last5, last10 },
      labels,
      ...buildContext(seasonSummary, last5, last10, landing),
      recentGames: games.slice(0, RECENT_GAME_LIMIT),
    });
  } catch {
    return res.status(502).json({ error: 'Could not load player momentum. Please try again.' });
  }
}
