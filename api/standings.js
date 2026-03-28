export default async function handler(req, res) {
  const url = "https://api-web.nhle.com/v1/standings";

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error" });
    }
    const data = await upstream.json();
    const standings = (data.standings || []).map(t => ({
      teamAbbrev: t.teamAbbrev?.default || t.teamAbbrev,
      wins: t.wins,
      losses: t.losses,
      otLosses: t.otLosses,
    }));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(standings);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch standings" });
  }
}
