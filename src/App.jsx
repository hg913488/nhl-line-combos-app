import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import lineups from '../data/lines.json';
import goalsAgainstData from '../data/goals_against_by_position.json';
import scheduleRaw from './schedule.csv?raw';

const UPDATED_AT = lineups.updated_at.slice(0, 10);
const TEAMS_DATA = lineups.teams;
const INJURIES_DATA = lineups.injuries || {};
const GA_DATA = goalsAgainstData;
const SCHEDULE_RAW = scheduleRaw;

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
const LOGO_URL = (slug, abbr) => `https://assets.nhle.com/logos/nhl/svg/${LOGO_ABBR_OVERRIDE[slug] || abbr}_dark.svg`;
const COLLAPSED_W = 100;
const EXPANDED_W = 320;
const HEADER_H = 100;
const TABS_H = 36;

const DARK_PALETTE = {
  bg: "#0d0d0d", surface: "#161616", border: "#252525",
  dove: "#686B6C", casper: "#B8C4CA", white: "#F0F0F0", dim: "#3a3a3a",
  hover: "#1a2530", active: "#1e2d3d", accent: "#2a4a6b",
  red: "#c0392b", yellow: "#d4ac0d", green: "#1e8449",
};

const LIGHT_PALETTE = {
  bg: "#FAFAFA", surface: "#FFFFFF", border: "#E5E5E5",
  dove: "#8B8B8B", casper: "#6B6B6B", white: "#1C1C1C", dim: "#C8C8C8",
  hover: "#F0EDEB", active: "#E8E3DE", accent: "#2a4a6b",
  red: "#c0392b", yellow: "#d4ac0d", green: "#1e8449",
};

// Mutable reference — App() updates this synchronously before rendering children
let P = { ...DARK_PALETTE };

function makeCss(palette) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${palette.bg}; height: 100%; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${palette.dim}; border-radius: 2px; }
  input:focus { outline: none; }
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
  .tab-btn { background:none; border:none; cursor:pointer; font-family:'Syne',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.12em; padding:0 16px; height:100%; transition:color 0.15s,border-bottom 0.15s; border-bottom:2px solid transparent; flex-shrink:0; white-space:nowrap; }
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
  .inj-badge { display:inline-block; font-size:8px; font-weight:700; letter-spacing:0.08em; padding:2px 5px; border-radius:3px; margin-left:6px; vertical-align:middle; font-family:'Space Mono',monospace; }
  .inj-out { background:#c0392b22; color:#e74c3c; border:1px solid #c0392b44; }
  .inj-dtd { background:#d4ac0d22; color:#f1c40f; border:1px solid #d4ac0d44; }
  .inj-ir { background:#7d3c9822; color:#a569bd; border:1px solid #7d3c9844; }
  .ga-table { width:100%; border-collapse:collapse; font-size:12px; }
  .ga-table th { font-size:9px; font-weight:700; letter-spacing:0.12em; color:${palette.dove}; padding:8px 6px; text-align:center; border-bottom:1px solid ${palette.border}; position:sticky; top:0; background:${palette.bg}; z-index:1; font-family:'Space Mono',monospace; }
  .ga-table th:first-child { text-align:left; padding-left:12px; }
  .ga-table td { padding:7px 6px; text-align:center; border-bottom:1px solid ${palette.border}; font-variant-numeric:tabular-nums; font-family:'Space Mono',monospace; }
  .ga-table td:first-child { text-align:left; padding-left:4px; }
  .ga-table tr:hover td { background:${palette.hover}; }
  .ga-table .total-col { font-weight:700; color:${palette.casper}; }
  .ga-sort-btn { background:none; border:none; cursor:pointer; font-family:'Space Mono',monospace; font-size:9px; font-weight:700; letter-spacing:0.12em; color:${palette.dove}; padding:8px 6px; width:100%; text-align:center; }
  .ga-sort-btn:hover { color:${palette.casper}; }
  .ga-sort-btn.active-sort { color:${palette.white}; }
  .suggest-drop { position:absolute; top:calc(100% + 4px); left:0; right:0; background:${palette.surface}; border:1px solid ${palette.border}; border-radius:4px; z-index:100; overflow:hidden; }
  .suggest-item { padding:9px 12px; cursor:pointer; font-size:12px; color:${palette.casper}; font-family:'Space Grotesk',sans-serif; transition:background 0.1s; }
  .suggest-item:hover, .suggest-item.active { background:${palette.active}; color:${palette.white}; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width:14px; height:14px; border:2px solid ${palette.border}; border-top-color:${palette.casper}; border-radius:50%; animation:spin 0.7s linear infinite; }
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

function getTodayGames() {
  const today = new Date();
  const pad = n => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const games = [];
  for (const line of SCHEDULE_RAW.trim().split("\n")) {
    const parts = line.split("\t");
    const date = parts[0], away = parts[1], home = parts[2];
    if (date === todayStr) {
      const awaySlug = nameToSlug(away);
      const homeSlug = nameToSlug(home);
      if (awaySlug && homeSlug) games.push({ away: awaySlug, home: homeSlug });
    }
  }
  return games;
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

function PlayerCard({ name, pos }) {
  const parts = name.split(" ");
  const last = parts.slice(-1)[0];
  const first = parts.slice(0, -1).join(" ");
  return (
    <div style={{ background: "#E8EAEC", border: `1px solid #D0D4D8`, borderRadius: 4, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 8, fontWeight: 700, color: "#8A8E91", letterSpacing: "0.1em", marginBottom: 3, fontFamily: "'Space Mono', monospace" }}>{pos}</span>
      <span style={{ fontSize: 8, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textAlign: "center" }}>{first}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#161616", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textAlign: "center" }}>{last}</span>
    </div>
  );
}

function ForwardLine({ line, lineNum }) {
  const pos = line.length === 3 ? ["LW","C","RW"] : line.length === 2 ? ["C","RW"] : ["C"];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: P.casper, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>LINE {lineNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{line.map((p, i) => <PlayerCard key={i} name={p} pos={pos[i]} />)}</div>
    </div>
  );
}

function DefensePair({ pair, pairNum }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: P.dove, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>PAIR {pairNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{pair.map((p, i) => <PlayerCard key={i} name={p} pos={i === 0 ? "LD" : "RD"} />)}</div>
    </div>
  );
}

function PPUnit({ unit, unitNum }) {
  if (!unit || unit.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: "#e67e22", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>PP{unitNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{unit.map((p, i) => <PlayerCard key={i} name={p} pos={`PP${unitNum}`} />)}</div>
    </div>
  );
}

function Divider({ label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: color || P.casper, letterSpacing: "0.14em", whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif" }}>{label}</span>
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
  return (
    <div className={`strip${expanded ? " expanded" : ""}`} onClick={onToggle}>
      <div style={{ position: "absolute", top: "40%", left: 0, width: COLLAPSED_W, transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: expanded ? 0 : 1, transition: "opacity 0.15s", pointerEvents: "none", padding: "0 10px" }}>
        <TeamLogo slug={slug} abbr={t.abbr} size={52} />
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 700, color: P.casper, letterSpacing: "0.14em", whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif" }}>{t.city.toUpperCase()}</div>
      </div>
      <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s 0.15s", padding: "18px 20px", minWidth: EXPANDED_W, pointerEvents: expanded ? "auto" : "none", overflowY: "auto", maxHeight: `calc(100vh - ${HEADER_H + TABS_H}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${P.border}` }}>
          <TeamLogo slug={slug} abbr={t.abbr} size={48} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.white, lineHeight: 1.1, fontFamily: "'Syne', sans-serif" }}>{t.city}</div>
            <div style={{ fontSize: 11, color: P.dove, marginTop: 2 }}>{t.name}</div>
          </div>
        </div>
        <LineupContent data={data} />
      </div>
    </div>
  );
}

function MobileRow({ slug, data, expanded, onToggle }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?" };
  return (
    <div className={`mobile-row${expanded ? " open" : ""}`}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}>
        <TeamLogo slug={slug} abbr={t.abbr} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.white, fontFamily: "'Syne', sans-serif" }}>{t.city}</div>
          <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
        </div>
        <div style={{ fontSize: 18, color: P.dove, lineHeight: 1, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>▾</div>
      </div>
      <div className={`mobile-body${expanded ? " open" : ""}`}>
        <div style={{ padding: "0 20px 24px" }}><LineupContent data={data} /></div>
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

  const todayGames = useMemo(() => getTodayGames(), []);
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
              style={{ background: filter === "all" ? P.active : "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: filter === "all" ? P.white : P.dove, fontSize: 9, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: "0.08em" }}>
              ALL TEAMS
            </button>
            <button onClick={() => setFilter("today")}
              style={{ background: filter === "today" ? P.active : "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: filter === "today" ? P.white : P.dove, fontSize: 9, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: "0.08em" }}>
              TODAY'S GAMES
            </button>
          </>
        )}
        <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto", letterSpacing: "0.08em", fontFamily: "'Space Mono',monospace" }}>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: P.white, fontFamily: "'Syne',sans-serif" }}>{t.city} {t.name}</span>
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
          {selected.length > 0 && <button onClick={() => setSelected([])} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.dove, fontSize: 9, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: "0.08em" }}>CLEAR ALL</button>}
          <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto", fontFamily: "'Space Mono',monospace" }}>{selected.length} selected</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {filteredSlugs.map(slug => {
            const t = NHL_TEAMS[slug];
            const isSel = selected.includes(slug);
            return (
              <div key={slug} className={`compare-chip${isSel ? " selected" : ""}`} onClick={() => toggle(slug)}>
                <TeamLogo slug={slug} abbr={t.abbr} size={20} />
                <span style={{ fontSize: 11, fontWeight: 600, color: isSel ? P.white : P.casper, whiteSpace: "nowrap" }}>{t.abbr}</span>
                {isSel && <button className="rm-btn" onClick={e => { e.stopPropagation(); toggle(slug); }}>×</button>}
              </div>
            );
          })}
        </div>
      </div>
      {selected.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 28, opacity: 0.15 }}>⬆</span>
          <span style={{ fontSize: 12, color: P.dove, letterSpacing: "0.1em", fontFamily: "'Syne',sans-serif" }}>SELECT TEAMS ABOVE TO COMPARE</span>
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
                      <div style={{ fontSize: 14, fontWeight: 700, color: P.white, fontFamily: "'Syne',sans-serif" }}>{t.city}</div>
                      <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
                    </div>
                    <button className="rm-btn" style={{ marginLeft: "auto", fontSize: 18 }} onClick={() => toggle(slug)}>×</button>
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
function TodayView({ isMobile }) {
  const [expanded, setExpanded] = useState({});
  const toggle = slug => setExpanded(prev => ({ ...prev, [slug]: !prev[slug] }));
  const TODAY_GAMES = useMemo(() => getTodayGames(), []);

  if (isMobile) {
    return (
      <div>
        {TODAY_GAMES.map((g, i) => {
          const away = NHL_TEAMS[g.away], home = NHL_TEAMS[g.home];
          return (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: P.bg, borderTop: i > 0 ? `2px solid ${P.dim}` : "none", borderBottom: `1px solid ${P.border}` }}>
                <div style={{ flex: 1, height: 1, background: P.border }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TeamLogo slug={g.away} abbr={away?.abbr} size={22} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: P.dove, fontFamily: "'Syne',sans-serif" }}>{away?.abbr}</span>
                  <span style={{ fontSize: 9, color: P.dim, margin: "0 2px" }}>@</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: P.dove, fontFamily: "'Syne',sans-serif" }}>{home?.abbr}</span>
                  <TeamLogo slug={g.home} abbr={home?.abbr} size={22} />
                </div>
                <div style={{ flex: 1, height: 1, background: P.border }} />
              </div>
              {[g.away, g.home].map(slug => <MobileRow key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "stretch", minHeight: `calc(100vh - ${HEADER_H + TABS_H}px)` }}>
        {TODAY_GAMES.map((g, i) => (
          <>
            <TeamStrip key={`${i}-away`} slug={g.away} data={TEAMS_DATA[g.away]} expanded={!!expanded[g.away]} onToggle={() => toggle(g.away)} />
            <TeamStrip key={`${i}-home`} slug={g.home} data={TEAMS_DATA[g.home]} expanded={!!expanded[g.home]} onToggle={() => toggle(g.home)} />
            {i < TODAY_GAMES.length - 1 && (
              <div key={`${i}-div`} style={{ width: 3, flexShrink: 0, background: P.casper, opacity: 0.3, alignSelf: "stretch" }} />
            )}
          </>
        ))}
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

  const todayGames = useMemo(() => getTodayGames(), []);
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
        const aVal = sortCol === "total" ? a.total : (a[sortCol] || 0);
        const bVal = sortCol === "total" ? b.total : (b[sortCol] || 0);
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [splitKey, totalKey, sortCol, sortDir, search, viewFilter, todayAbbrs]);

  const colRanges = useMemo(() => {
    const ranges = {};
    positions.forEach(pos => {
      const vals = rows.map(r => r[pos] || 0);
      ranges[pos] = { min: Math.min(...vals), max: Math.max(...vals) };
    });
    const totals = rows.map(r => r.total || 0);
    ranges.total = { min: Math.min(...totals), max: Math.max(...totals) };
    return ranges;
  }, [rows, positions]);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };
  const sortArrow = col => sortCol === col ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  const filterBtn = (label, value, setter, current) => (
    <button onClick={() => setter(value)}
      style={{ background: current === value ? P.active : "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: current === value ? P.white : P.dove, fontSize: 9, fontFamily: "'Syne',sans-serif", cursor: "pointer", letterSpacing: "0.08em" }}>
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
        <span style={{ fontSize: 9, color: P.dove, marginLeft: "auto", letterSpacing: "0.08em", fontFamily: "'Space Mono',monospace" }}>
          UPDATED {GA_DATA.lastUpdated || "—"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em", fontFamily: "'Space Mono',monospace" }}>GOALS AGAINST BY SCORER POSITION</span>
        <span style={{ fontSize: 9, color: P.dim }}>·</span>
        <span style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em", fontFamily: "'Space Mono',monospace" }}>
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
                      {isMobile && <span style={{ fontSize: 11, fontWeight: 700, color: P.casper, fontFamily: "'Space Mono',monospace" }}>{row.abbr}</span>}
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
      <div style={{ marginTop: 12, fontSize: 9, color: P.dim, letterSpacing: "0.06em", textAlign: "center", fontFamily: "'Space Mono',monospace" }}>
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

function PlayerStatsView({ isMobile }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [gamelog, setGamelog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.trim().length < 3) { setSuggestions([]); setShowDrop(false); return; }
    setSugLoading(true);
    try {
      const res = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=5&q=${encodeURIComponent(q)}&active=true`);
      const data = await res.json();
      const players = (Array.isArray(data) ? data : []).slice(0, 5).map(p => {
        const nameParts = (p.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        return { id: String(p.playerId), firstName, lastName, team: p.teamAbbrev || "", pos: p.positionCode || "" };
      });
      setSuggestions(players);
      setShowDrop(players.length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
      setShowDrop(false);
    } finally {
      setSugLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchSuggestions]);

  const selectPlayer = useCallback(async (player) => {
    setSelectedPlayer(player);
    setShowDrop(false);
    setQuery(`${player.firstName} ${player.lastName}`);
    setSuggestions([]);
    setLoading(true);
    setError(null);
    setGamelog([]);
    try {
      const res = await fetch(`/api/gamelog?playerId=${player.id}`);
      const data = await res.json();
      const games = (data.data || []).slice(0, 5).map(g => ({
        gameDate: g.gameDate,
        homeRoadFlag: g.homeRoad,
        opponentAbbrev: g.opponentTeamAbbrev,
        goals: g.goals,
        assists: g.assists,
        points: g.points,
        plusMinus: g.plusMinus,
        shots: g.shots,
        toi: g.timeOnIcePerGame,
      }));
      setGamelog(games);
      if (games.length === 0) setError("No recent games found for this player.");
    } catch (err) {
      setError(`Could not load stats (${err?.message || "network error"}). Please try again.`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKey = (e) => {
    if (!showDrop || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); selectPlayer(suggestions[activeIdx]); }
    else if (e.key === "Escape") { setShowDrop(false); }
  };

  const totals = useMemo(() => {
    if (!gamelog.length) return null;
    return {
      g: gamelog.reduce((s, g) => s + (g.goals || 0), 0),
      a: gamelog.reduce((s, g) => s + (g.assists || 0), 0),
      pts: gamelog.reduce((s, g) => s + (g.points || 0), 0),
      pm: gamelog.reduce((s, g) => s + (g.plusMinus || 0), 0),
      sog: gamelog.reduce((s, g) => s + (g.shots || 0), 0),
    };
  }, [gamelog]);

  const colW = isMobile
    ? { date: 52, opp: 44, g: 28, a: 28, pts: 30, pm: 32, sog: 28, toi: 44 }
    : { date: 72, opp: 56, g: 36, a: 36, pts: 44, pm: 44, sog: 40, toi: 60 };

  const thStyle = { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: P.dove, padding: "8px 6px", textAlign: "center", fontFamily: "'Space Mono',monospace", borderBottom: `1px solid ${P.border}` };
  const tdStyle = { padding: "8px 6px", textAlign: "center", fontSize: isMobile ? 11 : 12, fontFamily: "'Space Mono',monospace", color: P.white, borderBottom: `1px solid ${P.border}` };

  return (
    <div style={{ padding: "16px 24px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedPlayer(null); setGamelog([]); setError(null); }}
            onKeyDown={handleKey}
            onFocus={() => suggestions.length > 0 && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="Type a player name..."
            style={{ flex: 1, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "9px 12px", color: P.white, fontSize: 13, fontFamily: "'Space Grotesk',sans-serif" }}
          />
          {sugLoading && <div className="spinner" />}
          {query && <button onClick={() => { setQuery(""); setSelectedPlayer(null); setGamelog([]); setError(null); setSuggestions([]); setShowDrop(false); }} style={{ background: "none", border: "none", color: P.dove, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>}
        </div>
        {showDrop && suggestions.length > 0 && (
          <div className="suggest-drop">
            {suggestions.map((p, i) => (
              <div key={p.id} className={`suggest-item${i === activeIdx ? " active" : ""}`}
                onPointerDown={() => selectPlayer(p)}>
                <span style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</span>
                <span style={{ color: P.dove, fontSize: 10, marginLeft: 8, fontFamily: "'Space Mono',monospace" }}>{p.pos}{p.team ? ` · ${p.team}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!selectedPlayer && !loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: P.dove }}>
          <div style={{ fontSize: 32, opacity: 0.1, marginBottom: 12 }}>⬆</div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", fontFamily: "'Syne',sans-serif" }}>SEARCH FOR A PLAYER ABOVE</div>
          <div style={{ fontSize: 10, color: P.dim, marginTop: 6, fontFamily: "'Space Mono',monospace" }}>LAST 5 GAMES · CURRENT SEASON</div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "48px 0", gap: 10, color: P.dove }}>
          <div className="spinner" />
          <span style={{ fontSize: 10, letterSpacing: "0.12em", fontFamily: "'Space Mono',monospace" }}>LOADING STATS...</span>
        </div>
      )}

      {error && !loading && (
        <div style={{ textAlign: "center", padding: "32px 0", color: P.red, fontSize: 12, fontFamily: "'Space Mono',monospace", letterSpacing: "0.08em" }}>{error}</div>
      )}

      {selectedPlayer && gamelog.length > 0 && !loading && (
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 6, overflow: "hidden" }}>
          {/* Player header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: P.white, letterSpacing: "0.04em", fontFamily: "'Syne',sans-serif", lineHeight: 1.1 }}>
                {selectedPlayer.firstName.toUpperCase()} {selectedPlayer.lastName.toUpperCase()}
              </div>
              <div style={{ fontSize: 10, color: P.dove, marginTop: 4, fontFamily: "'Space Mono',monospace", letterSpacing: "0.1em" }}>
                {selectedPlayer.pos}{selectedPlayer.team ? ` · ${selectedPlayer.team}` : ""} · LAST 5 GAMES
              </div>
            </div>
          </div>

          {/* Stats table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: P.bg }}>
                  <th style={{ ...thStyle, textAlign: "left", paddingLeft: 16, width: colW.date }}>DATE</th>
                  <th style={{ ...thStyle, width: colW.opp }}>OPP</th>
                  <th style={{ ...thStyle, width: colW.g }}>G</th>
                  <th style={{ ...thStyle, width: colW.a }}>A</th>
                  <th style={{ ...thStyle, width: colW.pts, color: P.casper }}>PTS</th>
                  <th style={{ ...thStyle, width: colW.pm }}>+/-</th>
                  <th style={{ ...thStyle, width: colW.sog }}>SOG</th>
                  <th style={{ ...thStyle, width: colW.toi }}>TOI</th>
                </tr>
              </thead>
              <tbody>
                {gamelog.map((g, i) => {
                  const isAway = g.homeRoadFlag === "R";
                  const pm = g.plusMinus || 0;
                  const pmColor = pm > 0 ? P.green : pm < 0 ? P.red : P.dove;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : `${P.bg}66` }}>
                      <td style={{ ...tdStyle, textAlign: "left", paddingLeft: 16, color: P.casper }}>{formatDate(g.gameDate)}</td>
                      <td style={{ ...tdStyle, color: P.dove }}>
                        {isAway ? "@ " : ""}{g.opponentAbbrev || "—"}
                      </td>
                      <td style={{ ...tdStyle }}>{g.goals ?? 0}</td>
                      <td style={{ ...tdStyle }}>{g.assists ?? 0}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: P.casper }}>{g.points ?? 0}</td>
                      <td style={{ ...tdStyle, color: pmColor }}>{pm > 0 ? `+${pm}` : pm}</td>
                      <td style={{ ...tdStyle, color: P.dove }}>{g.shots ?? 0}</td>
                      <td style={{ ...tdStyle, color: P.dove }}>{formatTOI(g.toi)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {totals && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${P.border}` }}>
                    <td style={{ ...tdStyle, textAlign: "left", paddingLeft: 16, fontSize: 9, letterSpacing: "0.1em", color: P.dove, borderBottom: "none" }}>L5 TOTAL</td>
                    <td style={{ ...tdStyle, borderBottom: "none" }} />
                    <td style={{ ...tdStyle, fontWeight: 700, borderBottom: "none" }}>{totals.g}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, borderBottom: "none" }}>{totals.a}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: P.casper, borderBottom: "none" }}>{totals.pts}</td>
                    <td style={{ ...tdStyle, color: totals.pm > 0 ? P.green : totals.pm < 0 ? P.red : P.dove, fontWeight: 700, borderBottom: "none" }}>{totals.pm > 0 ? `+${totals.pm}` : totals.pm}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, borderBottom: "none" }}>{totals.sog}</td>
                    <td style={{ ...tdStyle, borderBottom: "none" }}>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");

  // Synchronously update P before children render so all components see the correct palette
  Object.assign(P, isDark ? DARK_PALETTE : LIGHT_PALETTE);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const slugs = useMemo(() => Object.keys(TEAMS_DATA).filter(slug => {
    if (!search.trim()) return true;
    const t = NHL_TEAMS[slug];
    return `${t?.city} ${t?.name} ${t?.abbr}`.toLowerCase().includes(search.toLowerCase());
  }), [search]);

  const toggle = slug => setExpanded(prev => ({ ...prev, [slug]: !prev[slug] }));

  const TABS = ["all", "today", "stats", "injuries", "player", "compare"];
  const TAB_LABELS = { all: "ALL TEAMS", today: "TODAY", stats: "STATS", injuries: "INJURIES", player: "PLAYER STATS", compare: "COMPARE" };

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: P.bg, minHeight: "100vh", color: P.white }}>
      <style>{makeCss(isDark ? DARK_PALETTE : LIGHT_PALETTE)}</style>

      {/* Header */}
      <div style={{ borderTop: `3px solid ${P.casper}`, borderBottom: `1px solid ${P.border}`, padding: "0 24px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", height: HEADER_H, position: "sticky", top: 0, zIndex: 50, background: P.bg }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {tab === "all" && (
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: isMobile ? 100 : 150 }} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
          <img src="/logo.png" height={48} alt="HG" style={{ objectFit: "contain", filter: "invert(1)", flexShrink: 0 }} />
          <div style={{ width: 1, height: 40, background: P.border }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: P.white, lineHeight: 1.05, letterSpacing: "0.06em", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap" }}>BETWEEN THE LINES</div>
            <div style={{ fontSize: 9, color: P.dove, letterSpacing: "0.18em", marginTop: 4, fontFamily: "'Space Mono', monospace" }}>NHL · UPDATED {UPDATED_AT}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          <button
            onClick={() => { const next = !isDark; setIsDark(next); localStorage.setItem("theme", next ? "dark" : "light"); }}
            style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 20, padding: "5px 10px", cursor: "pointer", color: P.casper, fontSize: 14, lineHeight: 1, fontFamily: "inherit", transition: "border-color 0.15s,color 0.15s" }}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? "☀" : "☽"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-bar" style={{ borderBottom: `1px solid ${P.border}`, display: "flex", height: TABS_H, position: "sticky", top: HEADER_H, zIndex: 49, background: P.bg, padding: "0 8px", overflowX: "auto", scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "all" && !isMobile && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", minHeight: `calc(100vh - ${HEADER_H + TABS_H}px)` }}>
            {slugs.map(slug => <TeamStrip key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />)}
          </div>
        </div>
      )}
      {tab === "all" && isMobile && (
        <div>{slugs.map(slug => <MobileRow key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />)}</div>
      )}
      {tab === "today" && <TodayView isMobile={isMobile} />}
      {tab === "stats" && <GoalsAgainstView isMobile={isMobile} />}
      {tab === "injuries" && <InjuriesView isMobile={isMobile} />}
      {tab === "player" && <PlayerStatsView isMobile={isMobile} />}
      {tab === "compare" && <CompareView isMobile={isMobile} />}

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${P.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em", fontFamily: "'Space Mono',monospace" }}>DATA FROM</span>
        <a href="https://www.dailyfaceoff.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 700, color: P.casper, letterSpacing: "0.08em", textDecoration: "none", fontFamily: "'Space Mono',monospace" }}>DAILY FACEOFF</a>
        <span style={{ fontSize: 9, color: P.dim }}>·</span>
        <a href="https://www.nhl.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 700, color: P.casper, letterSpacing: "0.08em", textDecoration: "none", fontFamily: "'Space Mono',monospace" }}>NHL.COM</a>
        <span style={{ fontSize: 9, color: P.dim }}>·</span>
        <span style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em", fontFamily: "'Space Mono',monospace" }}>HIMANK GOEL</span>
      </div>
    </div>
  );
}
