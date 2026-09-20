// Fonts, the brand mark, and team logos for the share-card renderer.
// Each path is a literal `new URL(..., import.meta.url)`: Vercel's file tracing
// only follows static paths, and a computed one ships a function that cannot
// find its fonts at runtime. vercel.json also force-includes these.
import { readFileSync } from 'node:fs';

const SYNE_EXTRABOLD = readFileSync(new URL('./fonts/Syne-ExtraBold.ttf', import.meta.url));
const GROTESK_REGULAR = readFileSync(new URL('./fonts/SpaceGrotesk-Regular.ttf', import.meta.url));
const GROTESK_BOLD = readFileSync(new URL('./fonts/SpaceGrotesk-Bold.ttf', import.meta.url));
const MONO_REGULAR = readFileSync(new URL('./fonts/SpaceMono-Regular.ttf', import.meta.url));
const MONO_BOLD = readFileSync(new URL('./fonts/SpaceMono-Bold.ttf', import.meta.url));

/** Satori font set: Syne (display), Space Grotesk (body), Space Mono (labels). */
export const SATORI_FONTS = [
  { name: 'Syne', data: SYNE_EXTRABOLD, weight: 800, style: 'normal' },
  { name: 'Space Grotesk', data: GROTESK_REGULAR, weight: 400, style: 'normal' },
  { name: 'Space Grotesk', data: GROTESK_BOLD, weight: 700, style: 'normal' },
  { name: 'Space Mono', data: MONO_REGULAR, weight: 400, style: 'normal' },
  { name: 'Space Mono', data: MONO_BOLD, weight: 700, style: 'normal' },
];

const svgDataUri = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

export const BRAND_MARK = svgDataUri(readFileSync(new URL('../../assets/brand/between-mark-color-dark.svg', import.meta.url), 'utf8'));
export const BRAND_MARK_LIGHT = svgDataUri(readFileSync(new URL('../../assets/brand/between-mark-color.svg', import.meta.url), 'utf8'));
export const brandMark = variant => (variant === 'light' ? BRAND_MARK_LIGHT : BRAND_MARK);

const LOGO_TIMEOUT_MS = 2500;
const logoCache = new Map();

/**
 * Team logo as a data URI, or null when the CDN is unreachable.
 * Cached per warm function instance.
 */
export async function teamLogo(abbr, variant = 'dark') {
  const key = String(abbr || '').toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(key)) return null;
  const cacheKey = `${key}:${variant}`;
  if (logoCache.has(cacheKey)) return logoCache.get(cacheKey);
  try {
    const response = await fetch(`https://assets.nhle.com/logos/nhl/svg/${key}_${variant}.svg`, {
      signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`logo ${key}: ${response.status}`);
    const markup = await response.text();
    // NHL crests share a 3:2 canvas; read it anyway so a square box never
    // squashes the artwork.
    const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(markup);
    const ratio = box ? Number(box[1]) / Number(box[2]) : 1;
    const entry = { src: svgDataUri(markup), ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1 };
    logoCache.set(cacheKey, entry);
    return entry;
  } catch {
    logoCache.set(cacheKey, null);
    return null;
  }
}

/** Fetches several logos at once; missing ones come back as null. */
export async function teamLogos(abbrs, variant = 'dark') {
  const unique = [...new Set(abbrs.map(abbr => String(abbr || '').toUpperCase()))];
  const entries = await Promise.all(unique.map(async abbr => [abbr, await teamLogo(abbr, variant)]));
  return Object.fromEntries(entries);
}

const HEADSHOT_TIMEOUT_MS = 3500;
const rosterCache = new Map();
const headshotCache = new Map();

const normalise = name => String(name || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** name -> headshot URL for one team, from the NHL roster endpoint. */
async function rosterHeadshots(abbr, season) {
  const key = `${abbr}:${season}`;
  if (rosterCache.has(key)) return rosterCache.get(key);
  let map = {};
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/roster/${abbr}/${season}`, {
      signal: AbortSignal.timeout(HEADSHOT_TIMEOUT_MS),
    });
    if (response.ok) {
      const data = await response.json();
      for (const group of ['forwards', 'defensemen', 'goalies']) {
        for (const player of data[group] || []) {
          const full = `${player.firstName?.default || ''} ${player.lastName?.default || ''}`;
          if (player.headshot) map[normalise(full)] = player.headshot;
        }
      }
    }
  } catch {
    map = {};
  }
  rosterCache.set(key, map);
  return map;
}

/**
 * Official NHL headshots (transparent PNG cut-outs) as data URIs, keyed by the
 * player name that was asked for. Missing players come back as null, so a card
 * can fall back to a logo.
 */
export async function playerHeadshots(players, season) {
  const byTeam = new Map();
  for (const { name, abbr } of players) {
    const team = String(abbr || '').toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(team)) continue;
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team).push(name);
  }
  const out = {};
  await Promise.all([...byTeam.entries()].map(async ([team, names]) => {
    const roster = await rosterHeadshots(team, season);
    await Promise.all(names.map(async name => {
      const url = roster[normalise(name)];
      if (!url) { out[name] = null; return; }
      if (headshotCache.has(url)) { out[name] = headshotCache.get(url); return; }
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(HEADSHOT_TIMEOUT_MS) });
        if (!response.ok) throw new Error(String(response.status));
        const buffer = Buffer.from(await response.arrayBuffer());
        const uri = `data:image/png;base64,${buffer.toString('base64')}`;
        headshotCache.set(url, uri);
        out[name] = uri;
      } catch {
        headshotCache.set(url, null);
        out[name] = null;
      }
    }));
  }));
  return out;
}

/**
 * Logo sized to its own aspect ratio. `height` drives the box; width follows,
 * so a crest is never stretched to fit a square.
 */
export function logoImg(entry, height, style = {}) {
  if (!entry?.src) return null;
  return {
    type: 'img',
    props: {
      src: entry.src,
      width: Math.round(height * entry.ratio),
      height,
      style: { flexShrink: 0, ...style },
    },
  };
}
