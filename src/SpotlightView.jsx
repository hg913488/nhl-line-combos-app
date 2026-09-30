import React, { useMemo, useState } from 'react';
import Select from './Select.jsx';
import useSchedule, { localDate } from './useSchedule.js';
import { NHL_TEAMS } from './teams.js';
import { titleCase, moveClause } from './lineup-text.js';
import spotlight from '../data/spotlight.json';

const LIST_SIZE = 10;
const STREAK_MIN = 3;
const DROUGHT_MIN = 5;
const DROUGHT_SCORER_PPG = 0.5; // only flag droughts for players who normally score
const ABBR_BY_SLUG = Object.fromEntries(Object.entries(NHL_TEAMS).map(([slug, team]) => [slug, team.abbr]));
const TEAM_ABBRS = Object.values(NHL_TEAMS).map(team => team.abbr).sort();

const signed = (value, digits = 2) => value == null ? '–' : `${value > 0 ? '+' : ''}${Number(value.toFixed(digits))}`;
const clock = seconds => {
  if (seconds == null) return '–';
  const abs = Math.abs(Math.round(seconds));
  return `${seconds < 0 ? '-' : seconds > 0 ? '+' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
};
const headshot = player => `https://assets.nhle.com/mugs/nhl/${spotlight.season_id}/${player.team}/${player.id}.png`;
const isForward = pos => ['C', 'L', 'R'].includes(pos);
const posLabel = pos => ({ L: 'LW', R: 'RW' }[pos] || pos);

function Row({ player, stat, detail, onPlayer, tone }) {
  const [first, ...rest] = player.name.split(' ');
  return <li className="spot-row">
    <img src={headshot(player)} alt="" width="36" height="36" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
    <div className="spot-who">
      <button onClick={() => onPlayer(player.name, { id: String(player.id), firstName: first, lastName: rest.join(' '), pos: player.pos, team: player.team })}>{player.name}</button>
      <small>{[player.team, posLabel(player.pos), detail].filter(Boolean).join(' · ')}</small>
    </div>
    <strong className={`spot-stat${tone ? ` spot-${tone}` : ''}`}>{stat}</strong>
  </li>;
}

function Section({ title, note, empty, children }) {
  const items = React.Children.toArray(children);
  return <section className="spot-section">
    <header><h2>{title}</h2>{note && <p>{note}</p>}</header>
    {items.length ? <ol>{items}</ol> : <p className="spot-empty">{empty}</p>}
  </section>;
}

export default function SpotlightView({ onPlayer }) {
  const [position, setPosition] = useState('all');
  const [team, setTeam] = useState('all');
  const [tonightOnly, setTonightOnly] = useState(false);
  const { games } = useSchedule(localDate());
  const tonight = useMemo(() => new Set(games.flatMap(game => [game.awayTeam?.abbrev, game.homeTeam?.abbrev])), [games]);

  const players = spotlight.players || [];
  const byId = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);
  const keep = player => (position === 'all' || (position === 'F' ? isForward(player.pos) : player.pos === 'D'))
    && (team === 'all' || player.team === team)
    && (!tonightOnly || tonight.has(player.team));
  const pool = players.filter(keep);
  const top = (list, key, dir = -1) => [...list].sort((a, b) => dir * (key(a) - key(b))).slice(0, LIST_SIZE);

  const trending = pool.filter(player => player.momentum != null);
  const heating = top(trending.filter(player => player.momentum > 0), player => player.momentum);
  const cooling = top(trending.filter(player => player.momentum < 0), player => player.momentum, 1);
  const hotStarts = top(pool.filter(player => player.season.p > 0), player => player.season.p * 100 + player.season.p_pg * 10 + player.season.sog / 100);
  const streaks = top(pool.filter(player => player.pointStreak >= STREAK_MIN), player => player.pointStreak);
  const droughts = top(pool.filter(player => player.pointDrought >= DROUGHT_MIN && player.season.gp >= spotlight.minTrendGames
    && player.season.p / player.season.gp >= DROUGHT_SCORER_PPG), player => player.pointDrought);
  const moves = (spotlight.roleChanges || []).filter(move => {
    const abbr = ABBR_BY_SLUG[move.team];
    const known = byId.get(move.id);
    return keep(known || { pos: '', team: abbr }) && (position === 'all' || known);
  }).slice(0, LIST_SIZE);

  const trendDetail = player => `${signed(player.last5.p_pg - player.season.p_pg)} pts/GP · ${signed(player.last5.sog_pg - player.season.sog_pg, 1)} shots · ${clock(player.last5.toi - player.season.toi)} TOI`;
  const updated = spotlight.generated_at ? new Date(spotlight.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

  return <main className="spotlight-page">
    <header className="schedule-heading spot-heading">
      <div>
        <h1>Player spotlight</h1>
        <p className="muted">Each skater’s last five games against his own {spotlight.season} season, across the league.{updated ? ` Updated ${updated}.` : ''}</p>
      </div>
    </header>

    <div className="spot-filters">
      <div className="segment" aria-label="Position">{[['all', 'All'], ['F', 'Forwards'], ['D', 'Defense']].map(([value, label]) =>
        <button key={value} aria-pressed={position === value} onClick={() => setPosition(value)}>{label}</button>)}</div>
      <label>Team<Select value={team} onChange={event => setTeam(event.target.value)}>
        <option value="all">All teams</option>
        {TEAM_ABBRS.map(abbr => <option key={abbr} value={abbr}>{abbr}</option>)}
      </Select></label>
      <div className="segment" aria-label="Games">
        <button aria-pressed={!tonightOnly} onClick={() => setTonightOnly(false)}>All</button>
        <button aria-pressed={tonightOnly} onClick={() => setTonightOnly(true)} disabled={!tonight.size} title={tonight.size ? '' : 'No games tonight'}>Playing tonight</button>
      </div>
    </div>

    {spotlight.earlySeason && <p className="spot-notice" role="status">
      Momentum compares the last five games with the season, so it needs about {spotlight.minTrendGames} games. Until then this page shows hot starts and line moves.
    </p>}

    <div className="spot-grid">
      {spotlight.earlySeason
        ? <Section title="Hot starts" note="Most points so far" empty="No points recorded yet.">
          {hotStarts.map(player => <Row key={player.id} player={player} onPlayer={onPlayer}
            stat={`${player.season.p} PTS`} detail={`${player.season.g} G · ${player.season.sog} shots in ${player.season.gp} GP`} />)}
        </Section>
        : <>
          <Section title="Heating up" note="Last 5 above season pace" empty="Nobody matches these filters.">
            {heating.map(player => <Row key={player.id} player={player} onPlayer={onPlayer} stat={signed(player.momentum)} tone="up" detail={trendDetail(player)} />)}
          </Section>
          <Section title="Cooling down" note="Last 5 below season pace" empty="Nobody matches these filters.">
            {cooling.map(player => <Row key={player.id} player={player} onPlayer={onPlayer} stat={signed(player.momentum)} tone="down" detail={trendDetail(player)} />)}
          </Section>
        </>}
      <Section title="Line moves" note="Promotions and demotions, last 7 days" empty="No line moves for these filters.">
        {moves.map(move => {
          const known = byId.get(move.id);
          const player = known || { id: move.id, name: titleCase(move.player), team: ABBR_BY_SLUG[move.team], pos: '' };
          return <Row key={`${move.team}-${move.player}`} player={{ ...player, name: titleCase(move.player) }} onPlayer={onPlayer}
            stat={move.direction === 'up' ? '▲ Up' : move.direction === 'down' ? '▼ Down' : '↕ Mixed'} tone={move.direction}
            detail={`${move.changes.map(moveClause).join(', ')} · ${new Date(move.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} />;
        })}
      </Section>
      <Section title="Point streaks" note={`${STREAK_MIN}+ games in a row with a point`} empty="No active streaks of three or more games yet.">
        {streaks.map(player => <Row key={player.id} player={player} onPlayer={onPlayer}
          stat={`${player.pointStreak} GP`} detail={`${player.last5.p} pts in last ${player.last5.gp}`} />)}
      </Section>
      {!spotlight.earlySeason && <Section title="Droughts" note={`Regular scorers without a point in ${DROUGHT_MIN}+ games`} empty="No notable droughts.">
        {droughts.map(player => <Row key={player.id} player={player} onPlayer={onPlayer}
          stat={`${player.pointDrought} GP`} detail={`${player.season.p} pts in ${player.season.gp} GP this season`} />)}
      </Section>}
    </div>
    <p className="sheet-note">Momentum = change in points per game, plus a quarter of the change in shots per game, plus a tenth of the change in ice time (minutes), last 5 against season. Regular season only. Source: NHL.</p>
  </main>;
}
