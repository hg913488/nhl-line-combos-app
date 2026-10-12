import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, RotateCw } from 'lucide-react';
import { getJSON } from './data-client.js';
import { localDate } from './useSchedule.js';
import { NHL_TEAMS, TEAM_COLORS } from './teams.js';
import { fatigueFlags } from './fatigue.js';
import './fatigue.css';

const BY_ABBR = Object.fromEntries(Object.entries(NHL_TEAMS).map(([slug, team]) => [team.abbr, { ...team, slug }]));
const teamLabel = abbr => BY_ABBR[abbr]?.name || abbr;
const shiftDate = (date, delta) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+delta); return d.toISOString().slice(0,10); };
const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function useFatigue(date, retry) {
  const [state, setState] = useState({ date, games: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState({ date, games: [], loading: true, error: '' });
    getJSON(`/api/schedule?date=${date}&fatigue=1`, 3600000)
      .then(data => { if (!Array.isArray(data.games)) throw new Error('Schedule data is unavailable.'); if (active) setState({ date, games: data.games, loading: false, error: '' }); })
      .catch(error => { if (active) setState({ date, games: [], loading: false, error: error.message }); });
    return () => { active = false; };
  }, [date, retry]);
  return state.date === date ? state : { date, games: [], loading: true, error: '' };
}
function Side({ team, role, onTeam }) {
  const flags = fatigueFlags(team);
  const rest = valid(team.restDays) ? team.restDays : null;
  const games = valid(team.gamesInSeven) ? team.gamesInSeven : null;
  const meta = BY_ABBR[team.abbrev];
  return <section className="fatigue-side" style={{'--fatigue-team-color':TEAM_COLORS[team.abbrev] || 'var(--dove)'}} aria-label={`${team.abbrev} schedule load`}>
    <div className="fatigue-team-heading"><img src={`https://assets.nhle.com/logos/nhl/svg/${team.abbrev}_dark.svg`} width="66" height="44" alt={`${team.abbrev} logo`} loading="lazy"/><div><span className="fatigue-role">{role} · {team.abbrev}</span><button type="button" className="fatigue-team" disabled={!meta} onClick={()=>meta && onTeam?.(meta.slug)}>{teamLabel(team.abbrev)}</button></div></div>
    <dl className="fatigue-numbers"><div><dt>Days of rest</dt><dd className={rest===0?'fatigue-busy':''}>{rest ?? '—'}</dd></div><div><dt>Games in 7 nights</dt><dd>{games ?? '—'}</dd></div></dl>
    <div className="fatigue-week" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i} className={games != null && i<games?'filled':''}/>)}</div>
    <p className={`fatigue-main-flag ${team.backToBack ? 'fatigue-busy' : ''}`}>{team.backToBack ? 'Back-to-back tonight' : team.threeInFour ? 'Third game in four nights' : rest == null ? 'Rest history unavailable' : rest>=3 ? 'Extended rest' : 'No back-to-back'}</p>
    <details className="fatigue-detail"><summary>Travel &amp; schedule details</summary><ul>{flags.filter(f=>!['b2b','3in4'].includes(f.key)).map(f=><li key={f.key}>{f.label}</li>)}{valid(team.gamesInFour) && <li>{team.gamesInFour} games in four nights, including this game</li>}{team.roadTripGame>0 && <li>Game {team.roadTripGame} of this road trip</li>}{team.homeStandGame>0 && <li>Game {team.homeStandGame} of this home stand</li>}{team.altitude && <li>Visiting a high-altitude arena</li>}{team.venue && <li>{team.venue}</li>}</ul></details>
  </section>;
}
function restLabel(game) {
  if (!valid(game.home.restDays) || !valid(game.away.restDays)) return 'Rest comparison unavailable';
  const gap = game.home.restDays-game.away.restDays;
  if (!gap) return 'Both teams have the same rest';
  return `${gap>0 ? game.home.abbrev : game.away.abbrev} has ${Math.abs(gap)} extra ${Math.abs(gap)===1?'day':'days'} of rest`;
}
export default function FatigueView({onTeam}) {
  const [date,setDate] = useState(localDate());
  const [retry,setRetry] = useState(0);
  const {games,loading,error} = useFatigue(date,retry);
  const teams = games.flatMap(g=>[g.away,g.home]);
  const backToBack = teams.filter(t=>t.backToBack).length;
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  return <main className="fatigue-page">
    <header className="fatigue-heading"><div><span className="fatigue-role">Schedule context</span><h1>Rest &amp; travel</h1><p>Who has more rest, and who has a heavier week.</p></div><label>Date<input type="date" aria-label="Schedule date" value={date} onChange={e=>e.target.value && setDate(e.target.value)}/></label></header>
    <div className="fatigue-date-strip"><button aria-label="Previous day" onClick={()=>setDate(shiftDate(date,-1))}><ChevronLeft size={18}/></button><strong>{dayLabel}</strong><button aria-label="Next day" onClick={()=>setDate(shiftDate(date,1))}><ChevronRight size={18}/></button><button className="fatigue-today" onClick={()=>setDate(localDate())}><CalendarDays size={14}/>Today</button></div>
    {loading && <p className="data-state" role="status">Loading rest and travel…</p>}
    {error && <div className="data-state" role="alert"><p>{error}</p><button className="fatigue-retry" onClick={()=>setRetry(v=>v+1)}><RotateCw size={14}/>Retry</button></div>}
    {!loading && !error && <p className="fatigue-day-summary">{games.length} {games.length===1?'matchup':'matchups'} <span>·</span> {backToBack} {backToBack===1?'team':'teams'} on a back-to-back</p>}
    {!loading && !error && !games.length && <p className="data-state">No games scheduled for this date.</p>}
    <div className="fatigue-list">{games.map(game=><article className="fatigue-game" key={game.id}>
      <div className="fatigue-game-top"><time>{game.startTimeUTC ? new Date(game.startTimeUTC).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZoneName:'short'}) : 'Time unavailable'}</time><a href={`/games/${game.id}`}>Game center <ChevronRight size={12}/></a></div>
      <div className="fatigue-sides"><Side team={game.away} role="Away" onTeam={onTeam}/><Side team={game.home} role="Home" onTeam={onTeam}/></div><p className="fatigue-edge">{restLabel(game)}</p>
    </article>)}</div>
    <details className="fatigue-about"><summary>What these numbers mean</summary><p>Rest days are full calendar days between games. The weekly count includes the selected game; filled blocks show the number of games, not their dates. Only games of the same type count toward the comparison. Opening-night rest can be unknown.</p><p>These are schedule facts, not a fatigue score or a prediction. Travel flags use venue time zones; they don’t measure flight distance or actual sleep. Schedule data may be cached for up to an hour.</p></details>
  </main>;
}
