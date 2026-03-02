import { useState, useMemo, useEffect } from "react";
import lineups from '../data/lines.json';
import scheduleRaw from './schedule.csv?raw';

const UPDATED_AT = lineups.updated_at.slice(0, 10);
const TEAMS_DATA = lineups.teams;
const SCHEDULE_RAW = scheduleRaw;

const NHL_TEAMS = {
  "anaheim-ducks":        { city: "Anaheim",      name: "Ducks",         abbr: "ANA" },
  "boston-bruins":        { city: "Boston",       name: "Bruins",        abbr: "BOS" },
  "buffalo-sabres":       { city: "Buffalo",      name: "Sabres",        abbr: "BUF" },
  "calgary-flames":       { city: "Calgary",      name: "Flames",        abbr: "CGY" },
  "carolina-hurricanes":  { city: "Carolina",     name: "Hurricanes",    abbr: "CAR" },
  "chicago-blackhawks":   { city: "Chicago",      name: "Blackhawks",    abbr: "CHI" },
  "colorado-avalanche":   { city: "Colorado",     name: "Avalanche",     abbr: "COL" },
  "columbus-blue-jackets":{ city: "Columbus",     name: "Blue Jackets",  abbr: "CBJ" },
  "dallas-stars":         { city: "Dallas",       name: "Stars",         abbr: "DAL" },
  "detroit-red-wings":    { city: "Detroit",      name: "Red Wings",     abbr: "DET" },
  "edmonton-oilers":      { city: "Edmonton",     name: "Oilers",        abbr: "EDM" },
  "florida-panthers":     { city: "Florida",      name: "Panthers",      abbr: "FLA" },
  "los-angeles-kings":    { city: "Los Angeles",  name: "Kings",         abbr: "LAK" },
  "minnesota-wild":       { city: "Minnesota",    name: "Wild",          abbr: "MIN" },
  "montreal-canadiens":   { city: "Montréal",     name: "Canadiens",     abbr: "MTL" },
  "nashville-predators":  { city: "Nashville",    name: "Predators",     abbr: "NSH" },
  "new-jersey-devils":    { city: "New Jersey",   name: "Devils",        abbr: "NJD" },
  "new-york-islanders":   { city: "NY Isles",     name: "Islanders",     abbr: "NYI" },
  "new-york-rangers":     { city: "NY Rangers",   name: "Rangers",       abbr: "NYR" },
  "ottawa-senators":      { city: "Ottawa",       name: "Senators",      abbr: "OTT" },
  "philadelphia-flyers":  { city: "Philadelphia", name: "Flyers",        abbr: "PHI" },
  "pittsburgh-penguins":  { city: "Pittsburgh",   name: "Penguins",      abbr: "PIT" },
  "san-jose-sharks":      { city: "San Jose",     name: "Sharks",        abbr: "SJS" },
  "seattle-kraken":       { city: "Seattle",      name: "Kraken",        abbr: "SEA" },
  "st-louis-blues":       { city: "St. Louis",    name: "Blues",         abbr: "STL" },
  "tampa-bay-lightning":  { city: "Tampa Bay",    name: "Lightning",     abbr: "TBL" },
  "toronto-maple-leafs":  { city: "Toronto",      name: "Maple Leafs",   abbr: "TOR" },
  "utah-mammoth":         { city: "Utah",         name: "Mammoth",       abbr: "UTA" },
  "vancouver-canucks":    { city: "Vancouver",    name: "Canucks",       abbr: "VAN" },
  "vegas-golden-knights": { city: "Vegas",        name: "Golden Knights",abbr: "VGK" },
  "washington-capitals":  { city: "Washington",   name: "Capitals",      abbr: "WSH" },
  "winnipeg-jets":        { city: "Winnipeg",     name: "Jets",          abbr: "WPG" },
};

const NAME_TO_SLUG = Object.fromEntries(
  Object.entries(NHL_TEAMS).map(([slug, t]) => [`${t.city} ${t.name}`, slug])
);
const NAME_OVERRIDES = {
  "Vegas Golden Knights": "vegas-golden-knights",
  "Utah Mammoth": "utah-mammoth",
  "NY Rangers": "new-york-rangers",
  "NY Islanders": "new-york-islanders",
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
    const [date, away, home] = line.split("\t");
    if (date === todayStr) {
      const awaySlug = nameToSlug(away);
      const homeSlug = nameToSlug(home);
      if (awaySlug && homeSlug) games.push({ away: awaySlug, home: homeSlug });
    }
  }
  return games;
}

const P = {
  bg: "#0d0d0d", surface: "#161616", border: "#252525",
  dove: "#686B6C", casper: "#B8C4CA", white: "#F0F0F0", dim: "#3a3a3a",
  hover: "#1a2530", active: "#1e2d3d", accent: "#2a4a6b",
};

// LA Kings uses "LAK" in the NHL asset URL
const LOGO_ABBR_OVERRIDE = {
  "los-angeles-kings": "LAK",
};

const LOGO_URL = (slug, abbr) => {
  const logoAbbr = LOGO_ABBR_OVERRIDE[slug] || abbr;
  return `https://assets.nhle.com/logos/nhl/svg/${logoAbbr}_dark.svg`;
};

const COLLAPSED_W = 100;
const EXPANDED_W = 320;

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${P.bg}; height: 100%; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${P.dim}; border-radius: 2px; }
  input:focus { outline: none; }
  .strip {
    flex-shrink: 0;
    width: ${COLLAPSED_W}px;
    transition: width 0.35s cubic-bezier(0.4,0,0.2,1), background 0.15s;
    overflow: hidden;
    cursor: pointer;
    border-right: 1px solid ${P.border};
    position: relative;
    background: ${P.surface};
    user-select: none;
  }
  .strip:last-child { border-right: none; }
  .strip:hover { background: ${P.hover}; }
  .strip.expanded { width: ${EXPANDED_W}px; background: ${P.active}; }
  .strip.expanded:hover { background: ${P.active}; }
  .mobile-row { border-bottom: 1px solid ${P.border}; background: ${P.surface}; cursor: pointer; transition: background 0.15s; }
  .mobile-row:hover { background: ${P.hover}; }
  .mobile-row.open { background: ${P.active}; }
  .mobile-body { overflow: hidden; max-height: 0; transition: max-height 0.35s cubic-bezier(0.4,0,0.2,1); }
  .mobile-body.open { max-height: 2000px; }
  .tab-btn { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; padding: 0 16px; height: 100%; transition: color 0.15s, border-bottom 0.15s; border-bottom: 2px solid transparent; }
  .tab-btn.active { color: ${P.white}; border-bottom-color: ${P.casper}; }
  .tab-btn:not(.active) { color: ${P.dove}; }
  .tab-btn:not(.active):hover { color: ${P.casper}; }
  .compare-chip { display: flex; align-items: center; gap: 6px; background: ${P.surface}; border: 1px solid ${P.border}; border-radius: 20px; padding: 4px 10px 4px 6px; cursor: pointer; transition: border-color 0.15s; }
  .compare-chip:hover { border-color: ${P.dove}; }
  .compare-chip.selected { border-color: ${P.casper}; background: ${P.active}; }
  .rm-btn { background: none; border: none; cursor: pointer; color: ${P.dove}; font-size: 14px; line-height: 1; padding: 0 0 0 4px; }
  .rm-btn:hover { color: ${P.white}; }
`;

function SiteLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <path d="M34 18 Q60 42 86 18" stroke={P.casper} strokeWidth="1.2" fill="none" opacity="0.7" transform="rotate(180,60,27)"/>
      <path d="M34 21 Q60 43 86 21" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.4" transform="rotate(180,60,27)"/>
      <path d="M35 25 Q60 44 85 25" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.35" transform="rotate(180,60,27)"/>
      <path d="M36 29 Q60 44 84 29" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.3" transform="rotate(180,60,27)"/>
      <path d="M38 33 Q60 44 82 33" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.25" transform="rotate(180,60,27)"/>
      <path d="M41 37 Q60 44 79 37" stroke={P.dove} strokeWidth="0.45" fill="none" opacity="0.2" transform="rotate(180,60,27)"/>
      <line x1="44" y1="12" x2="42" y2="38" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="52" y1="12" x2="51" y2="41" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="60" y1="12" x2="60" y2="42" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="68" y1="12" x2="69" y2="41" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="76" y1="12" x2="78" y2="38" stroke={P.dove} strokeWidth="0.45" opacity="0.35" transform="rotate(180,60,27)"/>
      <line x1="60" y1="12" x2="60" y2="18" stroke={P.casper} strokeWidth="0.8" opacity="0.5" transform="rotate(180,60,27)"/>
      <line x1="34" y1="12" x2="86" y2="12" stroke={P.casper} strokeWidth="1.2" opacity="0.7" transform="rotate(180,60,27)"/>
      <line x1="34" y1="12" x2="34" y2="18" stroke={P.casper} strokeWidth="1.2" opacity="0.7" transform="rotate(180,60,27)"/>
      <line x1="86" y1="12" x2="86" y2="18" stroke={P.casper} strokeWidth="1.2" opacity="0.7" transform="rotate(180,60,27)"/>
      <ellipse cx="60" cy="28" rx="10" ry="6" fill={P.casper} opacity="0.08"/>
      <ellipse cx="60" cy="28" rx="8" ry="4.5" fill={P.dim} stroke={P.casper} strokeWidth="1"/>
      <ellipse cx="60" cy="27" rx="7" ry="3.5" fill="#222" stroke={P.dove} strokeWidth="0.5"/>
      <ellipse cx="57" cy="26" rx="2.5" ry="1.2" fill={P.casper} opacity="0.12"/>
      <path d="M60 33 Q61 40 60 48" stroke={P.casper} strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
      <circle cx="60" cy="49" r="1.5" fill={P.casper} opacity="0.35"/>
      <line x1="8" y1="62" x2="105" y2="62" stroke={P.dove} strokeWidth="1.5" strokeDasharray="5 5" strokeLinecap="round"/>
      <line x1="8" y1="75" x2="105" y2="75" stroke={P.white} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8" y1="88" x2="105" y2="88" stroke={P.dove} strokeWidth="1.5" strokeDasharray="5 5" strokeLinecap="round"/>
      <circle cx="62" cy="62" r="3.5" fill={P.surface} stroke={P.dove} strokeWidth="1.2"/>
      <circle cx="62" cy="75" r="5" fill={P.surface} stroke={P.casper} strokeWidth="1.5"/>
      <circle cx="62" cy="88" r="3.5" fill={P.surface} stroke={P.dove} strokeWidth="1.2"/>
      <line x1="62" y1="65.5" x2="62" y2="70" stroke={P.dim} strokeWidth="0.8"/>
      <line x1="62" y1="80" x2="62" y2="84.5" stroke={P.dim} strokeWidth="0.8"/>
    </svg>
  );
}

function TeamLogo({ slug, abbr, size = 48 }) {
  const [err, setErr] = useState(false);
  if (err) return (
    <div style={{ width: size, height: size, borderRadius: 6, background: P.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.22, fontWeight: 800, color: P.white, flexShrink: 0 }}>
      {abbr}
    </div>
  );
  return (
    <img
      src={LOGO_URL(slug, abbr)}
      alt={abbr}
      width={size}
      height={size}
      onError={() => setErr(true)}
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
}

function PlayerCard({ name, pos }) {
  const parts = name.split(" ");
  const last = parts.slice(-1)[0];
  const first = parts.slice(0, -1).join(" ");
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 8, fontWeight: 700, color: P.dove, letterSpacing: "0.1em", marginBottom: 3 }}>{pos}</span>
      <span style={{ fontSize: 8, color: P.dove, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textAlign: "center" }}>{first}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: P.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textAlign: "center" }}>{last}</span>
    </div>
  );
}

function ForwardLine({ line, lineNum }) {
  const pos = line.length === 3 ? ["LW","C","RW"] : line.length === 2 ? ["C","RW"] : ["C"];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: P.casper, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5 }}>LINE {lineNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{line.map((p, i) => <PlayerCard key={i} name={p} pos={pos[i]} />)}</div>
    </div>
  );
}

function DefensePair({ pair, pairNum }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: P.dove, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 5 }}>PAIR {pairNum}</div>
      <div style={{ display: "flex", gap: 4 }}>{pair.map((p, i) => <PlayerCard key={i} name={p} pos={i === 0 ? "LD" : "RD"} />)}</div>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: P.casper, letterSpacing: "0.14em", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: P.border }} />
    </div>
  );
}

function LineupContent({ data }) {
  const fwd = data.forwards || [], def = data.defense || [], gol = data.goalies || [];
  return (
    <>
      <Divider label="FORWARDS" />
      {fwd.map((line, i) => <ForwardLine key={i} line={line} lineNum={i + 1} />)}
      <Divider label="DEFENSE" />
      {def.map((pair, i) => <DefensePair key={i} pair={pair} pairNum={i + 1} />)}
      {gol.length > 0 && (<><Divider label="GOALIES" /><div style={{ display: "flex", gap: 4 }}>{gol.map((g, i) => <PlayerCard key={i} name={g[0]} pos={i === 0 ? "STR" : "BKP"} />)}</div></>)}
    </>
  );
}

function TeamStrip({ slug, data, expanded, onToggle }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?" };
  return (
    <div className={`strip${expanded ? " expanded" : ""}`} onClick={onToggle}>
      <div style={{ position: "absolute", top: 0, left: 0, width: COLLAPSED_W, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, opacity: expanded ? 0 : 1, transition: "opacity 0.15s", pointerEvents: "none", padding: "0 10px" }}>
        <TeamLogo slug={slug} abbr={t.abbr} size={52} />
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 600, color: P.casper, letterSpacing: "0.14em", whiteSpace: "nowrap" }}>{t.city.toUpperCase()}</div>
      </div>
      <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s 0.15s", padding: "18px 16px", minWidth: EXPANDED_W, pointerEvents: expanded ? "auto" : "none", overflowY: "auto", maxHeight: "calc(100vh - 104px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${P.border}` }}>
          <TeamLogo slug={slug} abbr={t.abbr} size={48} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.white, lineHeight: 1.1 }}>{t.city}</div>
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
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
        <TeamLogo slug={slug} abbr={t.abbr} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.white }}>{t.city}</div>
          <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
        </div>
        <div style={{ fontSize: 18, color: P.dove, lineHeight: 1, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>▾</div>
      </div>
      <div className={`mobile-body${expanded ? " open" : ""}`}>
        <div style={{ padding: "0 16px 20px" }}><LineupContent data={data} /></div>
      </div>
    </div>
  );
}

function CompareView({ isMobile }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");

  const toggle = (slug) => {
    setSelected(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  };

  const filteredSlugs = useMemo(() => Object.keys(NHL_TEAMS).filter(slug => {
    const t = NHL_TEAMS[slug];
    return `${t.city} ${t.name} ${t.abbr}`.toLowerCase().includes(search.toLowerCase());
  }), [search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 104px)" }}>
      <div style={{ borderBottom: `1px solid ${P.border}`, padding: "12px 16px", background: P.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter teams..."
            style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: 160 }} />
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", color: P.dove, fontSize: 9, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em" }}>
              CLEAR ALL
            </button>
          )}
          <span style={{ fontSize: 10, color: P.dove, marginLeft: "auto" }}>{selected.length} selected</span>
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
          <span style={{ fontSize: 12, color: P.dove, letterSpacing: "0.1em" }}>SELECT TEAMS ABOVE TO COMPARE</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ display: "flex", height: "100%", minWidth: selected.length * (EXPANDED_W + 1) }}>
            {selected.map((slug, i) => {
              const t = NHL_TEAMS[slug];
              const data = TEAMS_DATA[slug];
              return (
                <div key={slug} style={{ width: EXPANDED_W, flexShrink: 0, borderRight: i < selected.length - 1 ? `1px solid ${P.border}` : "none", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "14px 16px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, background: P.surface, position: "sticky", top: 0 }}>
                    <TeamLogo slug={slug} abbr={t.abbr} size={40} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: P.white }}>{t.city}</div>
                      <div style={{ fontSize: 10, color: P.dove }}>{t.name}</div>
                    </div>
                    <button className="rm-btn" style={{ marginLeft: "auto", fontSize: 18 }} onClick={() => toggle(slug)}>×</button>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1, padding: "0 16px 20px" }}>
                    <LineupContent data={data} />
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

function TodayView({ isMobile }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (slug) => setExpanded(prev => ({ ...prev, [slug]: !prev[slug] }));
  const TODAY_GAMES = useMemo(() => getTodayGames(), []);
  const todaySlugs = useMemo(() => {
    const slugs = [];
    TODAY_GAMES.forEach(g => { slugs.push(g.away); slugs.push(g.home); });
    return slugs;
  }, [TODAY_GAMES]);

  if (isMobile) {
    return (
      <div>
        {TODAY_GAMES.map((g, i) => {
          const away = NHL_TEAMS[g.away], home = NHL_TEAMS[g.home];
          return (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 16px", background: P.dim + "33", borderBottom: `1px solid ${P.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: P.dove }}>{away?.abbr}</span>
                <span style={{ fontSize: 9, color: P.dim }}>@</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: P.dove }}>{home?.abbr}</span>
              </div>
              {[g.away, g.home].map(slug => (
                <MobileRow key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${P.border}`, background: P.surface, position: "sticky", top: 0, zIndex: 10, minWidth: todaySlugs.length * COLLAPSED_W }}>
        {TODAY_GAMES.map((g, i) => (
          <div key={i} style={{ display: "flex", width: COLLAPSED_W * 2, flexShrink: 0, alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0", borderRight: `1px solid ${P.border}` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: P.dove }}>{NHL_TEAMS[g.away]?.abbr}</span>
            <span style={{ fontSize: 8, color: P.dim }}>@</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: P.dove }}>{NHL_TEAMS[g.home]?.abbr}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "stretch", minHeight: "calc(100vh - 140px)" }}>
        {todaySlugs.map(slug => (
          <TeamStrip key={slug} slug={slug} data={TEAMS_DATA[slug]} expanded={!!expanded[slug]} onToggle={() => toggle(slug)} />
        ))}
      </div>
    </div>
  );
}

const HEADER_H = 68;
const TABS_H = 36;

export default function App() {
  const [tab, setTab] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const slugs = useMemo(() =>
    Object.keys(TEAMS_DATA).filter(slug => {
      if (!search.trim()) return true;
      const t = NHL_TEAMS[slug];
      return `${t?.city} ${t?.name} ${t?.abbr}`.toLowerCase().includes(search.toLowerCase());
    }), [search]);

  const toggle = (slug) => setExpanded(prev => ({ ...prev, [slug]: !prev[slug] }));

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: P.bg, minHeight: "100vh", color: P.white }}>
      <style>{css}</style>

      {/* Header — centered title, GoelStudio credit on right */}
      <div style={{
        borderBottom: `1px solid ${P.border}`,
        padding: "0 16px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        height: HEADER_H,
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: P.bg,
      }}>
        {/* Left: search (only on ALL tab) */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {tab === "all" && (
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 4, padding: "6px 10px", color: P.white, fontSize: 12, fontFamily: "inherit", width: isMobile ? 100 : 150 }} />
          )}
        </div>

        {/* Center: logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <SiteLogo size={36} />
          <div style={{ width: 1, height: 30, background: P.border }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.white, lineHeight: 1.1 }}>NHL LINE COMBOS</div>
            <div style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em" }}>UPDATED {UPDATED_AT}</div>
          </div>
        </div>

        {/* Right: credit */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: P.dove, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            Created by <span style={{ color: P.casper, fontWeight: 600 }}>GoelStudio</span>
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: `1px solid ${P.border}`, display: "flex", height: TABS_H, position: "sticky", top: HEADER_H, zIndex: 49, background: P.bg }}>
        {["all","today","compare"].map(t => (
          <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "all" ? "ALL TEAMS" : t === "today" ? "TODAY" : "COMPARE"}
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
      {tab === "compare" && <CompareView isMobile={isMobile} />}
    </div>
  );
}
