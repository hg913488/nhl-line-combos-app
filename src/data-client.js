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

// 'F', 'D' or 'G' from a position code (C, L, R, LW, RW, LD, RD, D, G) or lineup slot.
export function positionGroup(pos) {
  const code = String(pos || '').toUpperCase();
  if (['G', 'STR', 'BKP'].includes(code)) return 'G';
  if (['D', 'LD', 'RD'].includes(code)) return 'D';
  return ['C', 'L', 'R', 'LW', 'RW', 'F'].includes(code) ? 'F' : null;
}

// "Elias Nils Pettersson" -> "eliaspettersson": lineup sources sometimes carry middle names.
export const firstAndLast = name => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? normalizeName(`${parts[0]} ${parts[parts.length - 1]}`) : null;
};

// Narrow same-name candidates by team, then position group, then active status. Never guesses.
export function pickPlayer(players, name, hints = {}) {
  const full = p => normalizeName(`${p.firstName} ${p.lastName}`);
  let matches = players.filter(p => full(p) === normalizeName(name));
  if (!matches.length && firstAndLast(name)) matches = players.filter(p => full(p) === firstAndLast(name));
  const narrow = test => { const kept = matches.filter(test); if (kept.length) matches = kept; };
  if (matches.length > 1 && hints.team) narrow(p => p.team === hints.team);
  if (matches.length > 1 && positionGroup(hints.pos)) narrow(p => positionGroup(p.pos) === positionGroup(hints.pos));
  if (matches.length > 1) narrow(p => p.active);
  return matches.length === 1 ? matches[0] : null;
}

export async function resolvePlayer(name, hints = {}) {
  const response = await getJSON(`/api/player-search?q=${encodeURIComponent(name)}`);
  let player = Array.isArray(response.players) ? pickPlayer(response.players, name, hints) : null;
  if (!player && firstAndLast(name)) {
    // The search may not return anyone for the middle-name spelling; retry with first + last.
    const parts = name.trim().split(/\s+/);
    const retry = await getJSON(`/api/player-search?q=${encodeURIComponent(`${parts[0]} ${parts[parts.length - 1]}`)}`);
    player = Array.isArray(retry.players) ? pickPlayer(retry.players, name, hints) : null;
  }
  if (!player) throw new Error('Could not uniquely identify this player. Try player search.');
  return player;
}

// Every clock time on the site reads in Eastern, whatever the viewer's zone is.
export function formatET(value, withDate = false) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const opts = { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' };
  if (withDate) Object.assign(opts, { month: 'short', day: 'numeric' });
  return `${date.toLocaleString('en-US', opts)} ET`;
}
