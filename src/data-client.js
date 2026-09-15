const cache = new Map();
const pending = new Map();

export const normalizeName = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
export const seasonLabel = season => `${String(season).slice(0, 4)}-${String(season).slice(6)}`;
export function seasonForDate(date = new Date()) {
  const year = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0);
  return `${year}${year + 1}`;
}
export function seasonsFrom(current = seasonForDate(), count = 4) {
  return Array.from({ length: count }, (_, i) => `${Number(current.slice(0, 4)) - i}${Number(current.slice(4)) - i}`);
}

export async function getJSON(url, ttl = 300000) {
  const hit = cache.get(url);
  if (hit && Date.now() < hit.expires) return hit.value;
  if (pending.has(url)) return pending.get(url);
  const request = (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Data is temporarily unavailable. Please try again.');
    cache.set(url, { value: data, expires: Date.now() + ttl });
    return data;
  })().finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}

export async function resolvePlayer(name) {
  const results = await getJSON(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=10&q=${encodeURIComponent(name)}`);
  const exact = Array.isArray(results) && results.filter(p => normalizeName(p.name) === normalizeName(name));
  if (!exact || exact.length !== 1) throw new Error('Could not uniquely identify this player. Try player search.');
  const p = exact[0];
  const parts = p.name.split(' ');
  return { id: String(p.playerId), firstName: parts.shift(), lastName: parts.join(' '), pos: p.positionCode, team: p.teamAbbrev };
}
