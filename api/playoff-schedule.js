export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : today;
  const url = `https://api-web.nhle.com/v1/schedule/${date}`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error", games: [] });
    }
    const data = await upstream.json();
    const allGames = data.gameWeek?.[0]?.games || data.games || [];
    const playoffGames = allGames
      .filter(g => g.gameType === 3)
      .map(g => ({
        id: g.id,
        gameDate: g.gameDate || date,
        startTimeUTC: g.startTimeUTC,
        awayTeam: { abbrev: g.awayTeam?.abbrev, score: g.awayTeam?.score ?? null },
        homeTeam: { abbrev: g.homeTeam?.abbrev, score: g.homeTeam?.score ?? null },
        gameState: g.gameState || "FUT",
        period: g.period || null,
        clock: g.clock?.timeRemaining || null,
      }));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ games: playoffGames, date });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch playoff schedule", games: [] });
  }
}
