import React from 'react';
import { POSITIONS, matchupEdges } from './matchup-index.js';
import './board.css';

const SCALE_MAX = 1.9; // a full lane is 1.9× the league rate
const HOT = 1.15; // above this a defence is "soft" against that position
const fmt = value => `${value.toFixed(2)}×`;

function Lane({ side, value, confidence }) {
  const width = Math.min(value / SCALE_MAX, 1) * 100;
  return <div className={`fly-lane fly-${side}`} aria-hidden="true" style={{ '--tick': `${(1 / SCALE_MAX) * 100}%` }}>
    <i className="fly-tick" />
    <div className={`fly-bar${value >= HOT ? ' hot' : ''}`} style={{ '--w': `${width}%`, '--conf': confidence }}><span>{fmt(value)}</span></div>
  </div>;
}

export default function MatchupButterfly({ built, away, home, onOpenBoard, boardLink }) {
  const edges = matchupEdges(built, away, home);
  if (!edges) return null;
  const confidence = Math.max(0.6, Math.min(1, 0.6 + edges.weight * 2));
  const thisSeason = Math.round(edges.weight * 100);
  const { best } = edges;
  return <section className="fly" aria-label={`${away} at ${home}: goals allowed by position against the league rate`}>
    <header className="fly-head">
      <span className="fly-kicker">Edge by position</span>
      <span className="fly-scale">1.00× = league average</span>
    </header>
    <div className="fly-grid">
      <span className="fly-col fly-col-l">{away} skaters<br />vs {home} D</span>
      <span />
      <span className="fly-col fly-col-r">{home} skaters<br />vs {away} D</span>
      {edges.rows.map(row => <React.Fragment key={row.pos}>
        <Lane side="l" value={row.awaySkaters} confidence={confidence} />
        <span className="fly-pos" role="text" aria-label={`${row.pos}: ${away} skaters ${fmt(row.awaySkaters)}, ${home} skaters ${fmt(row.homeSkaters)}`}>{row.pos}</span>
        <Lane side="r" value={row.homeSkaters} confidence={confidence} />
      </React.Fragment>)}
    </div>
    <p className="fly-verdict">Best spot: <strong>{best.team} {best.pos === 'D' ? 'D-men' : `${best.pos}s`}</strong> against <strong>{best.vs}</strong>, <em>{fmt(best.index)}</em> the league rate.</p>
    <div className="fly-foot">
      <span className="fly-meter" style={{ '--p': `${thisSeason}%` }} aria-hidden="true"><i /></span>
      <span>{thisSeason}% this season ({edges.gp[0]} and {edges.gp[1]} GP), the rest is last season. Bars fade while the sample is thin.</span>
    </div>
    {boardLink && <div className="fly-link">{boardLink}</div>}
  </section>;
}
