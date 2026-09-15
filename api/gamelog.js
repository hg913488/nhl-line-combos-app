export function currentSeason(date = new Date()) {
  const year = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0);
  return `${year}${year + 1}`;
}

export function validSeason(value) {
  return typeof value === 'string' && /^\d{8}$/.test(value) && Number(value.slice(4)) === Number(value.slice(0, 4)) + 1;
}

export function normalizeGame(g) {
  const [minutes, seconds] = (g.toi || "0:00").split(":").map(Number);
  return {
    ...g,
    homeRoad: g.homeRoadFlag,
    opponentTeamAbbrev: g.opponentAbbrev,
    timeOnIcePerGame: minutes * 60 + seconds,
    saves: g.shotsAgainst == null || g.goalsAgainst == null ? null : g.shotsAgainst - g.goalsAgainst,
  };
}

export default async function handler(req, res) {
  const { playerId, gameType = "2", season = currentSeason() } = req.query;
  if (!/^\d+$/.test(playerId || "") || !validSeason(season) || !["2", "3"].includes(gameType)) {
    return res.status(400).json({ error: "Invalid player, season, or game type" });
  }
  try {
    const upstream = await fetch(`https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/${gameType}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return res.status(502).json({ error: "Player statistics are temporarily unavailable" });
    const body = await upstream.json();
    if (!Array.isArray(body.gameLog)) throw new Error("Invalid game log response");
    const games = body.gameLog.map(normalizeGame).sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ data: games, seasonId: season, gameTypeId: Number(gameType) });
  } catch {
    return res.status(502).json({ error: "Could not load player statistics. Please try again." });
  }
}
