import React from 'react';

const W = 120;
const H = 32;
const PAD = 3;

// Tiny trend line: values oldest -> newest, dashed season average, dot on the latest game.
export default function Sparkline({ values, average, label }) {
  const points = values.filter(value => Number.isFinite(value));
  if (points.length < 2) return null;
  const all = Number.isFinite(average) ? [...points, average] : points;
  const min = Math.min(...all);
  const span = Math.max(...all) - min || 1;
  const x = index => PAD + (index * (W - PAD * 2)) / (points.length - 1);
  const y = value => H - PAD - ((value - min) / span) * (H - PAD * 2);
  const path = points.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const last = points.length - 1;

  return <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
    {Number.isFinite(average) && <line x1={PAD} x2={W - PAD} y1={y(average)} y2={y(average)} className="sparkline-average" />}
    <path d={path} className="sparkline-path" />
    <circle cx={x(last)} cy={y(points[last])} r="2.6" className="sparkline-dot" />
  </svg>;
}
