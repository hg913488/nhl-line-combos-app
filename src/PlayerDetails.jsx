import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCw } from 'lucide-react';
import { getJSON, resolvePlayer, seasonLabel, seasonsFrom } from './data-client.js';

const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const number = value => value == null ? '-' : value;

export default function PlayerDetails({ modal, onClose }) {
  const [season, setSeason] = useState(modal.season);
  const [gameType, setGameType] = useState('2');
  const [windowSize, setWindowSize] = useState(5);
  const [state, setState] = useState({ player: modal.player, games: [], loading: true, error: null });
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
    setState(s => ({ ...s, loading: true, error: null, games: [] }));
    (async () => {
      const player = modal.player.id ? modal.player : await resolvePlayer(`${modal.player.firstName} ${modal.player.lastName}`);
      const response = await getJSON(`/api/gamelog?playerId=${player.id}&season=${season}&gameType=${gameType}`);
      if (!Array.isArray(response.data)) throw new Error('Unexpected statistics response');
      if (active) setState({ player, games: response.data, loading: false, error: null });
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

  return <div className="player-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="player-dialog" role="dialog" aria-modal="true" aria-labelledby="player-dialog-title" ref={dialogRef}>
      <header className="player-dialog-header">
        <div>
          <p className="muted">{player.pos || 'Player'} {modal.player.team ? ` / ${modal.player.team}${modal.player.snapshot ? ' lineup snapshot' : ' current roster'}` : ''}</p>
          <h2 id="player-dialog-title">{player.firstName} {player.lastName}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close player details" title="Close"><X size={20} /></button>
      </header>
      <div className="player-filters">
        <label>Season<select value={season} onChange={event => setSeason(event.target.value)}>
          {[...new Set([...seasonsFrom(), modal.season])].sort().reverse().map(value => <option value={value} key={value}>{seasonLabel(value)}</option>)}
        </select></label>
        <label>Competition<select value={gameType} onChange={event => setGameType(event.target.value)}>
          <option value="2">Regular season</option><option value="3">Playoffs</option>
        </select></label>
        <div className="segment" aria-label="Game window">{[[5, 'L5'], [10, 'L10'], [0, 'Season']].map(([value, label]) =>
          <button key={value} aria-pressed={windowSize === value} onClick={() => setWindowSize(value)}>{label}</button>)}</div>
      </div>
      {loading && <div className="data-state" role="status"><div className="spinner" /> Loading player statistics</div>}
      {error && <div className="data-state" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRetry(n => n + 1)}><RotateCw size={16} /> Retry</button></div>}
      {!loading && !error && !games.length && <div className="data-state">No appearances in {seasonLabel(season)} {gameType === '3' ? 'playoffs' : 'regular season'}.</div>}
      {!loading && !error && games.length > 0 && <>
        <div className="player-metrics">{metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
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
