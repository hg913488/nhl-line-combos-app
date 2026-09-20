import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RinkShotMap from './RinkShotMap.jsx';
import { NHL_TEAMS, TEAM_COLORS } from './teams.js';
import './game.css';

const POLL_MS = 20000;
const LIVE_STATES = new Set(['LIVE', 'CRIT']);
const DONE_STATES = new Set(['FINAL', 'OFF']);
const SLUG_BY_ABBR = Object.fromEntries(Object.entries(NHL_TEAMS).map(([slug, team]) => [team.abbr, slug]));

// Let modified clicks (new tab/window) fall through to the browser.
const isPlainClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const STAT_LABELS = {
  sog: 'Shots on goal',
  faceoffWinningPctg: 'Faceoff %',
  powerPlay: 'Power play',
  pim: 'Penalty minutes',
  hits: 'Hits',
  blockedShots: 'Blocked shots',
  giveaways: 'Giveaways',
  takeaways: 'Takeaways',
};
const STAT_ORDER = Object.keys(STAT_LABELS);
const PERCENT_STATS = new Set(['faceoffWinningPctg', 'powerPlayPctg']);
const STRENGTH_LABELS = { PP: 'Power play', SH: 'Short-handed', EN: 'Empty net', PS: 'Penalty shot' };

function statNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.includes('/')) return Number(value.split('/')[0]) || 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statText(category, value) {
  if (value == null) return '—';
  if (PERCENT_STATS.has(category)) return `${(Number(value) * 100).toFixed(1)}%`;
  return String(value);
}

function startTimeText(startTimeUTC) {
  const time = Date.parse(startTimeUTC || '');
  if (!Number.isFinite(time)) return 'Time TBD';
  return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

function startDateText(startTimeUTC) {
  const time = Date.parse(startTimeUTC || '');
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function periodLabel(period, periodType) {
  if (periodType === 'OT') return period > 4 ? `${period - 3}OT` : 'OT';
  if (periodType === 'SO') return 'SO';
  if (period === 1) return '1st';
  if (period === 2) return '2nd';
  if (period === 3) return '3rd';
  return `P${period}`;
}

function TeamLogo({ abbr }) {
  if (!abbr) return null;
  return <span className="game-logo" aria-hidden="true">
    <img className="logo-dark" src={`https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg`} alt="" width="44" height="44" loading="lazy" />
    <img className="logo-light" src={`https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg`} alt="" width="44" height="44" loading="lazy" />
  </span>;
}

function TeamHeading({ team, role, onTeam }) {
  const slug = SLUG_BY_ABBR[team.abbr];
  const meta = slug ? NHL_TEAMS[slug] : null;
  const label = meta ? `${meta.city} ${meta.name}` : [team.city, team.name].filter(Boolean).join(' ') || team.abbr;
  return <div className={`game-team game-team-${role}`}>
    <TeamLogo abbr={team.abbr} />
    <div className="game-team-copy">
      <span className="game-team-role">{role === 'home' ? 'Home' : 'Away'}</span>
      {slug
        ? <a href={`/teams/${slug}`} onClick={event => { if (!isPlainClick(event)) return; event.preventDefault(); onTeam?.(slug); }}>{label}</a>
        : <strong>{label}</strong>}
      <span className="game-team-abbr">{team.abbr}</span>
    </div>
  </div>;
}

function StatusLine({ game }) {
  if (LIVE_STATES.has(game.state)) {
    const clock = game.clock?.inIntermission
      ? `Intermission · ${game.clock.timeRemaining || ''}`
      : `${periodLabel(game.period, game.periodType)} · ${game.clock?.timeRemaining || '—'}`;
    return <div className="game-status">
      <span className="game-live"><span className="game-live-dot" aria-hidden="true" />LIVE</span>
      <span className="game-clock">{clock}</span>
      {game.situation && <span className="game-situation">{game.situation}</span>}
    </div>;
  }
  if (DONE_STATES.has(game.state)) {
    const suffix = game.periodType === 'OT' || game.periodType === 'SO' ? ` / ${game.periodType}` : '';
    return <div className="game-status"><span className="game-final">{`Final${suffix}`}</span></div>;
  }
  return <div className="game-status">
    <span className="game-final">{startTimeText(game.startTimeUTC)}</span>
    <span className="game-clock">{startDateText(game.startTimeUTC)}</span>
  </div>;
}

function GoalRow({ goal, onPlayer }) {
  const strength = goal.strength && goal.strength !== 'EV' ? goal.strength : null;
  return <li className="goal-row">
    <span className="goal-time">{periodLabel(goal.period, goal.periodType)} · {goal.time}</span>
    <span className="goal-team">{goal.team}</span>
    <span className="goal-copy">
      {goal.scorer
        ? <button type="button" className="link-button" onClick={() => onPlayer?.(goal.scorer)}>{goal.scorer}</button>
        : <strong>Unknown scorer</strong>}
      {goal.assists.length > 0 && <span className="goal-assists">
        {goal.assists.map((assist, index) => <React.Fragment key={assist}>
          {index === 0 ? ' from ' : ', '}
          <button type="button" className="link-button" onClick={() => onPlayer?.(assist)}>{assist}</button>
        </React.Fragment>)}
      </span>}
      {goal.shotType && <span className="goal-shot-type">{goal.shotType}</span>}
    </span>
    <span className="goal-score">
      {strength && <span className="goal-strength" title={STRENGTH_LABELS[strength]}>{strength}</span>}
      {goal.awayScore != null && goal.homeScore != null && <span className="goal-running">{goal.awayScore}–{goal.homeScore}</span>}
    </span>
  </li>;
}

function StatBar({ stat, awayAbbr, homeAbbr }) {
  const away = statNumber(stat.away);
  const home = statNumber(stat.home);
  const total = away + home;
  const awayShare = total > 0 ? (away / total) * 100 : 50;
  return <li className="stat-row">
    <span className="stat-value stat-value-away">{statText(stat.category, stat.away)}</span>
    <span className="stat-middle">
      <span className="stat-label">{STAT_LABELS[stat.category] || stat.category}</span>
      <span className="stat-bar">
        <span className="stat-bar-away" style={{ width: `${awayShare}%` }} />
        <span className="stat-bar-home" style={{ width: `${100 - awayShare}%` }} />
      </span>
      <span className="visually-hidden">{`${awayAbbr} ${statText(stat.category, stat.away)}, ${homeAbbr} ${statText(stat.category, stat.home)}`}</span>
    </span>
    <span className="stat-value stat-value-home">{statText(stat.category, stat.home)}</span>
  </li>;
}

export default function GameView({ gameId, onBack, onTeam, onPlayer }) {
  const [game, setGame] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ team: 'both', period: 'all' });
  const requestRef = useRef(0);

  const load = useCallback(async ({ background = false } = {}) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    if (!background) { setStatus('loading'); setError(null); }
    try {
      const response = await fetch(`/api/game?id=${encodeURIComponent(gameId)}`);
      const payload = await response.json().catch(() => null);
      if (requestRef.current !== request) return;
      if (!response.ok) throw new Error(payload?.error || 'Could not load this game.');
      setGame(payload);
      setStatus('ready');
      setError(null);
    } catch (caught) {
      if (requestRef.current !== request) return;
      if (background) return; // A failed refresh keeps the last good scoreboard on screen.
      setError(caught instanceof Error ? caught.message : 'Could not load this game.');
      setStatus('error');
    }
  }, [gameId]);

  useEffect(() => {
    setGame(null);
    load();
    return () => { requestRef.current += 1; };
  }, [load]);

  const isLive = LIVE_STATES.has(game?.state);
  useEffect(() => {
    if (!isLive) return undefined;
    let timer = null;
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const start = () => { stop(); timer = setInterval(() => load({ background: true }), POLL_MS); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { load({ background: true }); start(); } else stop();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [isLive, load]);

  const periods = useMemo(() => {
    const numbers = new Set();
    let hasOvertime = false;
    for (const shot of game?.shots || []) {
      if (shot.periodType === 'OT') hasOvertime = true;
      else if (shot.period != null) numbers.add(shot.period);
    }
    return { numbers: [...numbers].sort((a, b) => a - b), hasOvertime };
  }, [game]);

  const stats = useMemo(() => {
    const byCategory = new Map((game?.teamStats || []).map(stat => [stat.category, stat]));
    return STAT_ORDER.map(category => byCategory.get(category)).filter(Boolean);
  }, [game]);

  const backLink = <a className="game-back" href="/" onClick={event => { if (!isPlainClick(event)) return; event.preventDefault(); onBack?.(); }}>← Back to Tonight</a>;

  if (status === 'loading' && !game) {
    return <main className="game-view">{backLink}<p className="data-state" role="status">Loading game…</p></main>;
  }

  if (status === 'error' && !game) {
    return <main className="game-view">
      {backLink}
      <div className="data-state" role="alert">
        <span>{error}</span>
        <button type="button" className="text-button" onClick={() => load()}>Retry</button>
      </div>
    </main>;
  }

  if (!game) return <main className="game-view">{backLink}</main>;

  const pregame = !LIVE_STATES.has(game.state) && !DONE_STATES.has(game.state);
  const shotFilterId = 'game-shot-filter';

  const teamColors = {
    '--away-team': TEAM_COLORS[game.away.abbr] || 'var(--dove)',
    '--home-team': TEAM_COLORS[game.home.abbr] || 'var(--casper)',
  };

  return <main className="game-view" style={teamColors} aria-busy={status === 'loading'}>
    {backLink}

    <header className="game-scoreboard">
      <TeamHeading team={game.away} role="away" onTeam={onTeam} />
      <div className="game-score">
        <span className="game-score-value">{game.away.score}</span>
        <span className="game-score-dash" aria-hidden="true">–</span>
        <span className="game-score-value">{game.home.score}</span>
      </div>
      <TeamHeading team={game.home} role="home" onTeam={onTeam} />
      <div className="game-meta">
        <StatusLine game={game} />
        {game.venue && <span className="game-venue">{game.venue}</span>}
      </div>
    </header>

    {pregame && <section className="game-panel game-pregame">
      <h2>Puck drop {startTimeText(game.startTimeUTC)}</h2>
      <p>The shot map, goal timeline, and team stats fill in once play begins. This page refreshes itself while the game is live.</p>
    </section>}

    {!pregame && <>
      <section className="game-panel" aria-labelledby="game-shotmap-heading">
        <div className="game-panel-head">
          <h2 id="game-shotmap-heading">Shot map</h2>
          <div className="game-filters">
            <label htmlFor={`${shotFilterId}-team`}>Team
              <select id={`${shotFilterId}-team`} value={filter.team} onChange={event => setFilter(current => ({ ...current, team: event.target.value }))}>
                <option value="both">Both teams</option>
                <option value="away">{game.away.abbr}</option>
                <option value="home">{game.home.abbr}</option>
              </select>
            </label>
            <label htmlFor={`${shotFilterId}-period`}>Period
              <select id={`${shotFilterId}-period`} value={filter.period} onChange={event => setFilter(current => ({ ...current, period: event.target.value }))}>
                <option value="all">All periods</option>
                {periods.numbers.map(period => <option key={period} value={String(period)}>{periodLabel(period, 'REG')}</option>)}
                {periods.hasOvertime && <option value="OT">OT</option>}
              </select>
            </label>
          </div>
        </div>
        <p className="game-panel-note">{game.away.abbr} attacks left, {game.home.abbr} attacks right, every period combined.</p>
        <RinkShotMap shots={game.shots} awayAbbr={game.away.abbr} homeAbbr={game.home.abbr} filter={filter} />
        <ul className="rink-legend">
          <li><span className="legend-mark legend-goal" aria-hidden="true" />Goal</li>
          <li><span className="legend-mark legend-shot" aria-hidden="true" />On goal</li>
          <li><span className="legend-mark legend-miss" aria-hidden="true" />Missed</li>
          <li><span className="legend-mark legend-block" aria-hidden="true" />Blocked</li>
          <li><span className="legend-swatch legend-away" aria-hidden="true" />{game.away.abbr}</li>
          <li><span className="legend-swatch legend-home" aria-hidden="true" />{game.home.abbr}</li>
        </ul>
      </section>

      {game.shotsByPeriod.length > 0 && <section className="game-panel" aria-labelledby="game-sog-heading">
        <h2 id="game-sog-heading">Shots by period</h2>
        <table className="sog-table">
          <thead>
            <tr>
              <th scope="col">Team</th>
              {game.shotsByPeriod.map(row => <th key={`${row.period}-${row.periodType}`} scope="col">{periodLabel(row.period, row.periodType)}</th>)}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {['away', 'home'].map(side => <tr key={side}>
              <th scope="row">{game[side].abbr}</th>
              {game.shotsByPeriod.map(row => <td key={`${side}-${row.period}`}>{row[side]}</td>)}
              <td>{game[side].sog ?? game.shotsByPeriod.reduce((total, row) => total + row[side], 0)}</td>
            </tr>)}
          </tbody>
        </table>
      </section>}

      <section className="game-panel" aria-labelledby="game-goals-heading">
        <h2 id="game-goals-heading">Goals</h2>
        {game.goals.length
          ? <ul className="goal-list">{game.goals.map((goal, index) => <GoalRow key={`${goal.period}-${goal.time}-${index}`} goal={goal} onPlayer={onPlayer} />)}</ul>
          : <p className="game-panel-note">No goals yet.</p>}
      </section>

      {stats.length > 0 && <section className="game-panel" aria-labelledby="game-stats-heading">
        <div className="game-panel-head">
          <h2 id="game-stats-heading">Team stats</h2>
          <span className="game-panel-note">{game.away.abbr} left · {game.home.abbr} right</span>
        </div>
        <ul className="stat-list">
          {stats.map(stat => <StatBar key={stat.category} stat={stat} awayAbbr={game.away.abbr} homeAbbr={game.home.abbr} />)}
        </ul>
      </section>}
    </>}
  </main>;
}
