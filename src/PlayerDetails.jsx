import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCw, Info } from 'lucide-react';
import { getJSON, resolvePlayer, seasonLabel, seasonsFrom } from './data-client.js';
import Select from './Select.jsx';
import JerseyIcon, { HOME_UNIFORMS } from './JerseyIcon.jsx';

const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const number = value => value == null ? '-' : value;
const edgeUnit = unit => unit === 'percent' ? '%' : unit === 'bursts' ? '' : ` ${unit}`;
const EDGE_INFO = {
  'Top shot': 'His hardest shot this season, clocked by the chip inside the puck.',
  'Top speed': 'The fastest he has skated at any moment this season, from the tracking chip in his jersey.',
  '32+ km/h bursts': 'How many times this season he hit 32 km/h (20 mph) or faster. It counts separate sprints, not time at speed, so it shows how often he goes all out.',
  'O-zone time': "The share of his ice time spent in the offensive zone, the opponent's end. Higher usually means his line keeps the puck and drives play.",
};

export default function PlayerDetails({ modal, onClose }) {
  const [season, setSeason] = useState(modal.season);
  const [gameType, setGameType] = useState('2');
  const [windowSize, setWindowSize] = useState(5);
  const [edgeInfo, setEdgeInfo] = useState(null);
  const [failedHeadshot, setFailedHeadshot] = useState(null);
  const [state, setState] = useState({ player: modal.player, games: [], momentum: null, edge: null, loading: true, error: null });
  const [retry, setRetry] = useState(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current.querySelector('button').focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...dialogRef.current.querySelectorAll('button, select, input, [tabindex="0"]')].filter(el => !el.disabled);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);

  useEffect(() => {
    let active = true;
    setState(s => ({ ...s, loading: true, error: null, games: [], momentum: null, edge: null }));
    (async () => {
      const player = modal.player.id ? modal.player : await resolvePlayer(`${modal.player.firstName} ${modal.player.lastName}`);
      const query = `playerId=${player.id}&season=${season}&gameType=${gameType}`;
      const response = await getJSON(`/api/gamelog?${query}`);
      if (!Array.isArray(response.data)) throw new Error('Unexpected statistics response');
      const isGoalie = player.pos === 'G' || response.data.some(game => game.shotsAgainst != null);
      const [momentum, edge] = await Promise.all([
        getJSON(`/api/player-momentum?${query}`).catch(() => null),
        isGoalie ? null : getJSON(`/api/player-edge?${query}`, 900000).catch(() => null),
      ]);
      if (active) setState({ player, games: response.data, momentum, edge, loading: false, error: null });
    })().catch(error => { if (active) setState(s => ({ ...s, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [modal.player, season, gameType, retry]);

  const { player, loading, error } = state;
  const games = windowSize ? state.games.slice(0, windowSize) : state.games;
  const goalie = player.pos === 'G' || games.some(g => g.shotsAgainst != null);
  const sum = key => games.reduce((total, game) => total + (game[key] || 0), 0);
  const shotsAgainst = sum('shotsAgainst');
  const savePct = shotsAgainst ? (sum('saves') / shotsAgainst).toFixed(3) : '-';
  const metrics = goalie
    ? [['Save %', savePct], ['Saves', sum('saves')], ['Goals allowed', sum('goalsAgainst')]]
    : [['Goals', sum('goals')], ['Assists', sum('assists')], ['Points', sum('points')]];
  const columns = goalie
    ? [['Decision', 'decision'], ['Saves', 'saves'], ['Shots faced', 'shotsAgainst'], ['GA', 'goalsAgainst'], ['SV%', 'savePctg']]
    : [['G', 'goals'], ['A', 'assists'], ['PTS', 'points'], ['SOG', 'shots'], ['+/-', 'plusMinus']];
  const momentum = state.momentum;
  const edge = state.edge?.availability !== 'unavailable' ? state.edge : null;
  const delta = value => value == null ? null : `${value > 0 ? '+' : ''}${value}`;
  // Landing/Edge give the canonical headshot; before they load (and for goalies, who skip both)
  // build the NHL mugs URL from the roster team, which is what those feeds point at anyway.
  const headshotTeam = modal.player.team || player.team;
  const headshot = momentum?.player?.headshot || edge?.player?.headshot
    || (player.id && headshotTeam ? `https://assets.nhle.com/mugs/nhl/${modal.season}/${headshotTeam}/${player.id}.png` : null);
  const uniform = HOME_UNIFORMS[headshotTeam];
  const sweaterNumber = modal.player.number ?? momentum?.player?.sweaterNumber ?? edge?.player?.sweaterNumber;
  const teamStyle = uniform && { '--team-body': uniform.body, '--team-stripe': uniform.stripe, '--team-ink': uniform.number };
  const edgeMetrics = edge ? [
    ['Top shot', edge.headline?.topShotSpeed],
    ['Top speed', edge.headline?.maxSkatingSpeed],
    ['32+ km/h bursts', edge.headline?.burstsOver20Mph],
    ['O-zone time', edge.headline?.offensiveZoneShare],
  ].filter(([, metric]) => metric?.value != null) : [];

  return <div className="player-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="player-dialog" role="dialog" aria-modal="true" aria-labelledby="player-dialog-title" ref={dialogRef}>
      <header className={`player-dialog-header${uniform ? ' team-header' : ''}`} style={teamStyle || undefined}>
        <div className="player-identity">
          {headshot && headshot !== failedHeadshot && <img className="player-headshot" src={headshot} alt="" width="64" height="64" onError={() => setFailedHeadshot(headshot)} />}
          <div>
          <p className="muted">{player.pos || 'Player'} {modal.player.team ? ` / ${modal.player.team}${modal.player.snapshot ? ' lineup snapshot' : ' current roster'}` : ''}</p>
          <h2 id="player-dialog-title">{player.firstName} {player.lastName}</h2>
          </div>
        </div>
        {uniform && sweaterNumber != null && <div className="player-jersey"><JerseyIcon team={headshotTeam} number={sweaterNumber} size={84} /></div>}
        <button className="icon-button" onClick={onClose} aria-label="Close player details" title="Close"><X size={20} /></button>
      </header>
      <div className="player-filters">
        <label>Season<Select value={season} onChange={event => setSeason(event.target.value)}>
          {[...new Set([...seasonsFrom(), modal.season])].sort().reverse().map(value => <option value={value} key={value}>{seasonLabel(value)}</option>)}
        </Select></label>
        <label>Competition<Select value={gameType} onChange={event => setGameType(event.target.value)}>
          <option value="2">Regular season</option><option value="3">Playoffs</option>
        </Select></label>
        <div className="segment" aria-label="Game window">{[[5, 'L5'], [10, 'L10'], [0, 'Season']].map(([value, label]) =>
          <button key={value} aria-pressed={windowSize === value} onClick={() => setWindowSize(value)}>{label}</button>)}</div>
      </div>
      {loading && <div className="data-state" role="status"><div className="spinner" /> Loading player statistics</div>}
      {error && <div className="data-state" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRetry(n => n + 1)}><RotateCw size={16} /> Retry</button></div>}
      {!loading && !error && !games.length && <div className="data-state">No appearances in {seasonLabel(season)} {gameType === '3' ? 'playoffs' : 'regular season'}.</div>}
      {!loading && !error && games.length > 0 && <>
        <div className="player-metrics">{metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {!goalie && momentum && <section className="player-context" aria-label="Recent player momentum">
          <div className="context-heading"><span>MOMENTUM</span><small>Last 5 vs season</small></div>
          {!!momentum.labels?.length && <div className="trend-labels">{momentum.labels.map(label => <span className={`trend-${label.type}`} key={label.type}>{label.label}</span>)}</div>}
          <div className="context-grid">
            <div><span>POINTS / GP</span><strong>{number(momentum.summaries?.last5?.perGame?.points)}</strong><small>{delta(momentum.summaries?.last5?.versusSeason?.pointsPerGame)} vs season</small></div>
            <div><span>SHOTS / GP</span><strong>{number(momentum.summaries?.last5?.perGame?.shots)}</strong><small>{delta(momentum.summaries?.last5?.versusSeason?.shotsPerGame)} vs season</small></div>
            <div><span>AVG TOI</span><strong>{momentum.summaries?.last5?.averageToi || '-'}</strong><small>{delta(momentum.summaries?.last5?.versusSeason?.averageToiSeconds)} sec vs season</small></div>
          </div>
        </section>}
        {!goalie && edgeMetrics.length > 0 && <section className="player-context edge-context" aria-label="NHL Edge player tracking">
          <div className="context-heading"><span>NHL EDGE</span><small>{edge.availability === 'partial' ? 'Partial tracking data' : 'Player tracking'}</small></div>
          <div className="edge-grid">{edgeMetrics.map(([label, metric]) => <div key={label}>
            <button className="edge-info-button" aria-expanded={edgeInfo === label} aria-controls="edge-info" aria-label={`What is ${label}?`} title={`What is ${label}?`}
              onClick={() => setEdgeInfo(open => open === label ? null : label)}><Info size={13} /></button>
            <span>{label}</span><strong>{metric.value}<i>{edgeUnit(metric.unit)}</i></strong>
            <small>{metric.percentile != null ? `Percentile ${metric.percentile}` : metric.rank != null ? `League rank ${metric.rank}` : 'NHL tracking'}</small>
          </div>)}</div>
          {(() => {
            const metric = edgeMetrics.find(([label]) => label === edgeInfo)?.[1];
            if (!metric) return null;
            return <div className="edge-info" id="edge-info" role="region" aria-label={`About ${edgeInfo}`}>
              <strong>{edgeInfo}</strong>
              <p>{EDGE_INFO[edgeInfo]}{metric.leagueAverage != null && ` League average: ${metric.leagueAverage}${edgeUnit(metric.unit)}.`}</p>
              {metric.percentile != null && <p>Percentile {metric.percentile} means he ranks ahead of {Math.round(metric.percentile)}% of NHL skaters. Season to date, so it moves a lot early on.</p>}
            </div>;
          })()}
        </section>}
        <p className="window-caption">{games.length} appearances / {dateLabel(games[games.length - 1].gameDate)} - {dateLabel(games[0].gameDate)} / {seasonLabel(season)}</p>
        <div className="player-table-scroll" tabIndex={0} aria-label="Game log, horizontally scrollable">
          <table className="player-table"><thead><tr><th>Date</th><th>Team</th><th>Opp</th>{columns.map(([label]) => <th key={label}>{label}</th>)}<th>TOI</th></tr></thead>
            <tbody>{games.map(game => <tr key={game.gameId}>
              <td>{dateLabel(game.gameDate)}</td><td>{game.teamAbbrev}</td><td>{game.homeRoadFlag === 'R' ? '@ ' : ''}{game.opponentAbbrev}</td>
              {columns.map(([, key]) => <td key={key}>{key === 'savePctg' && game[key] != null ? game[key].toFixed(3) : number(game[key])}</td>)}
              <td>{game.toi || '-'}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="player-detail-footer">{goalie ? `${savePct} weighted save percentage` : `${(sum('shots') / games.length).toFixed(2)} shots per appearance`}<span>Source: NHL / selected season</span></div>
      </>}
    </section>
  </div>;
}
