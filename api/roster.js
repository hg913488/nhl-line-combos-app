import { validSeason } from './gamelog.js';

export default async function handler(req, res) {
  const { team, season } = req.query;
  if (!/^[A-Z]{3}$/.test(team || "") || !validSeason(season || "")) {
    return res.status(400).json({ error: "Invalid team or season" });
  }
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/roster/${team}/${season}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return res.status(502).json({ error: "Roster unavailable" });
    const data = await response.json();
    if (!Array.isArray(data.forwards) || !Array.isArray(data.goalies)) throw new Error("Invalid roster");
    const players = [...data.forwards, ...(data.defensemen || []), ...data.goalies].map(p => ({
      id: String(p.id), firstName: p.firstName.default, lastName: p.lastName.default,
      number: p.sweaterNumber, pos: p.positionCode, team,
    }));
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=3600");
    return res.status(200).json({ players, team, season });
  } catch {
    return res.status(502).json({ error: "Roster unavailable" });
  }
}
