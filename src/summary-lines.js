// One-line summaries shown on collapsed sections; the full detail sits behind the toggle.

export const edgeUnit = unit => unit === 'percent' ? '%' : unit === 'bursts' ? '' : ` ${unit}`;

const signed = value => (value == null ? null : `${value > 0 ? '+' : ''}${value}`);

/** @param {{ momentum?: object, role?: { slot?: string, pp?: string } | null }} input */
export function momentumLine({ momentum, role } = {}) {
  const parts = [];
  const points = momentum?.summaries?.last5?.perGame?.points;
  if (points != null) {
    const change = signed(momentum?.summaries?.last5?.versusSeason?.pointsPerGame);
    parts.push(`${points} P/GP${change ? ` (${change})` : ''}`);
  }
  const label = momentum?.labels?.[0]?.label;
  if (label) parts.push(label);
  const slot = [role?.slot, role?.pp].filter(Boolean).join(' · ');
  if (slot) parts.push(slot);
  return parts.join(' · ') || 'Last 5 vs season';
}

/** @param {[string, { value?: unknown, unit?: string } | undefined][]} metrics */
export function edgeLine(metrics = [], limit = 2) {
  const parts = metrics
    .filter(([, metric]) => metric?.value != null)
    .slice(0, limit)
    .map(([label, metric]) => `${label} ${metric.value}${edgeUnit(metric.unit)}`);
  return parts.join(' · ') || 'Player tracking';
}
