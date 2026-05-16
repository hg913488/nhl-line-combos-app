export default async function handler(req, res) {
  const season = /^\d{8}$/.test(req.query.season || "") ? req.query.season : "20252026";
  const url = `https://api-web.nhle.com/v1/playoff-bracket/${season}`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error" });
    }
    const data = await upstream.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch playoff bracket" });
  }
}
