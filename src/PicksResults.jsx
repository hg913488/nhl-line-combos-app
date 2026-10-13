import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Clock } from 'lucide-react';
import picksLog from '../data/picks_log.json';
import { pickStatus, pickPerformance, formatPickRate } from './picks-results.js';
import { dailyMatchups, pickReason, matchingScorers, dayOutcome, POSITION_NAMES } from './picks-board.js';
import { TEAM_COLORS, NHL_TEAMS } from './teams.js';
import { getJSON } from './data-client.js';
import './picks-results.css';
import { rankPositions, POSITIONS } from './picks-signal.js';

export const lockedPicks = picksLog.picks || [];
const TEAMS = Object.fromEntries(Object.values(NHL_TEAMS).map(t=>[t.abbr,t]));
const dayLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const shiftDate = (date, delta) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+delta); return d.toISOString().slice(0,10); };
const stamp = date => new Date(date).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZoneName:'short'});
function Crest({team, size=52}) { return <img className="pb-crest" src={`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`} width={size*1.5} height={size} alt={`${team} logo`} loading="lazy" />; }
function Face({person, team}) {
  const [failed,setFailed] = useState(false);
  return person.headshot && !failed ? <img className="pb-face" src={person.headshot} alt="" width="48" height="48" loading="lazy" onError={()=>setFailed(true)} /> : <Crest team={team} size={36} />;
}
function markerInk(team) {
  const hex = TEAM_COLORS[team] || '#555555';
  const channels = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722 > .35 ? 'var(--pb-dark-ink)' : 'var(--pb-on-team)';
}
function PositionRink({away,home}) {
  const markers = [{p:'LW',x:105,y:54},{p:'C',x:145,y:96},{p:'RW',x:105,y:138},{p:'D',x:50,y:65},{p:'D',x:50,y:127}];
  return <svg className="pb-rink" viewBox="0 0 420 192" role="img" aria-label={`Position diagram: ${away?.offense || 'away'} ${away?.watch || 'no pick'} and ${home?.offense || 'home'} ${home?.watch || 'no pick'}. Schematic positions, not shot locations.`}>
    <rect x="4" y="4" width="412" height="184" rx="60" className="pb-ice" />
    <path d="M210 4V188 M165 6V186 M255 6V186 M27 28V164 M393 28V164" className="pb-rink-lines" />
    <circle cx="210" cy="96" r="25" className="pb-rink-lines" />
    {[70,350].flatMap(x=>[55,137].map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r="25" className="pb-rink-lines" />))}
    {[away,home].map((pick,i)=>markers.map((m,n)=><g key={`${i}-${n}`} transform={`translate(${i ? 420-m.x : m.x},${m.y})`} className={pick?.watch===m.p ? 'pb-position picked' : 'pb-position'} style={{'--team-color': TEAM_COLORS[pick?.offense] || 'var(--dove)', '--team-ink':markerInk(pick?.offense)}}><circle r={pick?.watch===m.p ? 19 : 13}/><text textAnchor="middle" dominantBaseline="central">{m.p}</text></g>))}
  </svg>;
}
function PickSide({pick, team, game}) {
  if (!pick) return <section className="pb-side"><span className="pb-eyebrow">{team}</span><h3>No locked pick</h3><p>No selection was saved for this team.</p></section>;
  const status = pick.provisional ? 'preview' : pickStatus(pick);
  const people = ['hit','miss'].includes(status) ? matchingScorers(pick,game) : [];
  const goalCount = pick.result?.goals_by_position?.[pick.watch];
  const label = {hit:'Hit',miss:'Miss',pending:'Pending',review:'Awaiting review',void:'Void',preview:'Preview'}[status];
  const Icon = status==='hit' ? Check : status==='miss' ? X : Clock;
  return <section className="pb-side">
    <div className="pb-side-head"><span className="pb-eyebrow">{team} pick</span><span className={`pb-status pb-${status}`}><Icon size={13} aria-hidden="true"/>{label}</span></div>
    <h3>{POSITION_NAMES[pick.watch] || pick.watch || 'No qualifying edge'}{pick.watch && <span>to score</span>}</h3>
    {people.length > 0 ? <div className="pb-scorers">{people.map(person=><div className="pb-scorer" key={person.id || person.name}><Face person={person} team={team}/><div><strong>{person.name || 'Scorer'}</strong><span>{person.goals} {person.goals===1 ? 'goal':'goals'}</span></div></div>)}</div> : <p className="pb-result-copy">{status==='miss' ? 'No goals from this position.' : status==='hit' ? `${goalCount} ${goalCount===1?'goal':'goals'} from this position.` : status==='review' ? 'Scoring totals need verification.' : status==='void' ? pick.result?.void_reason || 'Pick excluded from the record.' : status==='preview' ? 'Not locked. Can change before puck drop.' : 'Result added after the game.'}</p>}
    <details className="pb-pick-detail"><summary>Why this pick?</summary><p>{pick.provisional && !pick.watch ? 'No complete above-average matchup signal is available for this team.' : pickReason(pick)}</p><p>{pick.provisional ? 'Opponent’s latest 10-game sample. This measures a matchup, not scoring probability.' : 'Opponent’s last 10 games at lock time. This measures a matchup, not scoring probability.'}</p><small>{pick.provisional ? `Preview based on data updated ${pick.updated || 'unknown'}` : `Locked ${stamp(pick.logged_at)} · Method v${pick.method_version || 2}`}</small></details>
  </section>;
}
function MatchupCard({matchup}) {
  const [game,setGame] = useState(null);
  const needsNames = matchup.picks.some(p=>pickStatus(p)==='hit' && !(p.result?.scorers || []).length);
  useEffect(()=>{let active=true;setGame(null);if(needsNames) getJSON(`/api/game?id=${matchup.id}`,3600000).then(value=>{if(active)setGame(value);}).catch(()=>{});return()=>{active=false;};},[matchup.id,needsNames]);
  const away = matchup.picks.find(p=>p.offense===matchup.away), home = matchup.picks.find(p=>p.offense===matchup.home);
  return <article className="pb-matchup">
    <header className="pb-game-head"><div><Crest team={matchup.away}/><div><span className="pb-eyebrow">Away</span><strong>{TEAMS[matchup.away]?.name || matchup.away}</strong></div></div><a href={`/games/${matchup.id}`} className="pb-game-link">Game center <ChevronRight size={14}/></a><div><div><span className="pb-eyebrow">Home</span><strong>{TEAMS[matchup.home]?.name || matchup.home}</strong></div><Crest team={matchup.home}/></div></header>
    <PositionRink away={away} home={home}/>
    <div className="pb-sides"><PickSide pick={away} team={matchup.away} game={game}/><PickSide pick={home} team={matchup.home} game={game}/></div>
  </article>;
}
export default function PicksResults({date,onDate,scheduledGames=[],ga={}}) {
  const [method,setMethod] = useState('all');
  const days = [...new Set(lockedPicks.map(p=>p.date))].sort().reverse();
  const today = new Date().toLocaleDateString('en-CA');
  const rows = lockedPicks.filter(p=>p.date===date);
  const games = useMemo(()=>{
    const groups=dailyMatchups(lockedPicks,date);
    for(const game of scheduledGames){
      if(date<today || !['FUT','PRE'].includes(game.gameState) || Date.parse(game.startTimeUTC)<=Date.now()) continue;
      let group=groups.find(g=>String(g.id)===String(game.id));
      if(!group){group={id:game.id,start:game.startTimeUTC,away:game.awayTeam.abbrev,home:game.homeTeam.abbrev,picks:[]};groups.push(group);}
      for(const [offense,defense,venue] of [[group.away,group.home,'away'],[group.home,group.away,'home']]){
        if(group.picks.some(p=>p.offense===offense))continue;
        const allowed=ga.teams?.[defense]?.l10, averages=ga.league?.l10_avg;
        const complete=POSITIONS.every(p=>Number.isFinite(allowed?.[p])&&allowed[p]>=0&&Number.isFinite(averages?.[p])&&averages[p]>0);
        const ranked=complete?rankPositions(allowed,averages):[];const top=ranked[0]?.index>1?ranked[0]:null;
        group.picks.push({id:`preview-${game.id}-${offense}`,offense,defense,venue,watch:top?.position||null,index:top?{[top.position]:top.index}:{},provisional:true,updated:ga.lastUpdated});
      }
    }
    return groups.sort((a,b)=>a.start.localeCompare(b.start));
  },[date,today,scheduledGames,ga]);
  const outcome = dayOutcome(rows);
  const season = rows[0]?.season || Math.max(...lockedPicks.map(p=>p.season));
  const seasonRows = lockedPicks.filter(p=>p.season===season && (method==='all' || String(p.method_version || 2)===method));
  const stats = pickPerformance(seasonRows);
  const recent = [...new Set([shiftDate(today,1),today,...days])].sort().reverse().slice(0,5);
  return <section className="picks-results" aria-label="Daily picks board">
    <nav className="pb-day-nav" aria-label="Picks snapshots"><button aria-label="Previous day" onClick={()=>onDate?.(shiftDate(date,-1))}><ChevronLeft size={18}/></button><div>{recent.map(day=><button key={day} aria-pressed={day===date} onClick={()=>onDate?.(day)}>{day===today?'Today':dayLabel(day)}</button>)}</div><button aria-label="Next day" onClick={()=>onDate?.(shiftDate(date,1))}><ChevronRight size={18}/></button></nav>
    <div className="pb-day-heading"><div><span className="pb-eyebrow">{date < today ? 'Saved daily recap':'Daily picks'}</span><h2>{date===today ? 'Tonight’s board':date===shiftDate(today,1) ? 'Tomorrow’s board':`${dayLabel(date)} picks`}</h2></div><div className="pb-day-record" aria-live="polite"><strong>{outcome.settled ? `${outcome.hits} / ${outcome.settled}` : rows.length}</strong><span>{outcome.settled?'picks hit':rows.length?'locked picks':'locked picks yet'}</span>{outcome.pending>0 && <small>{outcome.pending} pending</small>}{outcome.review>0 && <small>{outcome.review} awaiting review</small>}</div></div>
    {games.length>0 ? <><p className="pb-snapshot-note">{games.length} matchups · {games.some(g=>g.picks.some(p=>p.provisional))?'Previews can change before locking':'Saved pregame position picks'}</p><div className="pb-board">{games.map(game=><MatchupCard key={game.id} matchup={game}/>)}</div></> : <p className="data-state">No picks or upcoming matchups available for this date.</p>}
    <details className="pb-track-record"><summary>Track record &amp; how it works <span>{formatPickRate(stats.hitRate)} season hit rate</span></summary><div className="pb-track-body"><label>Pick method <select aria-label="Picks record method" value={method} onChange={e=>setMethod(e.target.value)}><option value="all">All methods</option><option value="2">Legacy v2</option><option value="3">Qualified edge v3</option></select></label><p>{stats.hits} hits from {stats.settled} settled picks this season. {stats.pending} pending · {stats.review} awaiting review · {stats.void} void.</p><p>Random-position benchmark: {formatPickRate(stats.randomRate)}. Always pick centers: {formatPickRate(stats.centerRate)}. These comparisons use the same settled team-games.</p><div className="pb-position-record">{stats.byPosition.map(p=><p key={p.position}><strong>{p.position} {p.hits}/{p.settled}</strong> · {formatPickRate(p.hitRate)} · Baseline {formatPickRate(p.baseline)}</p>)}</div><p>Each pick is for a position on the named team, not an individual player. Regulation, overtime and empty-net goals count; assists and shootout goals don’t. Extra goals don’t create extra wins. Unverified results and voids are excluded.</p><p>The newer qualified-edge method skips incomplete or stale inputs and matchups at or below the league average. Original picks remain unchanged, and later scoring corrections are recorded separately.</p><p>Saved log through {days[0] || 'no games'}. Results update when a refreshed log is published. Scorer portraits are added from verified identities where available.</p></div></details>
  </section>;
}
