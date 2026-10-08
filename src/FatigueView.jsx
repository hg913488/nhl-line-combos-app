import { useEffect, useState } from 'react';
import { getJSON } from './data-client.js';
import { localDate } from './useSchedule.js';
import { NHL_TEAMS } from './teams.js';
import { fatigueFlags } from './fatigue.js';
import './fatigue.css';

const BY_ABBR = Object.fromEntries(Object.entries(NHL_TEAMS).map(([slug, team]) => [team.abbr, { ...team, slug }]));
const teamLabel = abbr => { const t = BY_ABBR[abbr]; return t ? (t.short || `${t.city} ${t.name}`) : abbr; };

function useFatigue(date) {
  const [state, setState] = useState({ date, games: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState({ date, games: [], loading: true, error: '' });
    getJSON(`/api/schedule-fatigue?date=${date}`, 3600000)
      .then(data => { if (active) setState({ date, games: data.games, loading: false, error: '' }); })
      .catch(error => { if (active) setState({ date, games: [], loading: false, error: error.message }); });
    return () => { active = false; };
  }, [date]);
  return state.date === date ? state : { date, games: [], loading: true, error: '' };
}

function Side({ team, role, onTeam }) {
  const flags = fatigueFlags(team);
  if (team.altitude) flags.push({ key: 'alt', label: 'Playing at altitude', short: 'ALTITUDE', tired: true });
  const facts = [];
  if (team.restDays != null) facts.push(team.restDays === 0 ? 'No days rest' : `${team.restDays} ${team.restDays === 1 ? 'day' : 'days'} rest`);
  facts.push(`${team.gamesInSeven} ${team.gamesInSeven === 1 ? 'game' : 'games'} in 7 nights`);
  if (team.roadTripGame) facts.push(`Road game ${team.roadTripGame}`);
  if (team.homeStandGame > 1) facts.push(`Home game ${team.homeStandGame}`);
  return <div className={`fatigue-side fatigue-${role}`}>
    <span className="fatigue-role">{role === 'away' ? 'Away' : 'Home'}</span>
    <button type="button" className="fatigue-team" onClick={() => BY_ABBR[team.abbrev] && onTeam(BY_ABBR[team.abbrev].slug)}>{teamLabel(team.abbrev)}</button>
    <ul className="fatigue-flags" aria-label={`${teamLabel(team.abbrev)} schedule flags`}>
      {flags.length ? flags.map(flag => <li key={flag.key} className={flag.tired ? 'tired' : 'fresh'} title={flag.label}>{flag.short}</li>) : <li className="none">No flags</li>}
    </ul>
    <p className="fatigue-facts">{facts.join(' · ')}</p>
  </div>;
}

function edgeText(game) {
  if (game.restEdge == null || Math.abs(game.restEdge) < 2) return null;
  const fresher = game.restEdge > 0 ? game.home : game.away;
  return `${teamLabel(fresher.abbrev)} ${Math.abs(game.restEdge)} days fresher`;
}

export default function FatigueView({ onTeam }) {
  const [date, setDate] = useState(localDate());
  const { games, loading, error } = useFatigue(date);
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return <main className="fatigue-page">
    <header className="slate-heading">
      <div>
        <p className="slate-eyebrow">Schedule fatigue · {dayLabel}</p>
        <h1>Who is running on empty</h1>
        <p className="slate-summary">Back-to-backs, three games in four nights, road trips and time-zone travel for every team on the card.</p>
      </div>
      <label>Date<input type="date" aria-label="Schedule date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label>
    </header>
    {loading && <p className="data-state" role="status">Loading schedule fatigue…</p>}
    {error && <p className="data-state" role="alert">{error}</p>}
    {!loading && !error && !games.length && <p className="data-state">No games scheduled for {dayLabel}.</p>}
    <div className="fatigue-list">
      {games.map(game => {
        const edge = edgeText(game);
        return <section key={game.id} className="fatigue-game" aria-label={`${teamLabel(game.away.abbrev)} at ${teamLabel(game.home.abbrev)}`}>
          <Side team={game.away} role="away" onTeam={onTeam} />
          <span className="fatigue-at" aria-hidden="true">at</span>
          <Side team={game.home} role="home" onTeam={onTeam} />
          {edge && <p className="fatigue-edge">Rest edge: {edge}</p>}
        </section>;
      })}
    </div>
  </main>;
}
