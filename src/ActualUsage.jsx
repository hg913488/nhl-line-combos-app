import { useState } from 'react';
import usage from '../data/actual_usage.json';
import { normalizeName } from './data-client.js';
import './actual-usage.css';
const clock = seconds => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
export default function ActualUsage({team,projected,roster,projectionUpdated}) {
 const data=usage.teams[team];
 const [chosen,setChosen]=useState('');
 if(!data || !data.players.length) return <section className="actual-usage"><h2>Actual usage unavailable</h2><p>No verified shift-chart sample is archived for this team.</p></section>;
 const player=data.players.find(p=>String(p.id)===chosen)||data.players[0];
 const known=Object.values(roster || {}).find(p=>p && String(p.id)===String(player.id));
 const name=known ? `${known.firstName} ${known.lastName}` : player.name;
 const groups=player.position==='D' ? projected?.defense : projected?.forwards;
 const currentGroup=(groups || []).find(group=>group.some(n=>{
   const match=Object.values(roster || {}).find(p=>p && normalizeName(`${p.firstName} ${p.lastName}`)===normalizeName(n));
   return match && String(match.id)===String(player.id);
 }));
 return <section className="actual-usage">
   <header><span className="actual-kicker">Actual shared ice time · All situations</span><h2>{data.date} · {team} vs {data.opponent}</h2><p>Latest archived completed game. This shows who shared the ice, not fixed or confirmed lines.</p></header>
   <label className="actual-select">Player<select value={String(player.id)} onChange={e=>setChosen(e.target.value)}>{data.players.map(p=><option key={p.id} value={p.id}>{Object.values(roster||{}).find(r=>r && String(r.id)===String(p.id))?.lastName || p.name} · {p.position}</option>)}</select></label>
   <h3>{name} played most with</h3>
   <div className="actual-mates">{player.linemates.map(mate=><article key={mate.id}><img src={`https://assets.nhle.com/mugs/nhl/${data.season}/${team}/${mate.id}.png`} alt="" width="52" height="52" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden';}}/><div><span className="name-first">{mate.firstName}</span><strong className="name-last">{mate.lastName}</strong><small>{mate.position}</small></div><div className="actual-minutes"><strong>{clock(mate.sharedSeconds)}</strong><span>together</span></div></article>)}</div>
   <div className="actual-projection"><span className="actual-kicker">Current projection · {projectionUpdated}</span><p>{currentGroup ? currentGroup.join(' · ') : 'No verified current projected line match for this player.'}</p><small>This is a separately dated saved projection, not the original pregame lineup for the archived game above.</small></div>
   <details><summary>Source &amp; limitations</summary><p>Includes even strength, special teams and overtime. Goalies excluded; duplicate shifts merged. Shared pair times overlap and should not be added together as team minutes. Only the top three partners are shown.</p><p>Shift snapshot captured {new Date(data.capturedAt).toLocaleString()}. {data.sample.invalidShiftRows} invalid shift rows; {data.sample.unknownPositionPlayerIds.length} players excluded for unknown position.</p><a href={data.source} target="_blank" rel="noreferrer">NHL shift-chart source</a><p>This archived sample does not refresh live. Five-on-five comparisons require separately validated strength intervals.</p></details>
 </section>;
}
