import React, { useState, useMemo, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { Sun, Moon, Search, AlertCircle } from 'lucide-react';
import useSchedule, { localDate } from './useSchedule.js';
import PlayerDetails from './PlayerDetails.jsx';
import JerseyIcon from './JerseyIcon.jsx';
import { getJSON, normalizeName, seasonForDate, seasonLabel, seasonsFrom } from './data-client.js';
import './styles.css';
import lineups from '../data/lines.json';
import goalsAgainstData from '../data/goals_against_by_position.json';

import playoffBracket from '../data/playoff_bracket.json';
import iihfGroups from '../data/iihf_groups.json';
import iihfSchedule from '../data/iihf_schedule.json';
import iihfRostersData from '../data/iihf_rosters.json';

const UPDATED_AT = lineups.updated_at.slice(0, 10);
const TEAMS_DATA = lineups.teams;
const INJURIES_DATA = lineups.injuries || {};
const GA_DATA = goalsAgainstData;

const BRACKET_DATA = playoffBracket;
const IIHF_GROUPS_DATA = iihfGroups;
const IIHF_SCHEDULE_DATA = iihfSchedule;
const IIHF_ROSTERS = iihfRostersData.rosters;

const NHL_TEAMS = {
  "anaheim-ducks":        { city: "Anaheim",      name: "Ducks",         abbr: "ANA", id: 24 },
  "boston-bruins":        { city: "Boston",       name: "Bruins",        abbr: "BOS", id: 6  },
  "buffalo-sabres":       { city: "Buffalo",      name: "Sabres",        abbr: "BUF", id: 7  },
  "calgary-flames":       { city: "Calgary",      name: "Flames",        abbr: "CGY", id: 20 },
  "carolina-hurricanes":  { city: "Carolina",     name: "Hurricanes",    abbr: "CAR", id: 12 },
  "chicago-blackhawks":   { city: "Chicago",      name: "Blackhawks",    abbr: "CHI", id: 16 },
  "colorado-avalanche":   { city: "Colorado",     name: "Avalanche",     abbr: "COL", id: 21 },
  "columbus-blue-jackets":{ city: "Columbus",     name: "Blue Jackets",  abbr: "CBJ", id: 29 },
  "dallas-stars":         { city: "Dallas",       name: "Stars",         abbr: "DAL", id: 25 },
  "detroit-red-wings":    { city: "Detroit",      name: "Red Wings",     abbr: "DET", id: 17 },
  "edmonton-oilers":      { city: "Edmonton",     name: "Oilers",        abbr: "EDM", id: 22 },
  "florida-panthers":     { city: "Florida",      name: "Panthers",      abbr: "FLA", id: 13 },
  "los-angeles-kings":    { city: "Los Angeles",  name: "Kings",         abbr: "LAK", id: 26 },
  "minnesota-wild":       { city: "Minnesota",    name: "Wild",          abbr: "MIN", id: 30 },
  "montreal-canadiens":   { city: "Montréal",     name: "Canadiens",     abbr: "MTL", id: 8  },
  "nashville-predators":  { city: "Nashville",    name: "Predators",     abbr: "NSH", id: 18 },
  "new-jersey-devils":    { city: "New Jersey",   name: "Devils",        abbr: "NJD", id: 1  },
  "new-york-islanders":   { city: "NY Isles",     name: "Islanders",     abbr: "NYI", id: 2  },
  "new-york-rangers":     { city: "NY Rangers",   name: "Rangers",       abbr: "NYR", id: 3  },
  "ottawa-senators":      { city: "Ottawa",       name: "Senators",      abbr: "OTT", id: 9  },
  "philadelphia-flyers":  { city: "Philadelphia", name: "Flyers",        abbr: "PHI", id: 4  },
  "pittsburgh-penguins":  { city: "Pittsburgh",   name: "Penguins",      abbr: "PIT", id: 5  },
  "san-jose-sharks":      { city: "San Jose",     name: "Sharks",        abbr: "SJS", id: 28 },
  "seattle-kraken":       { city: "Seattle",      name: "Kraken",        abbr: "SEA", id: 55 },
  "st-louis-blues":       { city: "St. Louis",    name: "Blues",         abbr: "STL", id: 19 },
  "tampa-bay-lightning":  { city: "Tampa Bay",    name: "Lightning",     abbr: "TBL", id: 14 },
  "toronto-maple-leafs":  { city: "Toronto",      name: "Maple Leafs",   abbr: "TOR", id: 10 },
  "utah-mammoth":         { city: "Utah",         name: "Mammoth",       abbr: "UTA", id: 59 },
  "vancouver-canucks":    { city: "Vancouver",    name: "Canucks",       abbr: "VAN", id: 23 },
  "vegas-golden-knights": { city: "Vegas",        name: "Golden Knights",abbr: "VGK", id: 54 },
  "washington-capitals":  { city: "Washington",   name: "Capitals",      abbr: "WSH", id: 15 },
  "winnipeg-jets":        { city: "Winnipeg",     name: "Jets",          abbr: "WPG", id: 52 },
};

const LOGO_ABBR_OVERRIDE = { "los-angeles-kings": "LAK" };
const LOGO_URL = (slug, abbr) => `https://assets.nhle.com/logos/nhl/svg/${LOGO_ABBR_OVERRIDE[slug] || abbr}_${P.bg === LIGHT_PALETTE.bg ? "light" : "dark"}.svg`;
const COLLAPSED_W = 100;
const EXPANDED_W = 320;
const HEADER_H = 76;
const TABS_H = 48;

const DARK_PALETTE = {
  bg: "#17191D", surface: "#22262C", border: "#3B4149",
  dove: "#A7ADB5", casper: "#CDD3DA", white: "#E7EAF0", dim: "#88919C",
  hover: "#2C3239", active: "#29343C", accent: "#438BB7",
  red: "#F09389", yellow: "#DEC272", green: "#6FC9A4",
};

const LIGHT_PALETTE = {
  bg: "#F4F6F8", surface: "#FFFFFF", border: "#D5DBE2",
  dove: "#59616D", casper: "#46515E", white: "#20252B", dim: "#66717E",
  hover: "#EDF1F4", active: "#E4EEF2", accent: "#23668E",
  red: "#AC342C", yellow: "#816414", green: "#176D49",
};

// Mutable reference — App() updates this synchronously before rendering children
let P = { ...DARK_PALETTE };

// Module-level ref so PlayerCard (outside App) can trigger the modal in App()
let triggerPlayerLookup = null;

// Module-level standings lookup — updated by App() before render
let STANDINGS = {};

// ── Lineup change detection ────────────────────────────────────────────
// Builds a map of { playerName: newLineNumber } for players who moved lines
// since the last snapshot. Snapshot is keyed by UPDATED_AT date so it resets
// whenever the data is refreshed.
function buildLineChanges() {
  const SNAP_KEY = "lineup_snapshot";
  const changes = {}; // { "PLAYER NAME": newLineNum }

  try {
    const raw = localStorage.getItem(SNAP_KEY);
    const snap = raw ? JSON.parse(raw) : null;

    // Save/refresh snapshot when date changes or first visit
    if (!snap || snap.date !== UPDATED_AT) {
      const newSnap = { date: UPDATED_AT, teams: {} };
      Object.entries(TEAMS_DATA).forEach(([slug, d]) => {
        newSnap.teams[slug] = { forwards: d.forwards || [] };
      });
      localStorage.setItem(SNAP_KEY, JSON.stringify(newSnap));
      return changes; // no diff on first load
    }

    // Compare current forwards to snapshot
    Object.entries(TEAMS_DATA).forEach(([slug, d]) => {
      const prevFwds = snap.teams[slug]?.forwards || [];
      const currFwds = d.forwards || [];
      // Build previous line index for each player
      const prevLineOf = {};
      prevFwds.forEach((line, i) => line.forEach(p => { prevLineOf[p] = i + 1; }));
      // Check current line index
      currFwds.forEach((line, i) => {
        line.forEach(p => {
          const prev = prevLineOf[p];
          if (prev != null && prev !== i + 1) changes[p] = i + 1;
        });
      });
    });
  } catch (_) {}
  return changes;
}

const LINE_CHANGES = buildLineChanges();

function makeCss(palette) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${palette.bg}; height: 100%; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${palette.dim}; border-radius: 2px; }
  :focus-visible { outline: 2px solid ${palette.accent}; outline-offset: 3px; }
  .strip { flex-shrink:0; width:${COLLAPSED_W}px; transition:width 0.35s cubic-bezier(0.4,0,0.2,1),background 0.15s; overflow:hidden; cursor:pointer; border-right:1px solid ${palette.border}; position:relative; background:${palette.surface}; user-select:none; }
  .strip:last-child { border-right:none; }
  .strip:hover { background:${palette.hover}; }
  .strip.expanded { width:${EXPANDED_W}px; background:${palette.active}; }
  .strip.expanded:hover { background:${palette.active}; }
  .mobile-row { border-bottom:1px solid ${palette.border}; background:${palette.surface}; cursor:pointer; transition:background 0.15s; }
  .mobile-row:hover { background:${palette.hover}; }
  .mobile-row.open { background:${palette.active}; }
  .mobile-body { overflow:hidden; max-height:0; transition:max-height 0.35s cubic-bezier(0.4,0,0.2,1); }
  .mobile-body.open { max-height:2000px; }
  .tabs-bar::-webkit-scrollbar { display:none; }
  .tab-btn { background:none; border:none; cursor:pointer; font-family:'Syne',sans-serif; font-size:14px; font-weight:700; letter-spacing:0; padding:0 18px; height:100%; transition:color 0.15s,border-bottom 0.15s; border-bottom:2px solid transparent; flex-shrink:0; white-space:nowrap; }
  .tab-btn.active { color:${palette.white}; border-bottom-color:${palette.casper}; }
  .tab-btn:not(.active) { color:${palette.dove}; }
  .tab-btn:not(.active):hover { color:${palette.casper}; }
  .compare-chip { display:flex; align-items:center; gap:6px; background:${palette.surface}; border:1px solid ${palette.border}; border-radius:20px; padding:4px 10px 4px 6px; cursor:pointer; transition:border-color 0.15s; }
  .compare-chip:hover { border-color:${palette.dove}; }
  .compare-chip.selected { border-color:${palette.casper}; background:${palette.active}; }
  .rm-btn { background:none; border:none; cursor:pointer; color:${palette.dove}; font-size:14px; line-height:1; padding:0 0 0 4px; }
  .rm-btn:hover { color:${palette.white}; }
  .news-card { background:${palette.surface}; border:1px solid ${palette.border}; border-radius:6px; padding:12px 14px; margin-bottom:8px; }
  .news-card:hover { border-color:${palette.dove}; }
  .inj-badge { display:inline-block; font-size:12px; font-weight:700; letter-spacing:0; padding:2px 5px; border-radius:3px; margin-left:6px; vertical-align:middle; font-family:'Space Mono',monospace; }
  .inj-out { background:#c0392b22; color:#e74c3c; border:1px solid #c0392b44; }
  .inj-dtd { background:#d4ac0d22; color:#f1c40f; border:1px solid #d4ac0d44; }
  .inj-ir { background:#7d3c9822; color:#a569bd; border:1px solid #7d3c9844; }
  .ga-table { width:100%; border-collapse:collapse; font-size:14px; }
  .ga-table th { font-size:12px; font-weight:700; letter-spacing:0; color:${palette.dove}; padding:8px 6px; text-align:center; border-bottom:1px solid ${palette.border}; position:sticky; top:0; background:${palette.bg}; z-index:1; font-family:'Space Mono',monospace; }
  .ga-table th:first-child { text-align:left; padding-left:12px; }
  .ga-table td { padding:7px 6px; text-align:center; border-bottom:1px solid ${palette.border}; font-variant-numeric:tabular-nums; font-family:'Space Mono',monospace; }
  .ga-table td:first-child { text-align:left; padding-left:4px; }
  .ga-table tr:hover td { background:${palette.hover}; }
  .ga-table .total-col { font-weight:700; color:${palette.casper}; }
  .ga-sort-btn { background:none; border:none; cursor:pointer; font-family:'Space Mono',monospace; font-size:12px; font-weight:700; letter-spacing:0; color:${palette.dove}; padding:8px 6px; width:100%; text-align:center; }
  .ga-sort-btn:hover { color:${palette.casper}; }
  .ga-sort-btn.active-sort { color:${palette.white}; }
  .suggest-drop { position:absolute; top:calc(100% + 4px); left:0; right:0; background:${palette.surface}; border:1px solid ${palette.border}; border-radius:4px; z-index:100; overflow:hidden; }
  .suggest-item { padding:9px 12px; cursor:pointer; font-size:14px; color:${palette.casper}; font-family:'Space Grotesk',sans-serif; transition:background 0.1s; }
  .suggest-item:hover, .suggest-item.active { background:${palette.active}; color:${palette.white}; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width:14px; height:14px; border:2px solid ${palette.border}; border-top-color:${palette.casper}; border-radius:50%; animation:spin 0.7s linear infinite; }
  .player-card-clickable { cursor:pointer; transition:transform 0.15s,box-shadow 0.15s,border-color 0.15s; }
  .player-card-clickable:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.35); border-color:#B8C4CA !important; }
  @keyframes modalFadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes modalSlideUp { from { opacity:0; transform:translateY(24px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
  .modal-backdrop { position:fixed; inset:0; z-index:300; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(0,0,0,0.65); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); animation:modalFadeIn 0.18s ease; }
  .modal-card { width:100%; max-width:480px; border-radius:20px; overflow:hidden; position:relative; background:${palette.surface}; backdrop-filter:blur(40px) saturate(180%) brightness(1.08); -webkit-backdrop-filter:blur(40px) saturate(180%) brightness(1.08); border:1px solid ${palette.border}; box-shadow:0 32px 80px rgba(0,0,0,0.35),0 8px 32px rgba(0,0,0,0.2); animation:modalSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1); }
  .modal-card::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:linear-gradient(90deg,transparent,${palette.border},transparent); pointer-events:none; }
  .modal-close-btn { background:${palette.hover}; border:1px solid ${palette.border}; border-radius:50%; width:28px; height:28px; color:${palette.dove}; font-size:15px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.15s,color 0.15s; }
  .modal-close-btn:hover { background:${palette.active}; color:${palette.white}; }
  .modal-stats-row { transition:background 0.1s; }
  .modal-stats-row:hover td { background:rgba(255,255,255,0.04); }
  .header-title-text { font-size:22px; font-weight:800; color:${palette.white}; line-height:1.05; letter-spacing:0; font-family:'Syne',sans-serif; white-space:nowrap; }
  .header-center { display:flex; align-items:center; gap:16px; justify-content:center; }
  .header-logo { height:48px; object-fit:contain; filter:invert(1); flex-shrink:0; }
  .header-divider { width:1px; height:40px; background:${palette.border}; flex-shrink:0; }
  .header-sub { font-size:12px; color:${palette.dove}; letter-spacing:0; margin-top:4px; font-family:'Space Mono',monospace; white-space:nowrap; }
  @media (max-width:500px) { .header-logo { display:none; } .header-divider { display:none; } .header-title-text { font-size:18px; } }
  @media (max-width:360px) { .header-title-text { font-size:15px; letter-spacing:0; } }
`;
}

// ── Schedule parsing ──────────────────────────────────────────────────
const NAME_OVERRIDES = {
  "Vegas Golden Knights": "vegas-golden-knights",
  "Utah Mammoth": "utah-mammoth",
};

function nameToSlug(name) {
  if (NAME_OVERRIDES[name]) return NAME_OVERRIDES[name];
  const found = Object.entries(NHL_TEAMS).find(([, t]) =>
    `${t.city} ${t.name}`.toLowerCase() === name.toLowerCase() ||
    name.toLowerCase().includes(t.name.toLowerCase())
  );
  return found ? found[0] : null;
}

function useTodayGames() {
  const { games } = useSchedule();
  return useMemo(() => games.map(game => ({ away: abbrToSlug(game.awayTeam.abbrev), home: abbrToSlug(game.homeTeam.abbrev) })), [games]);
}

function abbrToSlug(abbr) {
  return Object.entries(NHL_TEAMS).find(([, t]) => t.abbr === abbr)?.[0] || null;
}

// ── Sub-components ────────────────────────────────────────────────────
function TeamLogo({ slug, abbr, size = 48 }) {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ width: size, height: size, borderRadius: 6, background: P.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.22, fontWeight: 800, color: P.white, flexShrink: 0 }}>{abbr}</div>;
  return <img src={LOGO_URL(slug, abbr)} alt={abbr} width={size} height={size} onError={() => setErr(true)} style={{ objectFit: "contain", flexShrink: 0 }} />;
}

const DATA_SEASON = seasonForDate(new Date(UPDATED_AT + 'T12:00:00Z'));
const RosterContext = createContext(null);

function useTeamRoster(team, enabled = true) {
  const [roster, setRoster] = useState({});
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setError(false);
    getJSON(`/api/roster?team=${team}&season=${DATA_SEASON}`, 3600000)
      .then(data => {
        const players = Object.fromEntries(data.players.map(player => [normalizeName(player.firstName + ' ' + player.lastName), { ...player, snapshot: true }]));
        if (active) setRoster({ team, players });
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [team, enabled]);
  return { roster, error };
}

function TeamBrowser() {
  const [slug, setSlug] = useState('vancouver-canucks');
  const [query, setQuery] = useState('');
  const team = NHL_TEAMS[slug];
  const { roster, error: rosterError } = useTeamRoster(team.abbr);
  const visible = Object.entries(NHL_TEAMS).filter(([, t]) => (t.city + ' ' + t.name + ' ' + t.abbr).toLowerCase().includes(query.toLowerCase()));
  return <main className="team-browser">
    <aside className="team-navigation" aria-label="Teams">
      <label className="team-search"><Search size={17} /><input aria-label="Search teams" placeholder="Find a team" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <select className="mobile-team-select" aria-label="Selected team" value={slug} onChange={event => setSlug(event.target.value)}>
        {Object.entries(NHL_TEAMS).map(([key, t]) => <option value={key} key={key}>{t.city} {t.name}</option>)}
      </select>
      <div className="team-list">{visible.map(([key, t]) => <button key={key} className={slug === key ? 'selected' : ''} aria-pressed={slug === key} onClick={() => setSlug(key)}>
        <TeamLogo slug={key} abbr={t.abbr} size={26} /><span>{t.city}<small>{t.name}</small></span><span className="team-abbr">{t.abbr}</span>
      </button>)}
      {!visible.length && <p className="data-state">No matching teams.</p>}</div>
    </aside>
    <section className="team-content">
      <header className="team-heading"><TeamLogo slug={slug} abbr={team.abbr} size={60} /><div><p className="muted">{seasonLabel(DATA_SEASON)} lineup snapshot</p><h1>{team.city} {team.name}</h1></div>
        {STANDINGS[team.abbr] && <div className="team-record"><span>Record as of {STANDINGS[team.abbr].date}</span><strong>{STANDINGS[team.abbr].record}</strong></div>}
      </header>
      <p className="snapshot-notice"><AlertCircle size={17} /> Observed {UPDATED_AT}. Lineups may have changed since this snapshot.</p>
      {rosterError && <p className="muted">Jersey numbers are temporarily unavailable.</p>}
      <RosterContext.Provider value={{ players: roster.team === team.abbr ? roster.players : {}, team: team.abbr }}>
        <div className="team-lineup"><LineupContent data={TEAMS_DATA[slug]} /></div>
      </RosterContext.Provider>
    </section>
  </main>;
}

function PlayerCard({ name, pos, lineChangedTo }) {
  const roster = useContext(RosterContext);
  const player = roster?.players[normalizeName(name)];
  const isGoalie = pos === 'STR' || pos === 'BKP';
  const parts = name.split(' ');
  const first = parts.slice(0, -1).join(' ');
  const last = parts.slice(-1)[0];
  const label = isGoalie ? 'G' : pos;
  return <button type="button" className="player-card-clickable player-tile"
    aria-label={`View ${name} statistics`}
    onClick={event => { event.stopPropagation(); triggerPlayerLookup?.(name, player); }}>
    {roster && <JerseyIcon team={roster.team} number={player?.number} />}
    <span className="player-name"><span>{first}</span><strong>{last}</strong></span>
    <span className="player-position">{label}</span>
    {lineChangedTo != null && <span className="line-change">Line {lineChangedTo}</span>}
  </button>;
}

function ForwardLine({ line, lineNum }) {
  const pos = line.length === 3 ? ["LW","C","RW"] : line.length === 2 ? ["C","RW"] : ["C"];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: P.casper, fontWeight: 700, letterSpacing: 0, marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>LINE {lineNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{line.map((p, i) => <PlayerCard key={i} name={p} pos={pos[i]} lineChangedTo={LINE_CHANGES[p] ?? null} />)}</div>
    </div>
  );
}

function DefensePair({ pair, pairNum }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: P.dove, fontWeight: 700, letterSpacing: 0, marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>PAIR {pairNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{pair.map((p, i) => <PlayerCard key={i} name={p} pos={i === 0 ? "LD" : "RD"} />)}</div>
    </div>
  );
}

function PPUnit({ unit, unitNum }) {
  if (!unit || unit.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#e67e22", fontWeight: 700, letterSpacing: 0, marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>PP{unitNum}</div>
      <div className="powerplay-grid">{unit.map((p, i) => <PlayerCard key={i} name={p} pos={`PP${unitNum}`} />)}</div>
    </div>
  );
}

function Divider({ label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: color || P.casper, letterSpacing: 0, whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: P.border }} />
    </div>
  );
}

function LineupContent({ data }) {
  const fwd = data.forwards || [], def = data.defense || [], gol = data.goalies || [];
  const pp1 = data.pp1 || [], pp2 = data.pp2 || [];
  return (
    <>
      <Divider label="FORWARDS" />
      {fwd.map((line, i) => <ForwardLine key={i} line={line} lineNum={i + 1} />)}
      <Divider label="DEFENSE" />
      {def.map((pair, i) => <DefensePair key={i} pair={pair} pairNum={i + 1} />)}
      {gol.length > 0 && (<><Divider label="GOALIES" /><div style={{ display: "flex", gap: 4 }}>{gol.map((g, i) => <PlayerCard key={i} name={g[0]} pos={i === 0 ? "STR" : "BKP"} />)}</div></>)}
      {(pp1.length > 0 || pp2.length > 0) && (
        <>
          <Divider label="POWER PLAY" color="#e67e22" />
          {pp1.length > 0 && <PPUnit unit={pp1} unitNum={1} />}
          {pp2.length > 0 && <PPUnit unit={pp2} unitNum={2} />}
        </>
      )}
    </>
  );
}

function TeamStrip({ slug, data, expanded, onToggle }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?" };
  const { roster } = useTeamRoster(t.abbr, expanded);
  return (
    <div className={`strip${expanded ? " expanded" : ""}`} onClick={onToggle}>
      <div style={{ position: "absolute", top: "40%", left: 0, width: COLLAPSED_W, transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: expanded ? 0 : 1, transition: "opacity 0.15s", pointerEvents: "none", padding: "0 10px" }}>
        <TeamLogo slug={slug} abbr={t.abbr} size={52} />
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 700, color: P.casper, letterSpacing: 0, whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif" }}>{t.city.toUpperCase()}</div>
      </div>
      <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s 0.15s", padding: "18px 20px", minWidth: EXPANDED_W, pointerEvents: expanded ? "auto" : "none", overflowY: "auto", maxHeight: `calc(100vh - ${HEADER_H + TABS_H}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${P.border}` }}>
          <TeamLogo slug={slug} abbr={t.abbr} size={48} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: P.white, lineHeight: 1.1, fontFamily: "'Syne', sans-serif" }}>{t.city}</div>
            <div style={{ fontSize: 12, color: P.dove, marginTop: 2 }}>{t.name}</div>
            {STANDINGS[t.abbr] && <div style={{ fontSize: 10, color: P.casper, marginTop: 4, fontFamily: "'Space Mono',monospace", letterSpacing: 0 }}>{STANDINGS[t.abbr].record}</div>}
          </div>
        </div>
        {expanded && <RosterContext.Provider value={{ players: roster.team === t.abbr ? roster.players : {}, team: t.abbr }}><LineupContent data={data} /></RosterContext.Provider>}
      </div>
    </div>
  );
}

function QuickScan() {
  const [expanded, setExpanded] = useState({});
  const slugs = Object.keys(TEAMS_DATA).sort((a, b) => NHL_TEAMS[a].city.localeCompare(NHL_TEAMS[b].city));
  const toggle = slug => setExpanded(current => ({ ...current, [slug]: !current[slug] }));
  return <div className="quick-scan" aria-label="Quick team scan">
    <div className="quick-scan-track">
      {slugs.map(slug => <TeamStrip key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />)}
    </div>
  </div>;
}

function TeamsView({ isMobile, mode }) {
  if (isMobile) return <TeamBrowser />;
  return <section className="teams-view">
    {mode === 'quick' ? <QuickScan /> : <TeamBrowser />}
  </section>;
}

function MobileRow({ slug, data, expanded, onToggle }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?" };
  return (
    <div className={`mobile-row${expanded ? " open" : ""}`}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}>
        <TeamLogo slug={slug} abbr={t.abbr} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: P.white, fontFamily: "'Syne', sans-serif" }}>{t.city}</div>
          <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
        </div>
        <div style={{ fontSize: 16, color: P.dove, lineHeight: 1, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>▾</div>
      </div>
      <div className={`mobile-body${expanded ? " open" : ""}`}>
        {expanded && STANDINGS[t.abbr] && (
          <div style={{ padding: "10px 20px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: P.dove, fontFamily: "'Space Mono',monospace", letterSpacing: 0 }}>RECORD</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: P.casper, fontFamily: "'Space Mono',monospace" }}>{STANDINGS[t.abbr].record}</span>
          </div>
        )}
        <div style={{ padding: "0 20px 24px" }}>{expanded && <LineupContent data={data} />}</div>
      </div>
    </div>
  );
}

// ── INJURIES VIEW ─────────────────────────────────────────────────────
function InjuryBadge({ type }) {
  const label = (type || "").toLowerCase();
  let cls = "inj-dtd";
  if (label.includes("out")) cls = "inj-out";
  else if (label.includes("ir") || label.includes("injured reserve")) cls = "inj-ir";
  else if (label.includes("day")) cls = "inj-dtd";
  return <span className={`inj-badge ${cls}`}>{type}</span>;
}

function InjuriesView({ isMobile }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const todayGames = useTodayGames();
  const todaySlugs = useMemo(() => {
    const s = new Set();
    todayGames.forEach(g => { s.add(g.away); s.add(g.home); });
    return s;
  }, [todayGames]);

  const displaySlugs = useMemo(() => {
    const allSlugsWithInjuries = Object.keys(INJURIES_DATA);
    const base = filter === "today" && todaySlugs.size > 0
      ? allSlugsWithInjuries.filter(s => todaySlugs.has(s))
      : allSlugsWithInjuries;
    return base.filter(slug => {
      if (!search.trim()) return true;
      const t = NHL_TEAMS[slug];
      return `${t?.city} ${t?.name} ${t?.abbr}`.toLowerCase().includes(search.toLowerCase());
    }).sort((a, b) => {
      const tA = NHL_TEAMS[a], tB = NHL_TEAMS[b];
      return (tA?.city || "").localeCompare(tB?.city || "");
    });
  }, [filter, todaySlugs, search]);

  const totalInjured = useMemo(() =>
    displaySlugs.reduce((sum, s) => sum + (INJURIES_DATA[s]?.length || 0), 0)
  , [displaySlugs]);

  return (
    <div style={{ padding: "16px 24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team..."
          style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: 160 }} />
        {todaySlugs.size > 0 && (
          <>
            <button onClick={() => setFilter("all")}
              style={{ background: filter === "all" ? P.active : "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: filter === "all" ? P.white : P.dove, fontSize: 10, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: 0 }}>
              ALL TEAMS
            </button>
            <button onClick={() => setFilter("today")}
              style={{ background: filter === "today" ? P.active : "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: filter === "today" ? P.white : P.dove, fontSize: 10, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: 0 }}>
              TODAY'S GAMES
            </button>
          </>
        )}
        <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto", letterSpacing: 0, fontFamily: "'Space Mono',monospace" }}>
          {totalInjured} PLAYER{totalInjured !== 1 ? "S" : ""} · {displaySlugs.length} TEAM{displaySlugs.length !== 1 ? "S" : ""}
        </span>
      </div>

      {displaySlugs.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: P.dove, fontSize: 12 }}>
          {Object.keys(INJURIES_DATA).length === 0
            ? "No injury data available — check back after the next data update."
            : "No injuries found matching your search."}
        </div>
      )}

      {displaySlugs.map(slug => {
        const t = NHL_TEAMS[slug];
        const players = INJURIES_DATA[slug] || [];
        return (
          <div key={slug} className="news-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${P.border}` }}>
              <TeamLogo slug={slug} abbr={t.abbr} size={28} />
              <span style={{ fontSize: 11, fontWeight: 700, color: P.white, fontFamily: "'Syne',sans-serif" }}>{t.city} {t.name}</span>
              <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto", fontFamily: "'Space Mono',monospace" }}>{players.length}</span>
            </div>
            {players.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: i < players.length - 1 ? `1px solid ${P.border}` : "none" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: P.dove, width: 28, fontFamily: "'Space Mono',monospace" }}>{p.pos}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: P.white, flex: 1 }}>{p.name}</span>
                <InjuryBadge type={p.status} />
                {p.desc && <span style={{ fontSize: 10, color: P.dove, marginLeft: 8 }}>{p.desc}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── COMPARE VIEW ──────────────────────────────────────────────────────
function CompareView({ isMobile }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const toggle = slug => setSelected(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  const filteredSlugs = useMemo(() => Object.keys(NHL_TEAMS).filter(slug => {
    const t = NHL_TEAMS[slug];
    return `${t.city} ${t.name} ${t.abbr}`.toLowerCase().includes(search.toLowerCase());
  }), [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: `calc(100vh - ${HEADER_H + TABS_H}px)` }}>
      <div style={{ borderBottom: `1px solid ${P.border}`, padding: "12px 24px", background: P.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter teams..."
            style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: 160 }} />
          {selected.length > 0 && <button onClick={() => setSelected([])} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.dove, fontSize: 10, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: 0 }}>CLEAR ALL</button>}
          <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto", fontFamily: "'Space Mono',monospace" }}>{selected.length} selected</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {filteredSlugs.map(slug => {
            const t = NHL_TEAMS[slug];
            const isSel = selected.includes(slug);
            return (
              <div key={slug} className={`compare-chip${isSel ? " selected" : ""}`} onClick={() => toggle(slug)}>
                <TeamLogo slug={slug} abbr={t.abbr} size={20} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isSel ? P.white : P.casper, whiteSpace: "nowrap" }}>{t.abbr}</span>
                {isSel && <button className="rm-btn" onClick={e => { e.stopPropagation(); toggle(slug); }}>×</button>}
              </div>
            );
          })}
        </div>
      </div>
      {selected.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 26, opacity: 0.15 }}>⬆</span>
          <span style={{ fontSize: 12, color: P.dove, letterSpacing: 0, fontFamily: "'Syne',sans-serif" }}>SELECT TEAMS ABOVE TO COMPARE</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ display: "flex", height: "100%", minWidth: selected.length * (EXPANDED_W + 1) }}>
            {selected.map((slug, i) => {
              const t = NHL_TEAMS[slug];
              return (
                <div key={slug} style={{ width: EXPANDED_W, flexShrink: 0, borderRight: i < selected.length - 1 ? `1px solid ${P.border}` : "none", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "14px 20px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, background: P.surface, position: "sticky", top: 0 }}>
                    <TeamLogo slug={slug} abbr={t.abbr} size={40} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: P.white, fontFamily: "'Syne',sans-serif" }}>{t.city}</div>
                      <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
                    </div>
                    <button className="rm-btn" style={{ marginLeft: "auto", fontSize: 16 }} onClick={() => toggle(slug)}>×</button>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 24px" }}>
                    <LineupContent data={TEAMS_DATA[slug]} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TODAY VIEW ────────────────────────────────────────────────────────
function TodayView() {
  const [date, setDate] = useState(localDate());
  const { games, loading, error } = useSchedule(date);
  const [open, setOpen] = useState({});
  return <main className="schedule-page">
    <header className="schedule-heading"><h1>Schedule</h1><label>Date<input type="date" aria-label="Schedule date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label></header>
    {loading && <p className="data-state" role="status">Loading schedule...</p>}
    {error && <p className="data-state" role="alert">{error}</p>}
    {!loading && !error && !games.length && <p className="data-state">No games scheduled for {date}.</p>}
    {games.map(game => <article className="schedule-game" key={game.id}>
      <div className="schedule-game-header">
        <div className="matchup-teams">{[game.awayTeam, game.homeTeam].map(team => <div key={team.abbrev}>
          <TeamLogo slug={abbrToSlug(team.abbrev)} abbr={team.abbrev} size={36} /><strong>{team.abbrev}</strong><span>{team.score ?? '-'}</span>
        </div>)}</div>
        <div className="matchup-status"><span>{['FINAL', 'OFF'].includes(game.gameState) ? 'Final' : game.gameState === 'LIVE' || game.gameState === 'CRIT' ? 'Live' : new Date(game.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</span>
          <small>{game.gameType === 1 ? 'Preseason' : game.gameType === 3 ? 'Playoffs' : 'Regular season'}</small>
          <button className="text-button" aria-expanded={!!open[game.id]} onClick={() => setOpen(value => ({ ...value, [game.id]: !value[game.id] }))}>{open[game.id] ? 'Close lineups' : 'Lineups'}</button>
        </div>
      </div>
      {open[game.id] && <><p className="snapshot-notice">Lineup snapshot: {UPDATED_AT}. Not confirmed for this game.</p><div className="matchup-lineups">{[game.awayTeam, game.homeTeam].map(team => <section key={team.abbrev}><h2>{team.abbrev}</h2>{TEAMS_DATA[abbrToSlug(team.abbrev)] ? <LineupContent data={TEAMS_DATA[abbrToSlug(team.abbrev)]} /> : <p>No lineup available.</p>}</section>)}</div></>}
    </article>)}
  </main>;
}

function PicksView() {
  const [date, setDate] = useState(localDate());
  const { games, loading, error } = useSchedule(date);
  const positions = ['C', 'LW', 'RW', 'D'];
  return <main className="picks-page">
    <header className="schedule-heading"><div><h1>Picks</h1><p className="muted">Matchup signals from last season's goals allowed by position.</p></div><label>Date<input type="date" aria-label="Picks date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label></header>
    {loading && <p className="data-state" role="status">Loading matchups...</p>}
    {error && <p className="data-state" role="alert">{error}</p>}
    {!loading && !error && !games.length && <p className="data-state">No games scheduled for {date}.</p>}
    <div className="picks-list">{games.map(game => <article className="pick-matchup" key={game.id}>
      <header><div><TeamLogo slug={abbrToSlug(game.awayTeam.abbrev)} abbr={game.awayTeam.abbrev} size={28} /><strong>{game.awayTeam.abbrev}</strong><span>AT</span><TeamLogo slug={abbrToSlug(game.homeTeam.abbrev)} abbr={game.homeTeam.abbrev} size={28} /><strong>{game.homeTeam.abbrev}</strong></div><time>{new Date(game.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></header>
      <div className="pick-sides">{[
        { offense: game.awayTeam.abbrev, defense: game.homeTeam.abbrev },
        { offense: game.homeTeam.abbrev, defense: game.awayTeam.abbrev },
      ].map(side => {
        const allowed = GA_DATA.teams?.[side.defense]?.l10 || {};
        const ranked = positions.map(position => ({ position, value: allowed[position] || 0 })).sort((a, b) => b.value - a.value);
        return <section key={side.offense}><p>{side.offense} VS {side.defense}</p><strong className="pick-watch">WATCH {ranked[0]?.position || '—'}</strong>
          <div>{ranked.map(item => <span key={item.position}><b>{item.position}</b>{item.value} GA</span>)}</div>
        </section>;
      })}</div>
    </article>)}</div>
  </main>;
}

// ── PLAYOFFS VIEW ─────────────────────────────────────────────────────
function PlayoffsView({ isMobile }) {
  const [expandedSeries, setExpandedSeries] = useState(null);
  const { series, round1East, round1West, round2East, round2West, confFinals, final } = BRACKET_DATA;

  function fmtDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function SeriesCard({ seriesId }) {
    const ser = series[seriesId];
    if (!ser) return null;
    const isExp = expandedSeries === seriesId;
    const isLive = ser.status === "in-progress";
    const isDone = ser.status === "final";
    const isUpcoming = ser.status === "upcoming";
    const topSlug = abbrToSlug(ser.topSeed);
    const botSlug = abbrToSlug(ser.bottomSeed);
    const nextGame = ser.games?.find(g => g.state === "scheduled");
    const gameNum = (ser.topWins + ser.bottomWins) + 1;

    if (isUpcoming && ser.topSeed === "TBD") {
      return (
        <div style={{ padding: "14px 16px", background: P.surface, border: `1px solid ${P.border}`, borderRadius: 6, opacity: 0.4 }}>
          <span style={{ fontSize: 10, color: P.dove, fontFamily: "'Space Mono',monospace", letterSpacing: 0 }}>TO BE DETERMINED</span>
        </div>
      );
    }

    return (
      <div onClick={() => setExpandedSeries(isExp ? null : seriesId)}
        style={{ background: P.surface, border: `1px solid ${isLive ? P.accent : P.border}`, borderRadius: 6, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s" }}>
        {/* Matchup row */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            {topSlug && <TeamLogo slug={topSlug} abbr={ser.topSeed} size={28} />}
            <span style={{ fontSize: 12, fontWeight: 700, color: isDone && ser.winnerAbbr === ser.topSeed ? P.white : P.casper, fontFamily: "'Syne',sans-serif" }}>{ser.topSeed}</span>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: P.white, fontFamily: "'Space Mono',monospace", minWidth: 18, textAlign: "right" }}>{ser.topWins}</span>
              <span style={{ fontSize: 10, color: P.dim }}>—</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: P.white, fontFamily: "'Space Mono',monospace", minWidth: 18, textAlign: "left" }}>{ser.bottomWins}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isDone && ser.winnerAbbr === ser.bottomSeed ? P.white : P.casper, fontFamily: "'Syne',sans-serif" }}>{ser.bottomSeed}</span>
            {botSlug && <TeamLogo slug={botSlug} abbr={ser.bottomSeed} size={28} />}
          </div>
        </div>
        {/* Status + expand toggle */}
        <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontFamily: "'Space Mono',monospace", color: isLive ? P.casper : P.dove }}>
            {isLive && nextGame && `GAME ${nextGame.gameNumber} · ${fmtDate(nextGame.date)}`}
            {isLive && !nextGame && "IN PROGRESS"}
            {isDone && `${ser.winnerAbbr} WINS IN ${ser.topWins + ser.bottomWins}`}
          </span>
          <span style={{ fontSize: 10, color: P.dim, fontFamily: "'Space Mono',monospace" }}>{isExp ? "▲" : "▼"} GAMES</span>
        </div>
        {/* Game-by-game (expanded) */}
        {isExp && (
          <div style={{ borderTop: `1px solid ${P.border}` }}>
            {ser.games.map(g => (
              <div key={g.gameNumber} style={{ display: "flex", alignItems: "center", padding: "7px 16px", gap: 10, borderBottom: `1px solid ${P.border}`, opacity: g.state === "scheduled" ? 0.4 : 1 }}>
                <span style={{ fontSize: 10, color: P.dove, fontFamily: "'Space Mono',monospace", minWidth: 20 }}>G{g.gameNumber}</span>
                <span style={{ fontSize: 10, color: P.dim, fontFamily: "'Space Mono',monospace", flex: 1 }}>{fmtDate(g.date)} · {g.homeAbbr} HOME</span>
                {g.state !== "scheduled"
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: P.white, fontFamily: "'Space Mono',monospace" }}>
                      {g.homeScore}–{g.awayScore}{g.state === "final-ot" ? " OT" : g.state === "final-2ot" ? " 2OT" : ""}
                    </span>
                  : <span style={{ fontSize: 10, color: P.dim, fontFamily: "'Space Mono',monospace" }}>{g.time}</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function RoundLabel({ label, color }) {
    return <div style={{ fontSize: 10, fontWeight: 700, color: color || P.dove, letterSpacing: 0, marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>{label}</div>;
  }

  function ConferenceBlock({ label, r1Ids, r2Ids, cfId }) {
    return (
      <div style={{ marginBottom: isMobile ? 32 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#e67e22", letterSpacing: 0, marginBottom: 16, fontFamily: "'Syne',sans-serif" }}>{label}</div>
        <RoundLabel label="SECOND ROUND" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {r2Ids.map(id => <SeriesCard key={id} seriesId={id} />)}
        </div>
        <RoundLabel label="FIRST ROUND" />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6, marginBottom: 20 }}>
          {r1Ids.map(id => <SeriesCard key={id} seriesId={id} />)}
        </div>
        <RoundLabel label="CONFERENCE FINAL" />
        <SeriesCard seriesId={cfId} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${P.border}` }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: P.white, fontFamily: "'Syne',sans-serif", letterSpacing: 0 }}>2026 NHL PLAYOFFS</div>
          <div style={{ fontSize: 10, color: P.dove, marginTop: 4, fontFamily: "'Space Mono',monospace", letterSpacing: 0 }}>SNAPSHOT · UPDATED {BRACKET_DATA.updatedAt}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 32, marginBottom: 32 }}>
        <ConferenceBlock label="EASTERN CONFERENCE" r1Ids={round1East} r2Ids={round2East} cfId={confFinals[0]} />
        <ConferenceBlock label="WESTERN CONFERENCE" r1Ids={round1West} r2Ids={round2West} cfId={confFinals[1]} />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: P.yellow, letterSpacing: 0, marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>STANLEY CUP FINAL</div>
        <SeriesCard seriesId={final} />
      </div>
    </div>
  );
}

// ── IIHF VIEW ──────────────────────────────────────────────────────────
const IIHF_FLAG = {
  SUI:'ch', FIN:'fi', USA:'us', GER:'de', LAT:'lv', AUT:'at', HUN:'hu', GBR:'gb',
  CZE:'cz', CAN:'ca', SWE:'se', DEN:'dk', SVK:'sk', NOR:'no', SLO:'si', ITA:'it',
};
const iihfFlagUrl = code => `https://flagcdn.com/w40/${IIHF_FLAG[code] || 'xx'}.png`;

function IIHFRosterModal({ code, name, onClose }) {
  const roster = IIHF_ROSTERS[code] || { players: [] };
  const forwards = roster.players.filter(p => p.pos === 'F');
  const defense  = roster.players.filter(p => p.pos === 'D');
  const goalies  = roster.players.filter(p => p.pos === 'G' || p.pos === 'GK');

  const overlayStyle = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const modalStyle = {
    background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10,
    width: "100%", maxWidth: 520, maxHeight: "82vh", overflowY: "auto",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  };
  const sectionLabel = { fontSize: 10, fontWeight: 700, letterSpacing: 0, color: P.dove,
    fontFamily: "'Space Mono',monospace", padding: "10px 16px 4px", borderTop: `1px solid ${P.border}` };
  const playerRow = { display: "flex", alignItems: "center", gap: 10, padding: "6px 16px",
    borderBottom: `1px solid ${P.border}22` };
  const numStyle = { fontSize: 10, fontWeight: 700, color: P.casper, fontFamily: "'Space Mono',monospace",
    width: 28, textAlign: "right", flexShrink: 0 };
  const nameStyle = { fontSize: 12, color: P.white, fontFamily: "'Space Mono',monospace", flex: 1 };
  const clubStyle = { fontSize: 10, color: P.dove, fontFamily: "'Space Mono',monospace", textAlign: "right" };

  function Section({ label, players }) {
    if (!players.length) return null;
    return (
      <>
        <div style={sectionLabel}>{label}</div>
        {players.map(p => (
          <div key={p.num + p.name} style={playerRow}>
            <span style={numStyle}>#{p.num}</span>
            <span style={nameStyle}>{p.name}</span>
            <span style={clubStyle}>{p.club}</span>
          </div>
        ))}
      </>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          borderBottom: `1px solid ${P.border}`, position: "sticky", top: 0, background: P.surface, zIndex: 1 }}>
          <img src={iihfFlagUrl(code)} alt={code} width={28} height={21} style={{ borderRadius: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: P.white, fontFamily: "'Syne',sans-serif", letterSpacing: 0 }}>{name}</div>
            <div style={{ fontSize: 10, color: P.dove, fontFamily: "'Space Mono',monospace", letterSpacing: 0 }}>
              {forwards.length}F · {defense.length}D · {goalies.length}G
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none",
            color: P.dove, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <Section label="FORWARDS" players={forwards} />
        <Section label="DEFENCE" players={defense} />
        <Section label="GOALIES" players={goalies} />
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function IIHFView({ isMobile }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayGames = IIHF_SCHEDULE_DATA.games.filter(g => g.date === todayStr);
  const [openRoster, setOpenRoster] = useState(null);

  const thS = { fontSize: 10, fontWeight: 700, letterSpacing: 0, color: P.dove, padding: "8px 6px", textAlign: "center", borderBottom: `1px solid ${P.border}`, fontFamily: "'Space Mono',monospace", background: P.bg };
  const tdS = { padding: "7px 6px", textAlign: "center", fontSize: 12, fontFamily: "'Space Mono',monospace", color: P.white, borderBottom: `1px solid ${P.border}` };
  const codeBadge = { display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: 0, padding: "2px 5px", borderRadius: 3, background: P.dim, color: P.casper, fontFamily: "'Space Mono',monospace" };

  function GroupTable({ groupKey }) {
    const teams = IIHF_GROUPS_DATA.groups[groupKey] || [];
    return (
      <div style={{ marginBottom: isMobile ? 20 : 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: P.casper, letterSpacing: 0, marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>GROUP {groupKey}</div>
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thS, textAlign: "left", paddingLeft: 12 }}>NATION</th>
                <th style={thS}>GP</th>
                <th style={thS}>W</th>
                {!isMobile && <><th style={thS}>OTW</th><th style={thS}>OTL</th></>}
                <th style={thS}>L</th>
                {!isMobile && <><th style={thS}>GF</th><th style={thS}>GA</th></>}
                <th style={{ ...thS, color: P.casper }}>PTS</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.code} style={{ background: i % 2 === 0 ? "transparent" : `${P.bg}66` }}>
                  <td style={{ ...tdS, textAlign: "left", paddingLeft: 10 }}>
                    <img src={iihfFlagUrl(t.code)} alt={t.code} width={20} height={15} style={{ verticalAlign: "middle", borderRadius: 2, marginRight: 6, display: "inline-block" }} />
                    <span style={codeBadge}>{t.code}</span>
                    {!isMobile && <span style={{ color: P.casper, fontSize: 12, marginLeft: 4 }}>{t.name}</span>}
                  </td>
                  <td style={tdS}>{t.gp}</td>
                  <td style={tdS}>{t.w}</td>
                  {!isMobile && <><td style={tdS}>{t.otw}</td><td style={tdS}>{t.otl}</td></>}
                  <td style={tdS}>{t.l}</td>
                  {!isMobile && <><td style={tdS}>{t.gf}</td><td style={tdS}>{t.ga}</td></>}
                  <td style={{ ...tdS, fontWeight: 700, color: P.casper }}>{t.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // All 16 teams ordered by group then standings rank
  const allTeams = [
    ...IIHF_GROUPS_DATA.groups.A,
    ...IIHF_GROUPS_DATA.groups.B,
  ];

  return (
    <div style={{ padding: "16px 24px", maxWidth: 900, margin: "0 auto" }}>
      {openRoster && (
        <IIHFRosterModal
          code={openRoster.code}
          name={openRoster.name}
          onClose={() => setOpenRoster(null)}
        />
      )}

      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${P.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: P.white, fontFamily: "'Syne',sans-serif", letterSpacing: 0 }}>2026 IIHF WORLD CHAMPIONSHIP</div>
        <div style={{ fontSize: 10, color: P.dove, marginTop: 4, fontFamily: "'Space Mono',monospace", letterSpacing: 0 }}>
          {IIHF_GROUPS_DATA.location} · {IIHF_GROUPS_DATA.dates}
        </div>
      </div>

      {todayGames.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: P.casper, letterSpacing: 0, marginBottom: 10, fontFamily: "'Syne',sans-serif" }}>TODAY'S GAMES</div>
          {todayGames.map(g => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: P.surface, border: `1px solid ${P.border}`, borderRadius: 6, marginBottom: 6 }}>
              <span style={{ ...codeBadge, marginRight: 0 }}>GRP {g.group}</span>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                <img src={iihfFlagUrl(g.away)} alt={g.away} width={20} height={15} style={{ verticalAlign: "middle", borderRadius: 2 }} />
                <span style={codeBadge}>{g.away}</span>
                {g.awayScore != null && <span style={{ fontSize: 13, fontWeight: 700, color: P.white, fontFamily: "'Space Mono',monospace" }}>{g.awayScore}</span>}
                <span style={{ fontSize: 10, color: P.dim }}>@</span>
                {g.homeScore != null && <span style={{ fontSize: 13, fontWeight: 700, color: P.white, fontFamily: "'Space Mono',monospace" }}>{g.homeScore}</span>}
                <img src={iihfFlagUrl(g.home)} alt={g.home} width={20} height={15} style={{ verticalAlign: "middle", borderRadius: 2 }} />
                <span style={codeBadge}>{g.home}</span>
              </div>
              <span style={{ fontSize: 10, fontFamily: "'Space Mono',monospace", color: g.state === "scheduled" ? P.casper : P.dove }}>
                {g.state === "final" ? "FINAL" : g.state === "final-ot" ? "FINAL/OT" : g.time}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 0 : 24, marginBottom: 28 }}>
        <GroupTable groupKey="A" />
        <GroupTable groupKey="B" />
      </div>

      {/* Team roster cards */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: P.casper, letterSpacing: 0, marginBottom: 12, fontFamily: "'Syne',sans-serif" }}>
          ROSTERS — TAP A TEAM
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(4,1fr)" : "repeat(8,1fr)", gap: 8 }}>
          {allTeams.map(t => {
            const roster = IIHF_ROSTERS[t.code] || { players: [] };
            const count = roster.players.length;
            return (
              <button
                key={t.code}
                onClick={() => setOpenRoster({ code: t.code, name: t.name })}
                style={{
                  background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8,
                  padding: "10px 4px", cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 5, transition: "border-color 0.15s, background 0.15s",
                  position: "relative",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = P.casper; e.currentTarget.style.background = `${P.casper}12`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.background = P.surface; }}
              >
                <img src={iihfFlagUrl(t.code)} alt={t.code} width={32} height={24} style={{ borderRadius: 3, display: "block" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: P.white, fontFamily: "'Space Mono',monospace", letterSpacing: 0 }}>{t.code}</span>
                <span style={{ fontSize: 10, color: P.dove, fontFamily: "'Space Mono',monospace" }}>{count}P</span>
                <span style={{ position: "absolute", top: 5, right: 6, fontSize: 10, color: P.casper, lineHeight: 1 }}>›</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 10, color: P.dim, textAlign: "center", fontFamily: "'Space Mono',monospace", letterSpacing: 0, marginTop: 16 }}>
        POINT SYSTEM: W=3 · OTW=2 · OTL=1 · L=0 · UPDATED {IIHF_GROUPS_DATA.updatedAt}
      </div>
    </div>
  );
}

// ── GOALS AGAINST BY POSITION VIEW ───────────────────────────────────
function heatColor(value, min, max) {
  if (max === min) return "transparent";
  const ratio = (value - min) / (max - min);
  if (ratio < 0.5) {
    const t = ratio / 0.5;
    const r = Math.round(30 + t * 182);
    const g = Math.round(132 - t * 0);
    const b = Math.round(73 - t * 60);
    return `rgba(${r},${g},${b},0.18)`;
  } else {
    const t = (ratio - 0.5) / 0.5;
    const r = Math.round(212 - t * 20);
    const g = Math.round(132 - t * 75);
    const b = Math.round(13 + t * 0);
    return `rgba(${r},${g},${b},0.18)`;
  }
}

function GoalsAgainstView({ isMobile }) {
  const [duration, setDuration] = useState("ytd");
  const [location, setLocation] = useState("all");
  const [sortCol, setSortCol] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState("all");

  const todayGames = useTodayGames();
  const todayAbbrs = useMemo(() => {
    const s = new Set();
    todayGames.forEach(g => {
      const aw = NHL_TEAMS[g.away]?.abbr;
      const hw = NHL_TEAMS[g.home]?.abbr;
      if (aw) s.add(aw);
      if (hw) s.add(hw);
    });
    return s;
  }, [todayGames]);

  const splitKey = duration === "l10" ? "l10" : (location === "home" ? "home" : location === "away" ? "away" : "ytd");
  const totalKey = duration === "l10" ? "l10Total" : (location === "home" ? "homeTotal" : location === "away" ? "awayTotal" : "ytdTotal");
  const positions = GA_DATA.positions || ["C", "LW", "RW", "D"];

  const rows = useMemo(() => {
    const teams = GA_DATA.teams || {};
    return Object.entries(teams)
      .filter(([abbr]) => {
        if (viewFilter === "today" && todayAbbrs.size > 0 && !todayAbbrs.has(abbr)) return false;
        if (!search.trim()) return true;
        const slug = abbrToSlug(abbr);
        const t = slug ? NHL_TEAMS[slug] : null;
        return t ? `${t.city} ${t.name} ${abbr}`.toLowerCase().includes(search.toLowerCase()) : abbr.toLowerCase().includes(search.toLowerCase());
      })
      .map(([abbr, data]) => ({
        abbr,
        slug: abbrToSlug(abbr),
        ...data[splitKey],
        total: data[totalKey],
      }))
      .sort((a, b) => {
        if (sortCol === "abbr") return sortDir === "asc" ? a.abbr.localeCompare(b.abbr) : b.abbr.localeCompare(a.abbr);
        const aVal = sortCol === "total" ? a.total : (a[sortCol] || 0);
        const bVal = sortCol === "total" ? b.total : (b[sortCol] || 0);
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [splitKey, totalKey, sortCol, sortDir, search, viewFilter, todayAbbrs]);

  const colRanges = useMemo(() => {
    const ranges = {};
    positions.forEach(pos => {
      const vals = Object.values(GA_DATA.teams).map(r => r[splitKey]?.[pos] || 0);
      ranges[pos] = { min: Math.min(...vals), max: Math.max(...vals) };
    });
    const totals = Object.values(GA_DATA.teams).map(r => r[totalKey] || 0);
    ranges.total = { min: Math.min(...totals), max: Math.max(...totals) };
    return ranges;
  }, [splitKey, totalKey]);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };
  const sortArrow = col => sortCol === col ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  const filterBtn = (label, value, setter, current) => (
    <button onClick={() => setter(value)}
      style={{ background: current === value ? P.active : "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: current === value ? P.white : P.dove, fontSize: 10, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: 0 }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: "16px 24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team..."
          style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: 140 }} />
        <div style={{ width: 1, height: 20, background: P.border, margin: "0 4px" }} />
        {filterBtn("YTD", "ytd", setDuration, duration)}
        {filterBtn("L10", "l10", setDuration, duration)}
        {duration === "ytd" && (
          <>
            <div style={{ width: 1, height: 20, background: P.border, margin: "0 4px" }} />
            {filterBtn("ALL", "all", setLocation, location)}
            {filterBtn("HOME", "home", setLocation, location)}
            {filterBtn("AWAY", "away", setLocation, location)}
          </>
        )}
        {todayAbbrs.size > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: P.border, margin: "0 4px" }} />
            {filterBtn("ALL TEAMS", "all", setViewFilter, viewFilter)}
            {filterBtn("TODAY", "today", setViewFilter, viewFilter)}
          </>
        )}
        <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto", letterSpacing: 0, fontFamily: "'Space Mono',monospace" }}>
          UPDATED {GA_DATA.lastUpdated || "—"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: P.dove, letterSpacing: 0, fontFamily: "'Space Mono',monospace" }}>GOALS AGAINST BY SCORER POSITION ({GA_DATA.season})</span>
        <span style={{ fontSize: 10, color: P.dim }}>·</span>
        <span style={{ fontSize: 10, color: P.dove, letterSpacing: 0, fontFamily: "'Space Mono',monospace" }}>
          {duration === "l10" ? "LAST 10 GAMES" : location === "home" ? "HOME GAMES" : location === "away" ? "AWAY GAMES" : "FULL SEASON"}
        </span>
      </div>
      <div style={{ overflowX: "auto", background: P.surface, borderRadius: 6, border: `1px solid ${P.border}` }}>
        <table className="ga-table">
          <thead>
            <tr>
              <th style={{ width: isMobile ? 60 : 160, minWidth: isMobile ? 60 : 160 }}>
                <button className={`ga-sort-btn${sortCol === "abbr" ? " active-sort" : ""}`} style={{ textAlign: "left", paddingLeft: 12 }}
                  onClick={() => { setSortCol("abbr"); setSortDir(d => d === "asc" ? "desc" : "asc"); }}>
                  TEAM{sortCol === "abbr" ? sortArrow("abbr") : ""}
                </button>
              </th>
              {positions.map(pos => (
                <th key={pos}>
                  <button className={`ga-sort-btn${sortCol === pos ? " active-sort" : ""}`} onClick={() => handleSort(pos)}>
                    {pos}{sortArrow(pos)}
                  </button>
                </th>
              ))}
              <th>
                <button className={`ga-sort-btn${sortCol === "total" ? " active-sort" : ""}`} onClick={() => handleSort("total")}>
                  TOTAL{sortArrow("total")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const t = row.slug ? NHL_TEAMS[row.slug] : null;
              return (
                <tr key={row.abbr}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                      {row.slug && <TeamLogo slug={row.slug} abbr={row.abbr} size={22} />}
                      {!isMobile && <span style={{ fontSize: 12, fontWeight: 600, color: P.white }}>{t ? t.city : row.abbr}</span>}
                      {isMobile && <span style={{ fontSize: 12, fontWeight: 700, color: P.casper, fontFamily: "'Space Mono',monospace" }}>{row.abbr}</span>}
                    </div>
                  </td>
                  {positions.map(pos => {
                    const val = row[pos] || 0;
                    const range = colRanges[pos];
                    return (
                      <td key={pos} style={{ background: heatColor(val, range.min, range.max), color: P.white, fontWeight: 500 }}>
                        {val}
                      </td>
                    );
                  })}
                  <td className="total-col" style={{ background: heatColor(row.total, colRanges.total.min, colRanges.total.max) }}>
                    {row.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: P.dim, letterSpacing: 0, textAlign: "center", fontFamily: "'Space Mono',monospace" }}>
        POSITION DATA FROM NHL.COM ROSTERS · HIGHER VALUES = MORE GOALS ALLOWED TO THAT POSITION
      </div>
    </div>
  );
}

// ── PLAYER STATS VIEW ─────────────────────────────────────────────────
function formatTOI(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PlayerStatsView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setResults([]); setError('');
    if (query.trim().length < 3) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      getJSON(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=15&q=${encodeURIComponent(query.trim())}`)
        .then(data => {
          if (!Array.isArray(data)) throw new Error('Player search is temporarily unavailable.');
          if (active) setResults(data.map(p => {
            const parts = p.name.split(' ');
            return { id: String(p.playerId), firstName: parts.shift(), lastName: parts.join(' '), pos: p.positionCode, team: p.teamAbbrev };
          }));
        }).catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const featured = ['vancouver-canucks', 'edmonton-oilers', 'colorado-avalanche'].flatMap(slug =>
    (TEAMS_DATA[slug]?.forwards?.[0] || []).map(name => {
      const parts = name.split(' ');
      return { firstName: parts.shift(), lastName: parts.join(' '), team: NHL_TEAMS[slug].abbr, snapshot: true };
    }));
  const players = query.trim().length >= 3 ? results : featured;
  return <main className="player-search-page">
    <h1>Players</h1>
    <label className="team-search"><Search size={18} /><input aria-label="Search players" placeholder="Search players" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {loading && <p className="data-state" role="status">Searching players...</p>}
    {error && <p className="data-state" role="alert">{error}</p>}
    {!loading && !error && <div className="player-results">
      {query.trim().length < 3 && <p className="muted">From the {seasonLabel(DATA_SEASON)} lineup archive</p>}
      {players.map(player => <button key={player.id || player.firstName + player.lastName} onClick={() => triggerPlayerLookup?.(player.firstName + ' ' + player.lastName, player)}>
        <span>{player.firstName} {player.lastName}</span><small>{player.pos} {player.team}</small>
      </button>)}
      {!players.length && <p className="data-state">No matching players.</p>}
    </div>}
  </main>;
}

// ── ERROR BOUNDARY ────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 24px", textAlign: "center", color: P.dove, fontFamily: "'Space Grotesk',sans-serif" }}>
          <div style={{ fontSize: 11, marginBottom: 8 }}>Something went wrong loading this view.</div>
          <button onClick={() => this.setState({ hasError: false })} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 14px", color: P.casper, cursor: "pointer", fontSize: 12, fontFamily: "'Space Mono',monospace" }}>RETRY</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── ROOT ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('all');
  const [teamMode, setTeamMode] = useState('quick');
  const [showIntro, setShowIntro] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isDark, setIsDark] = useState(() => {
    try { const saved = localStorage.getItem('theme'); return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch { return true; }
  });
  const [standingsError, setStandingsError] = useState(false);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);
  const toggleTheme = () => { setIsDark(value => { const next = !value; try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {} return next; }); };
  const [modal, setModal] = useState(null); // { player, gamelog, loading, error }
  const [standings, setStandings] = useState({}); // { [abbr]: "W-L-OT" }

  useEffect(() => {
    if (!showIntro) return undefined;
    const timer = window.setTimeout(() => setShowIntro(false), 1700);
    return () => window.clearTimeout(timer);
  }, [showIntro]);

  // Synchronously update P before children render so all components see the correct palette
  Object.assign(P, isDark ? DARK_PALETTE : LIGHT_PALETTE);
  Object.assign(STANDINGS, standings);

  // Wire up the module-level ref so PlayerCard can trigger the modal
  triggerPlayerLookup = useCallback((fullName, knownPlayer) => {
    const parts = fullName.trim().split(' ');
    setModal({ player: knownPlayer || { firstName: parts.shift(), lastName: parts.join(' '), pos: '', id: null }, season: DATA_SEASON });
  }, []);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    getJSON("/api/standings")
      .then(data => {
        if (!Array.isArray(data)) return;
        const map = {};
        data.forEach(t => { if (t.teamAbbrev) map[t.teamAbbrev] = { record: `${t.wins}-${t.losses}-${t.otLosses}`, date: t.date }; });
        setStandings(map);
      })
      .catch(() => setStandingsError(true));
  }, []);

  const TABS = ["all", "today", "injuries", "player", "picks", "playoffs", "stats", "compare"];
  const TAB_LABELS = { all: "TEAMS", today: "TODAY", injuries: "INJURIES", player: "PLAYERS", picks: "PICKS", playoffs: "PLAYOFFS", stats: "MATCHUPS", compare: "COMPARE" };

  return (
    <div className="app-shell" data-theme={isDark ? 'dark' : 'light'} style={{ fontFamily: "'Space Grotesk', sans-serif", background: P.bg, minHeight: "100vh", color: P.white, ...Object.fromEntries(Object.entries(P).map(([key, value]) => ['--' + key, value])) }}>
      <style>{makeCss(isDark ? DARK_PALETTE : LIGHT_PALETTE)}</style>

      {showIntro && <div className="brand-intro" aria-hidden="true">
        <span className="brand-intro-line" />
        <div className="brand-intro-lockup"><img src="/logo.png" alt="" /><strong>BETWEEN THE LINES</strong></div>
        <span className="brand-intro-line" />
      </div>}

      {/* Header */}
      <div className="app-header" style={{ borderTop: `3px solid ${P.casper}`, borderBottom: `1px solid ${P.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", height: HEADER_H, position: "sticky", top: 0, zIndex: 50, background: P.bg }}>
        <div className="header-center">
          <img src="/logo.png" alt="Himank Goel" className="header-logo" />
          <div className="header-divider" />
          <div>
            <div className="header-title-text">BETWEEN THE LINES</div>
            <div className="header-sub">Hockey, in context.</div>
          </div>
        </div>
      </div>

      <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>
      {/* Tabs */}
      <div className="tabs-bar" style={{ borderBottom: `1px solid ${P.border}`, display: "flex", height: TABS_H, position: "sticky", top: HEADER_H, zIndex: 49, background: P.bg, padding: "0 8px", overflow: "visible" }}>
        <select className="mobile-view-select" aria-label="View" value={tab} onChange={event => setTab(event.target.value)}>
          {TABS.map(value => <option key={value} value={value}>{TAB_LABELS[value]}</option>)}
        </select>
        {TABS.map(t => t === 'all' ? <div className="teams-tab-menu" key={t}>
          <button className={`tab-btn${tab === t ? " active" : ""}`} aria-pressed={tab === t} onClick={() => setTab(t)}>TEAMS</button>
          <div className="team-view-switcher" aria-label="Team layout">
            <button aria-pressed={teamMode === 'quick'} onClick={() => { setTeamMode('quick'); setTab('all'); }}>QUICK SCAN</button>
            <button aria-pressed={teamMode === 'focus'} onClick={() => { setTeamMode('focus'); setTab('all'); }}>FOCUSED TEAM</button>
          </div>
        </div> : <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} aria-pressed={tab === t} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>)}
      </div>

      {/* Content */}
      {standingsError && <p className="api-notice" role="status">Team records are temporarily unavailable.</p>}
      {tab === "all" && <TeamsView isMobile={isMobile} mode={teamMode} />}
      {tab === "today" && <ErrorBoundary><TodayView isMobile={isMobile} /></ErrorBoundary>}
      {tab === "picks" && <ErrorBoundary><PicksView /></ErrorBoundary>}
      {tab === "playoffs" && <ErrorBoundary><PlayoffsView isMobile={isMobile} /></ErrorBoundary>}
      {tab === "stats" && <ErrorBoundary><GoalsAgainstView isMobile={isMobile} /></ErrorBoundary>}
      {tab === "injuries" && <ErrorBoundary><InjuriesView isMobile={isMobile} /></ErrorBoundary>}
      {tab === "player" && <ErrorBoundary><PlayerStatsView isMobile={isMobile} /></ErrorBoundary>}
      {tab === "compare" && <ErrorBoundary><CompareView isMobile={isMobile} /></ErrorBoundary>}

      {/* Glass player modal */}
      {modal && <PlayerDetails modal={modal} onClose={() => setModal(null)} />}

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${P.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: P.dove, letterSpacing: 0, fontFamily: "'Space Mono',monospace" }}>DATA FROM</span>
        <a href="https://www.dailyfaceoff.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, color: P.casper, letterSpacing: 0, textDecoration: "none", fontFamily: "'Space Mono',monospace" }}>DAILY FACEOFF</a>
        <span style={{ fontSize: 10, color: P.dim }}>·</span>
        <a href="https://www.nhl.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, color: P.casper, letterSpacing: 0, textDecoration: "none", fontFamily: "'Space Mono',monospace" }}>NHL.COM</a>
        <span style={{ fontSize: 10, color: P.dim }}>·</span>
        <span style={{ fontSize: 10, color: P.dove, letterSpacing: 0, fontFamily: "'Space Mono',monospace" }}>HIMANK GOEL</span>
        <span style={{ fontSize: 10, color: P.dim }}>·</span>

      </div>
    </div>
  );
}
