import { computeFatigue, restEdge } from '../src/fatigue.js';

const ALTITUDE = new Set(['COL', 'UTA']);

function season(date) {
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0);
  return `${year}${year + 1}`;
}

async function getJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('NHL schedule unavailable');
  return response.json();
}

export default async function fatigueHandler(req, res) {
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Invalid schedule date' });
  }
  try {
    const week = await getJSON(`https://api-web.nhle.com/v1/schedule/${date}`);
    if (!Array.isArray(week.gameWeek)) throw new Error('Invalid schedule');
    const slate = week.gameWeek.find(day => day.date === date)?.games || [];
    const abbrevs = [...new Set(slate.flatMap(game => [game.awayTeam.abbrev, game.homeTeam.abbrev]))];
    const seasons = Object.fromEntries(await Promise.all(abbrevs.map(async abbrev => {
      const data = await getJSON(`https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/${season(date)}`);
      return [abbrev, data.games || []];
    })));
    const games = slate.map(game => {
      const away = computeFatigue(seasons[game.awayTeam.abbrev], date, game.awayTeam.id);
      const home = computeFatigue(seasons[game.homeTeam.abbrev], date, game.homeTeam.id);
      return {
        id: game.id,
        startTimeUTC: game.startTimeUTC,
        away: { abbrev: game.awayTeam.abbrev, ...away, altitude: ALTITUDE.has(game.homeTeam.abbrev) },
        home: { abbrev: game.homeTeam.abbrev, ...home },
        restEdge: restEdge(home, away),
      };
    });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ date, games });
  } catch {
    return res.status(502).json({ error: 'Could not load schedule fatigue. Please try again.' });
  }
}
