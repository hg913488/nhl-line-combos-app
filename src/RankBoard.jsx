import React, { useEffect, useMemo, useRef, useState } from 'react';
import { POSITIONS, ALL } from './matchup-index.js';
import { swarm } from './board-layout.js';
import './board.css';

const STATS = [['C', 'Centers'], ['LW', 'Left wings'], ['RW', 'Right wings'], ['D', 'Defense'], [ALL, 'All skaters']];
const MIN_HEIGHT = 170;
const fmt = value => `${value.toFixed(2)}×`;
const ordinal = n => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10 < 4 ? n % 10 : 0]}`;
const verdict = rank => (rank <= 8 ? 'soft' : rank >= 25 ? 'stingy' : 'middle');

export default function RankBoard({ built, games, renderLogo }) {
  const [stat, setStat] = useState('C');
  const [selected, setSelected] = useState(null);
  const [width, setWidth] = useState(0);
  const axisRef = useRef(null);
  const tonight = useMemo(() => new Set(games.flatMap(game => [game.away, game.home])), [games]);

  useEffect(() => {
    const el = axisRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const abbrs = Object.keys(built.teams);
  const values = abbrs.map(abbr => built.teams[abbr].index[stat]);
  const lo = Math.min(...values), hi = Math.max(...values);
  const placed = useMemo(() => (width ? swarm(abbrs.map(abbr => ({ id: abbr, value: built.teams[abbr].index[stat], radius: tonight.has(abbr) ? 14 : 11 })), { width }) : []),
    [width, stat, built, tonight]); // eslint-disable-line react-hooks/exhaustive-deps
  const extent = placed.reduce((m, p) => Math.max(m, Math.abs(p.y) + p.radius), 0);
  const height = Math.max(MIN_HEIGHT, Math.ceil(extent * 2 + 40));
  const midX = 18 + ((1 - lo) / (hi - lo || 1)) * Math.max(0, width - 36);
  const pick = selected && built.teams[selected] ? selected : null;
  const tag = pick && placed.find(p => p.id === pick);
  const ranked = [...abbrs].sort((a, b) => built.teams[a].rank[stat] - built.teams[b].rank[stat]);

  return <section className="rb" aria-label="Goals allowed, all 32 teams on one line">
    <p className="rb-kicker">The board · all 32 teams, one line</p>
    <div className="rb-chips" role="group" aria-label="Position">
      {STATS.map(([key, label]) => <button key={key} type="button" className="rb-chip" aria-pressed={stat === key} onClick={() => setStat(key)}>{label}</button>)}
    </div>
    <div className="rb-axis" ref={axisRef} style={{ height }}>
      <i className="rb-line" />
      {width > 0 && <>
        <i className="rb-mid" style={{ left: midX }} />
        <span className="rb-mid-label" style={{ left: midX }}>league avg</span>
        {placed.map(p => <button key={p.id} type="button" className={`rb-dot${tonight.has(p.id) ? ' tonight' : ''}${pick === p.id ? ' picked' : ''}`}
          style={{ transform: `translate(${p.x}px, ${height / 2 + p.y}px)` }} aria-label={`${p.id}, ${fmt(built.teams[p.id].index[stat])}, ${ordinal(built.teams[p.id].rank[stat])} most generous`}
          onClick={() => setSelected(pick === p.id ? null : p.id)}>{renderLogo(p.id, tonight.has(p.id) ? 18 : 15)}</button>)}
        {tag && <span className="rb-tag" style={{ transform: `translate(${Math.min(Math.max(tag.x, 36), width - 36)}px, ${height / 2 + tag.y - tag.radius - 26}px)` }}>{tag.id} · {fmt(built.teams[tag.id].index[stat])}</span>}
      </>}
    </div>
    <div className="rb-ends" aria-hidden="true"><span>← Stingy</span><span>Soft →</span></div>
    {games.length > 0 && <ul className="rb-tonight" aria-label="Tonight">
      {games.map(game => <li key={`${game.away}-${game.home}`}>
        {[game.away, game.home].map(abbr => {
          const team = built.teams[abbr];
          if (!team) return <span key={abbr} className="rb-team"><b>{abbr}</b></span>;
          return <span key={abbr} className={`rb-team${team.rank[stat] <= 8 ? ' soft' : ''}`}>
            <b>{abbr}</b><em>{verdict(team.rank[stat])} · {ordinal(team.rank[stat])}</em><strong>{fmt(team.index[stat])}</strong>
          </span>;
        })}
      </li>)}
    </ul>}
    <p className="rb-note">Goals allowed per game ÷ league average. This season is blended with last season by games played, so early weeks don’t swing on one result.</p>
    <ol className="sr-only" aria-label="All teams, most generous first">
      {ranked.map(abbr => <li key={abbr}>{abbr}: {fmt(built.teams[abbr].index[stat])}</li>)}
    </ol>
  </section>;
}
