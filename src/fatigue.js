// Rest and travel load for one team on one night. Pure (no DOM, no fetch) so it can be unit tested.
// `games` is a club-schedule-season `games` array: gameDate, gameType, homeTeam.id, awayTeam.id,
// venue.default, venueUTCOffset ("-04:00").

const DAY = 86400000;
const dayNumber = date => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);

function utcOffsetHours(game) {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(game?.venueUTCOffset || '');
  if (!match) return null;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) + Number(match[3]) / 60);
}

// Counts the run of games at the end of `list` that were played at home (or away).
function trailingRun(list, teamId, home) {
  let run = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if ((list[i].homeTeam.id === teamId) !== home) break;
    run += 1;
  }
  return run;
}

export function computeFatigue(games, date, teamId) {
  const tonight = games.find(game => game.gameDate === date);
  if (!tonight) return null;
  const today = dayNumber(date);
  const atHome = tonight.homeTeam.id === teamId;
  // Preseason and regular-season rest are not comparable, so only look at the same kind of game.
  const prior = games
    .filter(game => game.gameType === tonight.gameType && game.gameDate < date)
    .sort((a, b) => (a.gameDate < b.gameDate ? -1 : 1));
  const last = prior[prior.length - 1] || null;
  const restDays = last ? today - dayNumber(last.gameDate) - 1 : null;

  const inWindow = days => prior.filter(game => today - dayNumber(game.gameDate) <= days).length;
  const gamesInFour = inWindow(3) + 1; // tonight counts as one of the four nights
  const gamesInSeven = inWindow(6) + 1;

  const lastOffset = utcOffsetHours(last);
  const tonightOffset = utcOffsetHours(tonight);
  // Positive = flew east since the last game, negative = flew west.
  const tzShift = lastOffset == null || tonightOffset == null ? 0 : tonightOffset - lastOffset;

  const roadRun = trailingRun(prior, teamId, false);
  const homeRun = trailingRun(prior, teamId, true);

  return {
    atHome,
    restDays,
    backToBack: restDays === 0,
    backToBackLastHome: restDays === 0 ? last.homeTeam.id === teamId : null,
    gamesInFour,
    threeInFour: gamesInFour >= 3,
    gamesInSeven,
    roadTripGame: atHome ? 0 : roadRun + 1,
    homeStandGame: atHome ? homeRun + 1 : 0,
    tzShift,
    venue: tonight.venue?.default || '',
  };
}

// Rest-day gap for a matchup: positive means the home team is the fresher one.
export function restEdge(home, away) {
  if (home?.restDays == null || away?.restDays == null) return null;
  return Math.min(home.restDays, 4) - Math.min(away.restDays, 4);
}

// Short chips for the UI, most important first.
export function fatigueFlags(f) {
  if (!f) return [];
  const flags = [];
  if (f.backToBack) flags.push({ key: 'b2b', label: 'Back-to-back', short: 'B2B', tired: true });
  else if (f.threeInFour) flags.push({ key: '3in4', label: '3 games in 4 nights', short: '3 IN 4', tired: true });
  if (f.backToBack && f.threeInFour) flags.push({ key: '3in4', label: '3 games in 4 nights', short: '3 IN 4', tired: true });
  if (f.roadTripGame >= 3) flags.push({ key: 'road', label: `Road game ${f.roadTripGame} in a row`, short: `ROAD ${f.roadTripGame}`, tired: f.roadTripGame >= 4 });
  if (Math.abs(f.tzShift) >= 2) flags.push({ key: 'tz', label: `${Math.abs(f.tzShift)} time zones ${f.tzShift > 0 ? 'east' : 'west'}`, short: `${f.tzShift > 0 ? '+' : '-'}${Math.abs(f.tzShift)} TZ`, tired: true });
  if (f.restDays != null && f.restDays >= 3) flags.push({ key: 'rest', label: `${f.restDays} days rest`, short: `${f.restDays}D REST`, tired: false });
  return flags;
}
