import React, { useState, useMemo, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { Sun, Moon, Search, AlertCircle, ZoomIn, ZoomOut, ArrowRight } from 'lucide-react';
import useSchedule, { localDate } from './useSchedule.js';
import PlayerDetails from './PlayerDetails.jsx';
import GameView from './GameView.jsx';
import JerseyIcon from './JerseyIcon.jsx';
import { getJSON, normalizeName, seasonForDate, seasonLabel, seasonsFrom } from './data-client.js';
import { NHL_TEAMS, TEAM_COLORS } from './teams.js';
import { rankPositions, formatIndex, POSITIONS } from './picks-signal.js';
import { DEFAULT_VIEW, parseLocation, buildPath, routePattern } from './routes.js';
import { pageTitle } from './page-meta.js';
import { Analytics } from '@vercel/analytics/react';
import './styles.css';
import lineups from '../data/lines.json';
import startingGoalies from '../data/goalies.json';
import goalsAgainstData from '../data/goals_against_by_position.json';
import lineupChanges from '../data/lineup_changes.json';
import propSheetData from '../data/prop_sheet.json';

import playoffBracket from '../data/playoff_bracket.json';
import iihfGroups from '../data/iihf_groups.json';
import iihfSchedule from '../data/iihf_schedule.json';
import iihfRostersData from '../data/iihf_rosters.json';

const UPDATED_AT = lineups.updated_at.slice(0, 10);
const TEAMS_DATA = lineups.teams;
const INJURIES_DATA = lineups.injuries || {};
const GA_DATA = goalsAgainstData;
const LINEUP_CHANGE_EVENTS = lineupChanges.events || [];
const GOALIE_MATCHUPS = startingGoalies.matchups || [];
const PROP_SHEET = propSheetData;
const RECENT_MOVE_WINDOW_MS = 48 * 3600 * 1000;

const BRACKET_DATA = playoffBracket;
const IIHF_GROUPS_DATA = iihfGroups;
const IIHF_SCHEDULE_DATA = iihfSchedule;
const IIHF_ROSTERS = iihfRostersData.rosters;


const TEAM_SLUGS = Object.keys(NHL_TEAMS);
const DEFAULT_FOCUS_TEAM = 'vancouver-canucks';
// Sections whose mobile dropdown offers more than the page you are already on.
const SECTIONS_WITH_SUBVIEWS = new Set(['all', 'compare', 'news', 'injuries', 'moves', 'player', 'stats', 'playoffs']);

const LOGO_ABBR_OVERRIDE = { "los-angeles-kings": "LAK" };
const LOGO_URL = (slug, abbr) => `https://assets.nhle.com/logos/nhl/svg/${LOGO_ABBR_OVERRIDE[slug] || abbr}_${P.bg === LIGHT_PALETTE.bg ? "light" : "dark"}.svg`;
const COLLAPSED_W = 100;
const EXPANDED_W = 320;

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

function TeamBrowser({ slug, onSelect }) {
  const [query, setQuery] = useState('');
  const team = NHL_TEAMS[slug];
  const { roster, error: rosterError } = useTeamRoster(team.abbr);
  const visible = Object.entries(NHL_TEAMS).filter(([, t]) => (t.city + ' ' + t.name + ' ' + t.abbr).toLowerCase().includes(query.toLowerCase()));
  return <main className="team-browser">
    <aside className="team-navigation" aria-label="Teams">
      <label className="team-search"><Search size={17} /><input aria-label="Search teams" placeholder="Find a team" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <select className="mobile-team-select" aria-label="Selected team" value={slug} onChange={event => onSelect(event.target.value)}>
        {Object.entries(NHL_TEAMS).map(([key, t]) => <option value={key} key={key}>{t.city} {t.name}</option>)}
      </select>
      <div className="team-list">{visible.map(([key, t]) => <NavLink key={key} to={`/teams/${key}`} className={slug === key ? 'selected' : undefined} current={slug === key} onNavigate={() => onSelect(key)}>
        <TeamLogo slug={key} abbr={t.abbr} size={26} /><span>{t.city}<small>{t.name}</small></span><span className="team-abbr">{t.abbr}</span>
      </NavLink>)}
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
      <div className="strip-collapsed" style={{ position: "absolute", top: "40%", left: 0, width: COLLAPSED_W, transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: expanded ? 0 : 1, transition: "opacity 0.15s", pointerEvents: "none", padding: "0 10px" }}>
        <TeamLogo slug={slug} abbr={t.abbr} size={52} />
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 700, color: P.casper, letterSpacing: 0, whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif" }}>{(t.short || t.city).toUpperCase()}</div>
      </div>
      <div className="strip-expanded-content" style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s 0.15s", padding: "18px 20px", minWidth: EXPANDED_W, pointerEvents: expanded ? "auto" : "none", overflowY: "auto", maxHeight: "calc(100vh - var(--header-height) - var(--tabs-height))" }}>
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
  const [showScrollHint, setShowScrollHint] = useState(true);
  const slugs = Object.keys(TEAMS_DATA).sort((a, b) => NHL_TEAMS[a].city.localeCompare(NHL_TEAMS[b].city));
  const toggle = slug => {
    setShowScrollHint(false);
    setExpanded(current => ({ ...current, [slug]: !current[slug] }));
  };
  return <div className="quick-scan-shell">
    <div className={`quick-scan-hint${showScrollHint ? '' : ' hidden'}`} aria-hidden="true">
      <span>SCROLL</span><ArrowRight size={14} strokeWidth={1.5} />
    </div>
    <div className="quick-scan" aria-label="Quick team scan" onScroll={event => {
      if (event.currentTarget.scrollLeft > 12) setShowScrollHint(false);
    }}>
      <div className="quick-scan-track">
        {slugs.map(slug => <TeamStrip key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />)}
      </div>
    </div>
  </div>;
}

function TeamsView({ mode, team, onSelectTeam }) {
  return <section className="teams-view">
    {mode === 'quick' ? <QuickScan /> : <TeamBrowser slug={team || DEFAULT_FOCUS_TEAM} onSelect={onSelectTeam} />}
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
const COMPARE_ZOOM = [
  { label: 'DETAIL', width: 560 },
  { label: 'COMPACT', width: 220 },
  { label: '10-UP', width: 112 },
];

function compactName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

function CompactLineup({ data, dense }) {
  const groups = [
    { label: 'FORWARDS', prefix: 'L', units: data.forwards || [] },
    { label: 'DEFENSE', prefix: 'D', units: data.defense || [] },
    { label: 'GOALIES', prefix: 'G', units: (data.goalies || []).map(goalie => [goalie[0]]) },
    { label: 'POWER PLAY', prefix: 'PP', units: [data.pp1 || [], data.pp2 || []].filter(unit => unit.length) },
  ];

  return <div className={`compact-lineup${dense ? ' dense' : ''}`}>
    {groups.filter(group => group.units.length).map(group => <section key={group.label}>
      <h3>{group.label}</h3>
      {group.units.map((unit, index) => <div className="compact-unit" key={`${group.label}-${index}`}>
        <span>{group.prefix}{index + 1}</span>
        <div>{unit.map(player => <button key={player} onClick={() => triggerPlayerLookup?.(player)} title={player}>{dense ? compactName(player) : player}</button>)}</div>
      </div>)}
    </section>)}
  </div>;
}

function CompareTeamColumn({ slug, zoom, showBorder, onRemove }) {
  const team = NHL_TEAMS[slug];
  const { roster } = useTeamRoster(team.abbr, zoom === 0);
  const rosterPlayers = roster.team === team.abbr ? roster.players : {};

  return <div className="compare-column" style={{ borderRight: showBorder ? `1px solid ${P.border}` : "none" }}>
    <div className="compare-team-heading">
      <TeamLogo slug={slug} abbr={team.abbr} size={zoom === 2 ? 24 : zoom === 1 ? 30 : 40} />
      <div className="compare-team-name">
        <div>{zoom === 2 ? team.abbr : team.city}</div>
        {zoom < 2 && <small>{team.name}</small>}
      </div>
      <button className="rm-btn" aria-label={`Remove ${team.city} ${team.name}`} onClick={() => onRemove(slug)}>×</button>
    </div>
    <div className="compare-lineup">
      {zoom === 0
        ? <RosterContext.Provider value={{ players: rosterPlayers, team: team.abbr }}><LineupContent data={TEAMS_DATA[slug]} /></RosterContext.Provider>
        : <CompactLineup data={TEAMS_DATA[slug]} dense={zoom === 2} />}
    </div>
  </div>;
}

function CompareView({ selected, onChange }) {
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const toggle = slug => onChange(selected.includes(slug) ? selected.filter(s => s !== slug) : selected.length < 10 ? [...selected, slug] : selected);
  const filteredSlugs = useMemo(() => Object.keys(NHL_TEAMS).filter(slug => {
    const t = NHL_TEAMS[slug];
    return `${t.city} ${t.name} ${t.abbr}`.toLowerCase().includes(search.toLowerCase());
  }), [search]);

  return (
    <div className="compare-page">
      <div className="compare-controls">
        <div className="compare-toolbar">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter teams..."
            style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.white, fontSize: 13, fontFamily: "inherit", width: 160 }} />
          {selected.length > 0 && <button onClick={() => onChange([])} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.dove, fontSize: 11, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: 0 }}>CLEAR ALL</button>}
          <div className="compare-zoom" aria-label="Lineup size">
            <button onClick={() => setZoom(value => Math.min(COMPARE_ZOOM.length - 1, value + 1))} disabled={zoom === COMPARE_ZOOM.length - 1} aria-label="Zoom out" title="Show more teams"><ZoomOut size={15} /></button>
            <span>{COMPARE_ZOOM[zoom].label}</span>
            <button onClick={() => setZoom(value => Math.max(0, value - 1))} disabled={zoom === 0} aria-label="Zoom in" title="Show more lineup detail"><ZoomIn size={15} /></button>
          </div>
          <span className="compare-count">{selected.length} / 10 selected</span>
        </div>
        <div className="compare-team-picker">
          {filteredSlugs.map(slug => {
            const t = NHL_TEAMS[slug];
            const isSel = selected.includes(slug);
            const disabled = !isSel && selected.length >= 10;
            return (
              <button key={slug} className={`compare-chip${isSel ? " selected" : ""}`} onClick={() => toggle(slug)} disabled={disabled} aria-pressed={isSel}>
                <TeamLogo slug={slug} abbr={t.abbr} size={20} />
                <span style={{ fontSize: 13, fontWeight: 600, color: isSel ? P.white : P.casper, whiteSpace: "nowrap" }}>{t.abbr}</span>
              </button>
            );
          })}
        </div>
      </div>
      {selected.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 26, opacity: 0.15 }}>⬆</span>
          <span style={{ fontSize: 13, color: P.dove, letterSpacing: 0, fontFamily: "'Syne',sans-serif" }}>SELECT TEAMS ABOVE TO COMPARE</span>
        </div>
      ) : (
        <div className="compare-viewport">
          <div className={`compare-columns zoom-${zoom}`} style={{ minWidth: selected.length * COMPARE_ZOOM[zoom].width }}>
            {selected.map((slug, i) => <CompareTeamColumn key={slug} slug={slug} zoom={zoom} showBorder={i < selected.length - 1} onRemove={toggle} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── LINKS ─────────────────────────────────────────────────────────────
// Let modified clicks (new tab/window) fall through to the browser.
const isPlainClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Real link for navigation: copy/open-in-new-tab work; plain clicks stay in the SPA.
function NavLink({ to, current, onNavigate, className, children }) {
  return <a href={to} className={className} aria-current={current ? 'page' : undefined} onClick={event => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onNavigate();
  }}>{children}</a>;
}

// ── TONIGHT VIEW ──────────────────────────────────────────────────────
const LINES_UPDATED = new Date(lineups.updated_at.replace(' UTC', 'Z').replace(' ', 'T'));
const STORY_LIMIT = 3;

function recentMovesFor(slug, now) {
  const rank = event => (event.importance === 'high' ? 0 : 1);
  const seen = new Set();
  // Events are newest first; keep each player's latest change so flip-flops don't show twice.
  return LINEUP_CHANGE_EVENTS
    .filter(event => event.team === slug && now - Date.parse(event.occurred_at) <= RECENT_MOVE_WINDOW_MS)
    .filter(event => !seen.has(event.player) && seen.add(event.player))
    .sort((a, b) => rank(a) - rank(b));
}

const titleCase = name => name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, match => match.toUpperCase());
const surname = name => titleCase(name.split(' ').slice(-1)[0]);

// One readable clause per lineup change, e.g. "drops to line 3", "joins PP1".
function moveClause(change) {
  const { type, from, to } = change;
  if (type === 'addition') return 'enters the lineup';
  if (type === 'removal') return 'is out of the lineup';
  if (type === 'team') return 'joins from a new team';
  const unit = type === 'forward_line' ? 'line' : type === 'defense_pair' ? 'pair' : 'PP';
  const label = value => (unit === 'PP' ? `PP${value}` : `${unit} ${value}`);
  if (from == null) return `slots onto ${label(to)}`;
  if (to == null) return `comes off ${label(from)}`;
  return to < from ? `moves up to ${label(to)}` : `drops to ${label(to)}`;
}

function starterFor(slug) {
  const matchup = GOALIE_MATCHUPS.find(item => item.away?.team === slug || item.home?.team === slug);
  const side = matchup && (matchup.away.team === slug ? matchup.away : matchup.home);
  if (side?.goalie) return { name: side.goalie, status: side.status || 'Unconfirmed' };
  const projected = TEAMS_DATA[slug]?.goalies?.[0]?.[0];
  return projected ? { name: projected, status: 'Projected' } : null;
}

function gameStatus(game) {
  const period = game.periodDescriptor;
  const periodLabel = period?.periodType === 'OT' ? 'OT' : period?.periodType === 'SO' ? 'SO' : period?.number ? `P${period.number}` : '';
  if (['FINAL', 'OFF'].includes(game.gameState)) {
    const last = game.gameOutcome?.lastPeriodType;
    return { phase: 'final', label: last && last !== 'REG' ? `Final/${last}` : 'Final' };
  }
  if (['LIVE', 'CRIT'].includes(game.gameState)) return { phase: 'live', label: periodLabel ? `Live · ${periodLabel}` : 'Live' };
  const time = new Date(game.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return { phase: 'pre', label: time };
}

// The standings endpoint keeps serving last season's table until games are played.
const isCurrentRecord = date => !date || Date.now() - Date.parse(date) < 30 * 24 * 3600 * 1000;

function SlateTeam({ team, side, showScore, onTeam }) {
  const slug = abbrToSlug(team.abbrev);
  const meta = NHL_TEAMS[slug];
  const standing = STANDINGS[team.abbrev];
  const record = standing && isCurrentRecord(standing.date) ? standing.record : null;
  return <div className={`slate-team slate-team-${side}`}>
    <TeamLogo slug={slug} abbr={team.abbrev} size={56} />
    <div className="slate-team-copy">
      <span className="slate-city">{meta?.city || team.placeName?.default}</span>
      {slug ? <NavLink to={`/teams/${slug}`} className="slate-name" onNavigate={() => onTeam(slug)}>{meta?.name || team.abbrev}</NavLink> : <strong className="slate-name">{team.abbrev}</strong>}
      {record && <span className="slate-record">{record}</span>}
    </div>
    {showScore && <strong className="slate-score">{team.score ?? 0}</strong>}
  </div>;
}

function GoalieDuel({ away, home }) {
  const starters = [away, home].map(team => ({ abbr: team.abbrev, starter: starterFor(abbrToSlug(team.abbrev)) }));
  if (!starters.some(item => item.starter)) return null;
  return <div className="slate-row slate-duel">
    <span className="slate-kicker">Goalie duel</span>
    <div className="duel-body">{starters.map(({ abbr, starter }, index) => <React.Fragment key={abbr}>
      {index === 1 && <span className="duel-vs">vs</span>}
      <span className="duel-goalie">
        <span className="story-team duel-team">{abbr}</span>
        {starter ? <button onClick={() => triggerPlayerLookup?.(starter.name)}>{titleCase(starter.name)}</button> : <em>TBD</em>}
        {starter && <em className={`goalie-status status-${starter.status.toLowerCase().replace(/[^a-z]/g, '')}`}>{starter.status}</em>}
      </span>
    </React.Fragment>)}</div>
  </div>;
}

function GameStory({ away, home, onOpenMoves }) {
  const now = Date.now();
  const byTeam = [away, home].map(team => recentMovesFor(abbrToSlug(team.abbrev), now)
    .sort((a, b) => (a.importance === 'high' ? 0 : 1) - (b.importance === 'high' ? 0 : 1))
    .map(event => ({ ...event, abbr: team.abbrev })));
  const moves = byTeam.flat();
  // Alternate between the teams so one busy roster can't crowd the other out.
  const headline = [];
  for (let slot = 0; headline.length < STORY_LIMIT && slot < Math.max(...byTeam.map(list => list.length), 0); slot += 1) {
    for (const list of byTeam) if (list[slot] && headline.length < STORY_LIMIT) headline.push(list[slot]);
  }
  return <div className="slate-story">
    <span className="slate-kicker">The story</span>
    {headline.length
      ? <ul>{headline.map(event => <li key={event.id}>
          <span className="story-team">{event.abbr}</span>
          <span><button onClick={() => triggerPlayerLookup?.(event.player)}>{surname(event.player)}</button> {event.changes.map(moveClause).join(', ')}</span>
        </li>)}</ul>
      : <p className="slate-quiet">No lineup changes in the last 48 hours.</p>}
    {moves.length > headline.length && <a className="slate-more" href="/line-moves" onClick={event => { if (!isPlainClick(event)) return; event.preventDefault(); onOpenMoves(); }}>{moves.length - headline.length} more line {moves.length - headline.length === 1 ? 'move' : 'moves'}</a>}
  </div>;
}

function GameWatch({ away, home }) {
  const sides = [{ offense: away.abbrev, defense: home.abbrev }, { offense: home.abbrev, defense: away.abbrev }];
  return <div className="slate-watch">
    <span className="slate-kicker">Watch</span>
    <ul>{sides.map(side => {
      const top = rankPositions(GA_DATA.teams?.[side.defense]?.l10, GA_DATA.league?.l10_avg)[0];
      return <li key={side.offense}>
        <span className="story-team">{side.offense}</span>
        <span><strong>{top?.position || '—'}</strong>{top?.index != null && <span className="watch-index">{formatIndex(top.index)} league rate</span>}</span>
      </li>;
    })}</ul>
  </div>;
}

function SlateGame({ game, onOpenMoves, onOpenGame, onTeam }) {
  const [showLineups, setShowLineups] = useState(false);
  const status = gameStatus(game);
  const showScore = status.phase !== 'pre';
  const networks = (game.tvBroadcasts || []).map(item => item.network).filter(Boolean).slice(0, 3).join(' · ');
  const tag = game.gameType === 1 ? (game.awayTeam.awaySplitSquad || game.homeTeam.homeSplitSquad ? 'Preseason · Split squad' : 'Preseason') : game.gameType === 3 ? 'Playoffs' : null;
  return <article className={`slate-game phase-${status.phase}`} style={{ '--away-color': TEAM_COLORS[game.awayTeam.abbrev] || 'var(--dim)', '--home-color': TEAM_COLORS[game.homeTeam.abbrev] || 'var(--dim)' }}>
    <div className="slate-matchup">
      <SlateTeam team={game.awayTeam} side="away" showScore={showScore} onTeam={onTeam} />
      <div className="slate-status">
        <span className="slate-state">{status.label}</span>
        {tag && <span className="slate-tag">{tag}</span>}
        {networks && status.phase === 'pre' && <span className="slate-tag">{networks}</span>}
      </div>
      <SlateTeam team={game.homeTeam} side="home" showScore={showScore} onTeam={onTeam} />
    </div>
    <GoalieDuel away={game.awayTeam} home={game.homeTeam} />
    <div className="slate-row slate-insight">
      <GameStory away={game.awayTeam} home={game.homeTeam} onOpenMoves={onOpenMoves} />
      <GameWatch away={game.awayTeam} home={game.homeTeam} />
    </div>
    <div className="slate-actions">
      <NavLink to={`/games/${game.id}`} className="slate-link" onNavigate={() => onOpenGame(String(game.id))}>Game center <ArrowRight size={13} aria-hidden="true" /></NavLink>
      <button className="slate-link" aria-expanded={showLineups} onClick={() => setShowLineups(value => !value)}>{showLineups ? 'Hide lineups' : 'Lineups'}</button>
    </div>
    {showLineups && <div className="slate-lineups">
      <p className="snapshot-notice">Projected lineups as of {UPDATED_AT}. Not confirmed for this game.</p>
      <div className="matchup-lineups">{[game.awayTeam, game.homeTeam].map(team => <section key={team.abbrev}><h2>{team.abbrev}</h2>{TEAMS_DATA[abbrToSlug(team.abbrev)] ? <LineupContent data={TEAMS_DATA[abbrToSlug(team.abbrev)]} /> : <p>No lineup available.</p>}</section>)}</div>
    </div>}
  </article>;
}

function TodayView({ onOpenMoves, onOpenGame, onTeam }) {
  const [date, setDate] = useState(localDate());
  const { games, loading, error } = useSchedule(date);
  const isToday = date === localDate();
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const updated = Number.isNaN(LINES_UPDATED.valueOf()) ? UPDATED_AT : LINES_UPDATED.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return <main className="slate-page">
    <header className="slate-heading">
      <div>
        <p className="slate-eyebrow">The slate · {dayLabel}</p>
        <h1>{isToday ? 'Tonight' : 'Schedule'}</h1>
        {!loading && !error && games.length > 0 && <p className="slate-summary">{games.length} {games.length === 1 ? 'game' : 'games'} · Lines updated {updated}</p>}
      </div>
      <label>Date<input type="date" aria-label="Schedule date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label>
    </header>
    {loading && <p className="data-state" role="status">Loading the slate…</p>}
    {error && <p className="data-state" role="alert">{error}</p>}
    {!loading && !error && !games.length && <p className="data-state">No games scheduled for {dayLabel}.</p>}
    <div className="slate-list">{games.map(game => <SlateGame key={game.id} game={game} onOpenMoves={onOpenMoves} onOpenGame={onOpenGame} onTeam={onTeam} />)}</div>
  </main>;
}

const REPORTERS_LIST_URL = 'https://x.com/i/lists/2099709774887788639';
const REPORTERS_LIST_ID = '2099709774887788639';

function ReporterTimeline({ isDark }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    const container = containerRef.current;
    if (!container) return undefined;
    setStatus('loading');
    container.replaceChildren();

    const observer = new MutationObserver(() => {
      if (active && container.querySelector('iframe')) setStatus('ready');
    });
    observer.observe(container, { childList: true, subtree: true });

    const render = () => window.twttr?.widgets?.createTimeline(
      { sourceType: 'list', id: REPORTERS_LIST_ID },
      container,
      { height: 760, theme: isDark ? 'dark' : 'light', chrome: 'noheader nofooter noborders transparent' },
    )?.catch(onError);
    let script = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    const onError = () => { if (active) setStatus('error'); };
    if (window.twttr?.widgets) {
      render();
    } else {
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        document.body.appendChild(script);
      }
      script.addEventListener('load', render, { once: true });
      script.addEventListener('error', onError, { once: true });
    }

    const timeout = window.setTimeout(() => { if (active && !container.querySelector('iframe')) setStatus('error'); }, 10000);
    return () => {
      active = false;
      observer.disconnect();
      window.clearTimeout(timeout);
      script?.removeEventListener('load', render);
      script?.removeEventListener('error', onError);
      container.replaceChildren();
    };
  }, [isDark]);

  return <div className="reporter-timeline-wrap" data-status={status}>
    {status === 'loading' && <p className="reporter-status" role="status">Loading reporter feed...</p>}
    <div className="reporter-timeline" ref={containerRef} />
    {status === 'error' && <p className="reporter-status">The embedded feed was blocked. <a href={REPORTERS_LIST_URL} target="_blank" rel="noopener noreferrer">Open NHL Reporters on X</a></p>}
  </div>;
}

function NewsView({ isDark, source, onSourceChange }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getJSON('/api/news', 300000)
      .then(data => { if (active) setStories(Array.isArray(data.stories) ? data.stories : []); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const formatNewsDate = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Latest';
  const lead = stories[0];
  const remaining = stories.slice(1);

  return <main className="news-page">
    <header className="news-heading"><div><span>NEWS DESK</span><h1>News</h1></div><div className="news-source-tabs" role="tablist" aria-label="News source"><button role="tab" aria-selected={source === 'nhl'} onClick={() => onSourceChange('nhl')}>NHL NEWS</button><button role="tab" aria-selected={source === 'reporters'} onClick={() => onSourceChange('reporters')}>REPORTERS</button></div></header>
    {source === 'nhl' && <>
      {loading && <p className="data-state" role="status">Loading NHL News...</p>}
      {error && <p className="data-state" role="alert">{error}</p>}
      {!loading && !error && !lead && <p className="data-state">No news stories are available right now.</p>}
      {lead && <>
      <a className="news-lead" href={lead.url} target="_blank" rel="noopener noreferrer">
        {lead.image && <img src={lead.image} alt="" />}
        <div><time>{formatNewsDate(lead.publishedAt)}</time><h2>{lead.title}</h2>{lead.summary && <p>{lead.summary}</p>}<span>READ ON NHL.COM</span></div>
      </a>
      <section className="news-grid" aria-label="Latest NHL stories">
        {remaining.map(story => <a className="news-story" href={story.url} target="_blank" rel="noopener noreferrer" key={story.url}>
          {story.image && <img src={story.image} alt="" loading="lazy" />}
          <div><time>{formatNewsDate(story.publishedAt)}</time><h2>{story.title}</h2>{story.summary && <p>{story.summary}</p>}</div>
        </a>)}
      </section>
      </>}
    </>}
    {source === 'reporters' && <section className="reporters-feed" aria-label="NHL reporters on X"><header><div><span>CURATED X LIST</span><h2>NHL Reporters</h2></div><a href={REPORTERS_LIST_URL} target="_blank" rel="noopener noreferrer">OPEN ON X</a></header><ReporterTimeline isDark={isDark} /></section>}
  </main>;
}

const SHEET_COLUMNS = [
  { key: 'name', label: 'Player', align: 'left' },
  { key: 'line', label: 'Role', align: 'left' },
  { key: 'opp_index', label: 'Matchup', align: 'right', format: value => (value ? `${value.toFixed(2)}×` : '—') },
  { key: 'sog', label: 'SOG/10', align: 'right' },
  { key: 'p', label: 'P/10', align: 'right' },
  { key: 'toi', label: 'TOI', align: 'right', format: value => formatClock(value) },
  { key: 'pptoi', label: 'PP TOI', align: 'right', format: value => formatClock(value) },
];

const FLAG_LABELS = { PP1: 'PP1', ROLE_UP: 'Role up', HOT: 'Hot', B2B: 'Back-to-back', SOFT_MATCHUP: 'Soft matchup' };

const formatClock = seconds => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const sheetValue = (player, key) => {
  if (['sog', 'p', 'toi', 'pptoi'].includes(key)) return player.last10?.[key] ?? 0;
  if (key === 'opp_index') return player.opp_index ?? 0;
  if (key === 'line') return `${player.line || ''}${player.pp ? ` PP${player.pp}` : ''}`;
  return player[key] ?? '';
};

function PlayerSheet() {
  const [sort, setSort] = useState({ key: 'sog', dir: 'desc' });
  const [team, setTeam] = useState('all');
  const [position, setPosition] = useState('all');
  const [ppOnly, setPpOnly] = useState(false);
  const players = PROP_SHEET.players || [];
  const teams = useMemo(() => [...new Set(players.map(player => player.team))].sort(), [players]);

  const rows = useMemo(() => players
    .filter(player => (team === 'all' || player.team === team)
      && (position === 'all' || player.pos === position)
      && (!ppOnly || player.pp === 1))
    .sort((a, b) => {
      const [left, right] = [sheetValue(a, sort.key), sheetValue(b, sort.key)];
      const compare = typeof left === 'string' ? left.localeCompare(right) : left - right;
      return sort.dir === 'desc' ? -compare : compare;
    }), [players, team, position, ppOnly, sort]);

  const toggleSort = key => setSort(current => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }));

  if (!players.length) return <section className="player-sheet">
    <header className="sheet-heading"><div><span className="slate-kicker">Player sheet</span><h2>Skaters in tonight's lineups</h2></div></header>
    <p className="data-state">The player sheet covers regular-season and playoff games. It fills in automatically once the regular season starts — tonight's projected lineups are on the <a href="/">Tonight</a> page.</p>
  </section>;

  return <section className="player-sheet">
    <header className="sheet-heading">
      <div><span className="slate-kicker">Player sheet</span><h2>{rows.length} skaters in tonight's lineups</h2></div>
      <div className="sheet-filters">
        <label>Team<select value={team} onChange={event => setTeam(event.target.value)}><option value="all">All teams</option>{teams.map(abbr => <option key={abbr} value={abbr}>{abbr}</option>)}</select></label>
        <label>Position<select value={position} onChange={event => setPosition(event.target.value)}><option value="all">All</option>{POSITIONS.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="sheet-toggle"><input type="checkbox" checked={ppOnly} onChange={event => setPpOnly(event.target.checked)} />First power-play unit only</label>
      </div>
    </header>
    <div className="sheet-scroll">
      <table className="sheet-table">
        <caption className="visually-hidden">Skaters in tonight's lineups with last-10-game form and matchup context</caption>
        <thead><tr>{SHEET_COLUMNS.map(column => <th key={column.key} scope="col" className={`align-${column.align}`} aria-sort={sort.key === column.key ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
          <button onClick={() => toggleSort(column.key)}>{column.label}{sort.key === column.key && <span aria-hidden="true">{sort.dir === 'desc' ? ' ↓' : ' ↑'}</span>}</button>
        </th>)}</tr></thead>
        <tbody>{rows.map(player => <tr key={`${player.game_id}-${player.name}`}>
          <th scope="row" className="align-left">
            <button className="sheet-player" onClick={() => triggerPlayerLookup?.(player.name)}>{titleCase(player.name)}</button>
            <span className="sheet-context">{player.team} {player.home ? 'vs' : '@'} {player.opp}{player.opp_goalie ? ` · ${titleCase(player.opp_goalie.name)}` : ''}</span>
            {player.flags?.length > 0 && <span className="sheet-flags">{player.flags.map(flag => <em key={flag}>{FLAG_LABELS[flag] || flag}</em>)}</span>}
          </th>
          {SHEET_COLUMNS.slice(1).map(column => <td key={column.key} className={`align-${column.align}`}>
            {column.format ? column.format(sheetValue(player, column.key)) : sheetValue(player, column.key)}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <p className="sheet-note">Last 10 games per skater. Matchup compares the opponent's goals allowed to this position with the league average over its last 10 games.</p>
  </section>;
}

function PicksView() {
  const [date, setDate] = useState(localDate());
  const { games, loading, error } = useSchedule(date);
  const gaSeason = GA_DATA.season ? `${GA_DATA.season} ` : '';
  return <main className="picks-page">
    <header className="schedule-heading"><div><h1>Picks</h1><p className="muted">Which position each defense has allowed the most goals to over its last 10 games, measured against the {gaSeason}league average.</p></div><label>Date<input type="date" aria-label="Picks date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label></header>
    {loading && <p className="data-state" role="status">Loading matchups...</p>}
    {error && <p className="data-state" role="alert">{error}</p>}
    {!loading && !error && !games.length && <p className="data-state">No games scheduled for {date}.</p>}
    <div className="picks-list">{games.map(game => <article className="pick-matchup" key={game.id}>
      <header><div><TeamLogo slug={abbrToSlug(game.awayTeam.abbrev)} abbr={game.awayTeam.abbrev} size={28} /><strong>{game.awayTeam.abbrev}</strong><span>AT</span><TeamLogo slug={abbrToSlug(game.homeTeam.abbrev)} abbr={game.homeTeam.abbrev} size={28} /><strong>{game.homeTeam.abbrev}</strong></div><time>{new Date(game.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></header>
      <div className="pick-sides">{[
        { offense: game.awayTeam.abbrev, defense: game.homeTeam.abbrev },
        { offense: game.homeTeam.abbrev, defense: game.awayTeam.abbrev },
      ].map(side => {
        const ranked = rankPositions(GA_DATA.teams?.[side.defense]?.l10, GA_DATA.league?.l10_avg);
        const top = ranked[0];
        return <section key={side.offense}><p>{side.offense} VS {side.defense}</p>
          <strong className="pick-watch">WATCH {top?.position || '—'}</strong>
          {top?.index != null && <span className="pick-index">{formatIndex(top.index)} league rate</span>}
          <div>{ranked.map(item => <span key={item.position}><b>{item.position}</b>{item.index != null ? formatIndex(item.index) : `${item.value} GA`}</span>)}</div>
        </section>;
      })}</div>
    </article>)}</div>
    {date === localDate() && <PlayerSheet />}
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
    if (query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      getJSON(`/api/player-search?q=${encodeURIComponent(query.trim())}`)
        .then(data => {
          if (!Array.isArray(data.players)) throw new Error('Player search is temporarily unavailable.');
          if (active) setResults(data.players);
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
  const players = query.trim().length >= 2 ? results : featured;
  return <main className="player-search-page">
    <h1>Players</h1>
    <label className="team-search"><Search size={18} /><input aria-label="Search players by name or team" placeholder="Last name, team, or both" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {loading && <p className="data-state" role="status">Searching players...</p>}
    {error && <p className="data-state" role="alert">{error}</p>}
    {!loading && !error && <div className="player-results">
      {query.trim().length < 2 && <p className="muted">From the {seasonLabel(DATA_SEASON)} lineup archive</p>}
      {players.map(player => <button key={player.id || player.firstName + player.lastName} onClick={() => triggerPlayerLookup?.(player.firstName + ' ' + player.lastName, player)}>
        <span>{player.firstName} {player.lastName}</span><small>{player.pos} {player.team}</small>
      </button>)}
      {!players.length && <p className="data-state">No matching players.</p>}
    </div>}
  </main>;
}

function changeText(change) {
  const labels = { forward_line: 'Line', defense_pair: 'Pair', power_play: 'PP', team: 'Team', addition: 'Added', removal: 'Removed' };
  if (change.type === 'addition') return 'Added to projected lineup';
  if (change.type === 'removal') return 'Removed from projected lineup';
  const from = change.from == null ? 'off' : change.from;
  const to = change.to == null ? 'off' : change.to;
  return `${labels[change.type] || change.type} ${from} to ${to}`;
}

function LineMovesView() {
  const events = LINEUP_CHANGE_EVENTS.slice(0, 100);
  return <main className="moves-page">
    <header className="moves-heading">
      <div><p className="muted">BTL PULSE</p><h1>Line Moves</h1></div>
      <span>Tracking promotions, demotions, power-play roles, and team changes</span>
    </header>
    {!events.length && <div className="moves-empty">
      <strong>Tracking is now active.</strong>
      <p>The first verified changes will appear after the next lineup refresh. Current lineups remain available in Teams.</p>
    </div>}
    <div className="moves-feed">{events.map(event => {
      const team = NHL_TEAMS[event.team];
      const date = new Date(event.occurred_at);
      return <article className={`move-event importance-${event.importance}`} key={event.id}>
        <div className="move-team"><TeamLogo slug={event.team} abbr={team?.abbr || event.team?.slice(0, 3).toUpperCase()} size={34} /></div>
        <div className="move-copy">
          <div><button onClick={() => triggerPlayerLookup?.(event.player)}>{event.player}</button><span>{team ? `${team.city} ${team.name}` : event.team}</span></div>
          <p>{event.changes.map(changeText).join(' / ')}</p>
        </div>
        <time dateTime={event.occurred_at}>{Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>
      </article>;
    })}</div>
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
  const [view, setView] = useState(() => parseLocation(window.location.pathname, window.location.search, TEAM_SLUGS));
  const { tab, teamMode, newsSource } = view;
  const navigate = useCallback(partial => setView(current => ({ ...current, ...partial })), []);
  const setTab = useCallback(nextTab => navigate({ tab: nextTab }), [navigate]);
  const openTeams = mode => navigate({ tab: 'all', teamMode: mode, team: mode === 'focus' ? view.team || DEFAULT_FOCUS_TEAM : view.team });
  const openNews = source => navigate({ tab: 'news', newsSource: source });
  const [openNav, setOpenNav] = useState(null);
  const [showIntro, setShowIntro] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isDark, setIsDark] = useState(() => {
    try { const saved = localStorage.getItem('theme'); return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch { return true; }
  });
  const [standingsError, setStandingsError] = useState(false);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);

  // Tell the browser which scheme the page is painted in. Without this, Chrome
  // for Android applies Auto Dark Theme on top of our own dark palette.
  useEffect(() => {
    const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.bg);
  }, [isDark]);

  // Keep the address bar, history, and tab title in sync with the view.
  const lastPattern = useRef(null);
  useEffect(() => {
    const path = buildPath(view);
    const pattern = routePattern(view);
    if (path !== window.location.pathname + window.location.search) {
      const sameSection = lastPattern.current === null || lastPattern.current === pattern;
      window.history[sameSection ? 'replaceState' : 'pushState'](null, '', path);
    }
    lastPattern.current = pattern;
    document.title = pageTitle(window.location.pathname, window.location.search);
  }, [view]);

  useEffect(() => {
    const onPop = () => setView(parseLocation(window.location.pathname, window.location.search, TEAM_SLUGS));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const toggleTheme = () => { setIsDark(value => { const next = !value; try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {} return next; }); };
  const [modal, setModal] = useState(null); // { player, gamelog, loading, error }
  const [standings, setStandings] = useState({}); // { [abbr]: "W-L-OT" }

  useEffect(() => {
    if (!showIntro) return undefined;
    const timer = window.setTimeout(() => setShowIntro(false), 2600);
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

  const mobileNavValue = tab === 'all' ? `teams-${teamMode}` : tab === 'news' ? `news-${newsSource}` : tab;
  const mobileSectionLabel = ['all', 'compare'].includes(tab)
    ? 'TEAMS'
    : ['news', 'injuries', 'moves'].includes(tab)
      ? 'NEWS'
      : ['player', 'stats', 'playoffs'].includes(tab)
        ? 'STATS'
        : tab.toUpperCase();
  const selectView = value => {
    if (value.startsWith('teams-')) { openTeams(value.replace('teams-', '')); return; }
    if (value.startsWith('news-')) { openNews(value.replace('news-', '')); return; }
    setTab(value);
  };
  const navMenuProps = name => ({
    className: `nav-menu${openNav === name ? ' open' : ''}`,
    onMouseEnter: () => setOpenNav(name),
    onMouseLeave: () => setOpenNav(null),
    onFocus: () => setOpenNav(name),
    onBlur: event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpenNav(null); },
  });

  return (
    <div className="app-shell" data-theme={isDark ? 'dark' : 'light'} data-subviews={SECTIONS_WITH_SUBVIEWS.has(tab) ? 'true' : 'false'} style={{ fontFamily: "'Space Grotesk', sans-serif", background: P.bg, minHeight: "100vh", color: P.white, ...Object.fromEntries(Object.entries(P).map(([key, value]) => ['--' + key, value])) }}>
      <style>{makeCss(isDark ? DARK_PALETTE : LIGHT_PALETTE)}</style>

      {showIntro && <div className="brand-intro" aria-hidden="true">
        <div className="brand-intro-stage">
          <span className="brand-intro-line brand-intro-line-top" />
          <div className="brand-intro-lockup"><strong>BETWEEN THE <span>LINES</span></strong></div>
          <img className="brand-intro-mark" src="/between-mark.png" alt="" />
          <span className="brand-intro-line brand-intro-line-bottom" />
        </div>
      </div>}

      {/* Header */}
      <div className="app-header" style={{ borderTop: `3px solid ${P.casper}`, borderBottom: `1px solid ${P.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", height: "var(--header-height)", position: "sticky", top: 0, zIndex: 50, background: P.bg }}>
        <img src="/between-mark.png" alt="" className="header-logo" />
        <div className="header-center">
          <a className="header-copy header-home" href="/" aria-label="Between the Lines — tonight's games" onClick={event => { if (!isPlainClick(event)) return; event.preventDefault(); setTab('today'); }}>
            <div className="header-title-text">BETWEEN THE LINES</div>
            <div className="header-sub">Hockey, in context.</div>
          </a>
        </div>
      </div>

      <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>
      {/* Tabs */}
      <div className="tabs-bar" style={{ borderBottom: `1px solid ${P.border}`, display: "flex", height: "var(--tabs-height)", position: "sticky", top: "var(--header-height)", zIndex: 49, background: P.bg, padding: "0 8px", overflow: "visible" }}>
        <div className="mobile-view-nav">
          <nav className="mobile-primary-nav" aria-label="Primary navigation">
            <NavLink to="/teams" current={tab === 'all' || tab === 'compare'} onNavigate={() => openTeams('quick')}>TEAMS</NavLink>
            <NavLink to="/" current={tab === 'today' || tab === 'game'} onNavigate={() => setTab('today')}>TONIGHT</NavLink>
            <NavLink to="/news" current={['news', 'injuries', 'moves'].includes(tab)} onNavigate={() => openNews('nhl')}>NEWS</NavLink>
            <NavLink to="/players" current={['player', 'stats', 'playoffs'].includes(tab)} onNavigate={() => setTab('player')}>STATS</NavLink>
            <NavLink to="/picks" current={tab === 'picks'} onNavigate={() => setTab('picks')}>PICKS</NavLink>
          </nav>
          {SECTIONS_WITH_SUBVIEWS.has(tab) && <select className="mobile-view-select" aria-label={`${mobileSectionLabel} view`} value={mobileNavValue} onChange={event => selectView(event.target.value)}>
            <optgroup label="TEAMS"><option value="teams-quick">Quick Scan</option><option value="teams-focus">Focused Team</option><option value="compare">Compare</option></optgroup>
            <option value="today">Tonight</option>
            <optgroup label="NEWS"><option value="news-nhl">NHL News</option><option value="news-reporters">Reporters</option><option value="moves">Line Moves</option><option value="injuries">Injuries</option></optgroup>
            <optgroup label="STATS"><option value="player">Player Stats</option><option value="stats">Matchups</option><option value="playoffs">Playoffs</option></optgroup>
            <option value="picks">Picks</option>
          </select>}
        </div>
        <div {...navMenuProps('teams')}>
          <NavLink to="/teams" className={`tab-btn${['all', 'compare'].includes(tab) ? " active" : ""}`} onNavigate={() => openTeams('quick')}>TEAMS</NavLink>
          <div className="nav-submenu" aria-label="Teams views">
            <NavLink to="/teams" current={tab === 'all' && teamMode === 'quick'} onNavigate={() => openTeams('quick')}>QUICK SCAN</NavLink>
            <NavLink to={`/teams/${view.team || DEFAULT_FOCUS_TEAM}`} current={tab === 'all' && teamMode === 'focus'} onNavigate={() => openTeams('focus')}>FOCUSED TEAM</NavLink>
            <NavLink to={buildPath({ tab: 'compare', compare: view.compare })} current={tab === 'compare'} onNavigate={() => setTab('compare')}>COMPARE</NavLink>
          </div>
        </div>
        <NavLink to="/" className={`tab-btn${tab === 'today' || tab === 'game' ? " active" : ""}`} current={tab === 'today'} onNavigate={() => setTab('today')}>TONIGHT</NavLink>
        <div {...navMenuProps('news')}>
          <NavLink to="/news" className={`tab-btn${['news', 'injuries', 'moves'].includes(tab) ? " active" : ""}`} onNavigate={() => openNews('nhl')}>NEWS</NavLink>
          <div className="nav-submenu" aria-label="News views">
            <NavLink to="/news" current={tab === 'news' && newsSource === 'nhl'} onNavigate={() => openNews('nhl')}>NHL NEWS</NavLink>
            <NavLink to="/reporters" current={tab === 'news' && newsSource === 'reporters'} onNavigate={() => openNews('reporters')}>REPORTERS</NavLink>
            <NavLink to="/line-moves" current={tab === 'moves'} onNavigate={() => setTab('moves')}>LINE MOVES</NavLink>
            <NavLink to="/injuries" current={tab === 'injuries'} onNavigate={() => setTab('injuries')}>INJURIES</NavLink>
          </div>
        </div>
        <div {...navMenuProps('stats')}>
          <NavLink to="/players" className={`tab-btn${['player', 'stats', 'playoffs'].includes(tab) ? " active" : ""}`} onNavigate={() => setTab('player')}>STATS</NavLink>
          <div className="nav-submenu" aria-label="Stats views">
            <NavLink to="/players" current={tab === 'player'} onNavigate={() => setTab('player')}>PLAYER STATS</NavLink>
            <NavLink to="/matchups" current={tab === 'stats'} onNavigate={() => setTab('stats')}>MATCHUPS</NavLink>
            <NavLink to="/playoffs" current={tab === 'playoffs'} onNavigate={() => setTab('playoffs')}>PLAYOFFS</NavLink>
          </div>
        </div>
        <NavLink to="/picks" className={`tab-btn${tab === 'picks' ? " active" : ""}`} current={tab === 'picks'} onNavigate={() => setTab('picks')}>PICKS</NavLink>
      </div>

      {/* Content */}
      <div className="content-stage">
        {standingsError && <p className="api-notice" role="status">Team records are temporarily unavailable.</p>}
        {tab === "all" && <TeamsView mode={teamMode} team={view.team} onSelectTeam={slug => navigate({ tab: 'all', teamMode: 'focus', team: slug })} />}
        {tab === "today" && <ErrorBoundary><TodayView onOpenMoves={() => setTab('moves')} onOpenGame={gameId => navigate({ tab: 'game', gameId })} onTeam={slug => navigate({ tab: 'all', teamMode: 'focus', team: slug })} /></ErrorBoundary>}
        {tab === "news" && <ErrorBoundary><NewsView isDark={isDark} source={newsSource} onSourceChange={openNews} /></ErrorBoundary>}
        {tab === "moves" && <ErrorBoundary><LineMovesView /></ErrorBoundary>}
        {tab === "picks" && <ErrorBoundary><PicksView /></ErrorBoundary>}
        {tab === "playoffs" && <ErrorBoundary><PlayoffsView isMobile={isMobile} /></ErrorBoundary>}
        {tab === "stats" && <ErrorBoundary><GoalsAgainstView isMobile={isMobile} /></ErrorBoundary>}
        {tab === "injuries" && <ErrorBoundary><InjuriesView isMobile={isMobile} /></ErrorBoundary>}
        {tab === "player" && <ErrorBoundary><PlayerStatsView isMobile={isMobile} /></ErrorBoundary>}
        {tab === "game" && <ErrorBoundary><GameView gameId={view.gameId} onBack={() => setTab('today')} onTeam={slug => navigate({ tab: 'all', teamMode: 'focus', team: slug })} onPlayer={name => triggerPlayerLookup?.(name)} /></ErrorBoundary>}
        {tab === "compare" && <ErrorBoundary><CompareView selected={view.compare} onChange={compare => navigate({ compare })} /></ErrorBoundary>}
      </div>

      <Analytics mode={import.meta.env.PROD ? 'production' : 'development'} route={routePattern(view)} path={buildPath(view).split('?')[0]} />

      {/* Glass player modal */}
      {modal && <PlayerDetails modal={modal} onClose={() => setModal(null)} />}

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-lockup">
            <img src="/between-mark-footer.svg" alt="" />
            <div><strong>BETWEEN THE LINES</strong><span>Hockey, in context.</span></div>
          </div>
          <p className="footer-intro">Line combinations, player context, league news, and matchups in one focused view.</p>
          <div className="footer-sources">
            <span>DATA SOURCES</span>
            <div>
              <a href="https://www.dailyfaceoff.com" target="_blank" rel="noopener noreferrer">DAILY FACEOFF</a>
              <a href="https://www.nhl.com" target="_blank" rel="noopener noreferrer">NHL.COM</a>
            </div>
          </div>
        </div>
        <div className="footer-meta">
          <p>Between the Lines is an independent hockey editorial and statistics project. It is not affiliated with, endorsed by, or sponsored by the NHL or NHLPA.</p>
          <strong>BY GRAINXFORM</strong>
        </div>
      </footer>
    </div>
  );
}
