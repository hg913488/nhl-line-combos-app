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

const LOGO_TIMEOUT_MS = 2500;
const logoCache = new Map();

/**
 * Team logo as a data URI, or null when the CDN is unreachable.
 * Cached per warm function instance.
 */
export async function teamLogo(abbr) {
  const key = String(abbr || '').toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(key)) return null;
  if (logoCache.has(key)) return logoCache.get(key);
  try {
    const response = await fetch(`https://assets.nhle.com/logos/nhl/svg/${key}_dark.svg`, {
      signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`logo ${key}: ${response.status}`);
    const uri = svgDataUri(await response.text());
    logoCache.set(key, uri);
    return uri;
  } catch {
    logoCache.set(key, null);
    return null;
  }
}

/** Fetches several logos at once; missing ones come back as null. */
export async function teamLogos(abbrs) {
  const unique = [...new Set(abbrs.map(abbr => String(abbr || '').toUpperCase()))];
  const entries = await Promise.all(unique.map(async abbr => [abbr, await teamLogo(abbr)]));
  return Object.fromEntries(entries);
}
