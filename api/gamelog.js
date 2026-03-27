export default async function handler(req, res) {
  const { playerId } = req.query;

  if (!playerId || !/^\d+$/.test(playerId)) {
    return res.status(400).json({ error: "Invalid playerId" });
  }

  const sort = encodeURIComponent(JSON.stringify([{ property: "gameDate", direction: "DESC" }]));
  const exp = encodeURIComponent(`playerId=${playerId} and seasonId=20252026 and gameTypeId=2`);
  const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=true&limit=5&sort=${sort}&cayenneExp=${exp}`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error" });
    }
    const data = await upstream.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch game log" });
  }
}
