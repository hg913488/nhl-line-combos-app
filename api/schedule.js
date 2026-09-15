export default async function handler(req, res) {
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Invalid schedule date' });
  }
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return res.status(502).json({ error: 'Schedule is temporarily unavailable' });
    const data = await response.json();
    if (!Array.isArray(data.gameWeek)) throw new Error('Invalid schedule');
    const games = data.gameWeek.find(day => day.date === date)?.games || [];
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ games, date });
  } catch {
    return res.status(502).json({ error: 'Could not load the schedule. Please try again.' });
  }
}
