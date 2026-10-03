// Dot-swarm placement for The Board: every team sits at its x (the index), and collisions are
// resolved by nudging up/down in alternating steps. Deterministic, so re-sorting animates cleanly.

/**
 * @param {{ id: string, value: number, radius: number }[]} items
 * @param {{ width: number, pad?: number, gap?: number, step?: number, min?: number, max?: number }} options
 * @returns {{ id: string, x: number, y: number, radius: number }[]} y is an offset from the axis
 */
export function swarm(items, { width, pad = 18, gap = 1, step = 13, min, max }) {
  if (!items.length) return [];
  const lo = min ?? Math.min(...items.map(item => item.value));
  const hi = max ?? Math.max(...items.map(item => item.value));
  const span = hi - lo || 1;
  const x = value => pad + ((value - lo) / span) * Math.max(0, width - pad * 2);
  const placed = [];
  [...items].sort((a, b) => a.value - b.value || a.id.localeCompare(b.id)).forEach(item => {
    const px = x(item.value);
    let k = 0;
    let y = 0;
    while (placed.some(p => Math.hypot(p.x - px, p.y - y) < p.radius + item.radius + gap)) {
      k += 1;
      y = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
    }
    placed.push({ id: item.id, x: px, y, radius: item.radius });
  });
  return placed;
}

export const scaleX = (value, lo, hi, width, pad = 18) => pad + ((value - lo) / (hi - lo || 1)) * Math.max(0, width - pad * 2);
