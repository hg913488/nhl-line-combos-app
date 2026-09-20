import React, { useMemo } from 'react';
import { TEAM_COLORS } from './teams.js';

// NHL event coordinates: x −100…100, y −42.5…42.5, in feet. The API normalizes every
// shot so the home team attacks +x and the away team attacks −x.
const LENGTH = 200;
const WIDTH = 85;
const HALF_LENGTH = LENGTH / 2;
const HALF_WIDTH = WIDTH / 2;
const CORNER = 28;
const GOAL_LINE = 89;
const BLUE_LINE = 25;
const FACEOFF_X = 69;
const FACEOFF_Y = 22;
const NEUTRAL_DOT_X = 20;
const CIRCLE_R = 15;

const RESULT_LABELS = { goal: 'Goal', shot: 'Shot on goal', miss: 'Missed shot', block: 'Blocked shot' };
const DRAW_ORDER = { block: 0, miss: 1, shot: 2, goal: 3 };

// Where the boards sit at a given x, so the goal lines stop at the curve instead of the corner.
function boardY(x) {
  const straight = HALF_LENGTH - CORNER;
  if (Math.abs(x) <= straight) return HALF_WIDTH;
  const dx = Math.abs(x) - straight;
  return HALF_WIDTH - CORNER + Math.sqrt(Math.max(CORNER * CORNER - dx * dx, 0));
}

export function filterShots(shots, filter = {}) {
  const team = filter.team || 'both';
  const period = filter.period || 'all';
  return (Array.isArray(shots) ? shots : []).filter(shot => {
    if (shot.x == null || shot.y == null) return false;
    if (team !== 'both' && shot.side !== team) return false;
    if (period === 'all') return true;
    if (period === 'OT') return shot.periodType === 'OT';
    return String(shot.period) === String(period);
  });
}

function FaceoffCircle({ x, y }) {
  return <g className="rink-faceoff">
    <circle cx={x} cy={y} r={CIRCLE_R} fill="none" />
    <circle cx={x} cy={y} r={1} className="rink-dot" />
  </g>;
}

function GoalEnd({ side }) {
  const x = side * GOAL_LINE;
  const edge = boardY(x);
  return <g>
    <line x1={x} y1={-edge} x2={x} y2={edge} className="rink-goal-line" />
    <path d={`M ${x} -4 A 6 6 0 0 ${side > 0 ? 0 : 1} ${x} 4`} className="rink-crease" />
    <rect x={side > 0 ? x : x - 4} y={-3} width={4} height={6} className="rink-net" />
  </g>;
}

function ShotMark({ shot }) {
  const cx = shot.x;
  const cy = shot.y;
  const className = `shot shot-${shot.type} shot-${shot.side}`;
  if (shot.type === 'goal') {
    return <g className={className}>
      <circle cx={cx} cy={cy} r={4.4} className="shot-halo" />
      <circle cx={cx} cy={cy} r={2.4} className="shot-core" />
    </g>;
  }
  if (shot.type === 'block') {
    return <g className={className}>
      <line x1={cx - 1.5} y1={cy - 1.5} x2={cx + 1.5} y2={cy + 1.5} />
      <line x1={cx - 1.5} y1={cy + 1.5} x2={cx + 1.5} y2={cy - 1.5} />
    </g>;
  }
  return <circle cx={cx} cy={cy} r={1.7} className={className} />;
}

export default function RinkShotMap({ shots, awayAbbr, homeAbbr, filter }) {
  const plotted = useMemo(() => {
    return filterShots(shots, filter).slice().sort((a, b) => DRAW_ORDER[a.type] - DRAW_ORDER[b.type]);
  }, [shots, filter]);

  const counts = plotted.reduce((totals, shot) => {
    const key = `${shot.side}-${shot.type}`;
    return { ...totals, [key]: (totals[key] || 0) + 1 };
  }, {});
  const summaryFor = side => {
    const abbr = side === 'home' ? homeAbbr : awayAbbr;
    return `${abbr}: ${counts[`${side}-goal`] || 0} goals, ${counts[`${side}-shot`] || 0} shots on goal, ${counts[`${side}-miss`] || 0} missed, ${counts[`${side}-block`] || 0} blocked`;
  };
  const label = plotted.length
    ? `Shot map. ${awayAbbr} attacks the left end, ${homeAbbr} attacks the right end. ${summaryFor('away')}. ${summaryFor('home')}.`
    : 'Shot map. No shots to plot yet.';

  const style = {
    '--away-team': TEAM_COLORS[awayAbbr] || '#888888',
    '--home-team': TEAM_COLORS[homeAbbr] || '#888888',
  };

  return <div className="rink-wrap" style={style}>
    <svg className="rink" viewBox={`${-HALF_LENGTH} ${-HALF_WIDTH} ${LENGTH} ${WIDTH}`} role="img" aria-label={label} focusable="false">
      {/* NHL y grows toward the far boards; flip once so every coordinate can be used as published. */}
      <g transform="scale(1, -1)">
        <rect x={-HALF_LENGTH} y={-HALF_WIDTH} width={LENGTH} height={WIDTH} rx={CORNER} ry={CORNER} className="rink-ice" />
        <line x1={0} y1={-HALF_WIDTH} x2={0} y2={HALF_WIDTH} className="rink-center-line" />
        <circle cx={0} cy={0} r={CIRCLE_R} className="rink-center-circle" />
        <circle cx={0} cy={0} r={1} className="rink-dot rink-center-dot" />
        {[-1, 1].map(side => <line key={side} x1={side * BLUE_LINE} y1={-HALF_WIDTH} x2={side * BLUE_LINE} y2={HALF_WIDTH} className="rink-blue-line" />)}
        {[-1, 1].map(side => [-1, 1].map(lane =>
          <FaceoffCircle key={`${side}-${lane}`} x={side * FACEOFF_X} y={lane * FACEOFF_Y} />
        ))}
        {[-1, 1].map(side => [-1, 1].map(lane =>
          <circle key={`n${side}-${lane}`} cx={side * NEUTRAL_DOT_X} cy={lane * FACEOFF_Y} r={1} className="rink-dot" />
        ))}
        {[-1, 1].map(side => <GoalEnd key={side} side={side} />)}
        <rect x={-HALF_LENGTH} y={-HALF_WIDTH} width={LENGTH} height={WIDTH} rx={CORNER} ry={CORNER} className="rink-boards" />
        <g className="rink-shots">
          {plotted.map((shot, index) => <ShotMark key={`${shot.period}-${shot.time}-${shot.team}-${shot.x}-${shot.y}-${index}`} shot={shot} />)}
        </g>
      </g>
    </svg>
    <div className="visually-hidden">
      <table>
        <caption>{label}</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">Time</th><th scope="col">Team</th><th scope="col">Player</th><th scope="col">Result</th><th scope="col">Shot type</th></tr></thead>
        <tbody>
          {plotted.map((shot, index) => <tr key={`row-${index}`}>
            <td>{shot.periodType === 'OT' ? 'OT' : shot.period}</td>
            <td>{shot.time}</td>
            <td>{shot.team}</td>
            <td>{shot.shooter || 'Unknown'}</td>
            <td>{RESULT_LABELS[shot.type] || shot.type}</td>
            <td>{shot.shotType || '—'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
