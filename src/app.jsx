import { useState, useEffect, useMemo } from "react";

const DATA_URL = "https://raw.githubusercontent.com/hg913488/nhl-line-combos/main/data/lines.json";

const NHL_TEAMS = {
  "anaheim-ducks":        { city: "Anaheim",     name: "Ducks",         abbr: "ANA", c: "#F47A38" },
  "boston-bruins":        { city: "Boston",      name: "Bruins",        abbr: "BOS", c: "#FFB81C" },
  "buffalo-sabres":       { city: "Buffalo",     name: "Sabres",        abbr: "BUF", c: "#003087" },
  "calgary-flames":       { city: "Calgary",     name: "Flames",        abbr: "CGY", c: "#C8102E" },
  "carolina-hurricanes":  { city: "Carolina",    name: "Hurricanes",    abbr: "CAR", c: "#CC0000" },
  "chicago-blackhawks":   { city: "Chicago",     name: "Blackhawks",    abbr: "CHI", c: "#CF0A2C" },
  "colorado-avalanche":   { city: "Colorado",    name: "Avalanche",     abbr: "COL", c: "#6F263D" },
  "columbus-blue-jackets":{ city: "Columbus",    name: "Blue Jackets",  abbr: "CBJ", c: "#002654" },
  "dallas-stars":         { city: "Dallas",      name: "Stars",         abbr: "DAL", c: "#006847" },
  "detroit-red-wings":    { city: "Detroit",     name: "Red Wings",     abbr: "DET", c: "#CE1126" },
  "edmonton-oilers":      { city: "Edmonton",    name: "Oilers",        abbr: "EDM", c: "#FF4C00" },
  "florida-panthers":     { city: "Florida",     name: "Panthers",      abbr: "FLA", c: "#041E42" },
  "los-angeles-kings":    { city: "Los Angeles", name: "Kings",         abbr: "LA",  c: "#111111" },
  "minnesota-wild":       { city: "Minnesota",   name: "Wild",          abbr: "MIN", c: "#154734" },
  "montreal-canadiens":   { city: "Montréal",    name: "Canadiens",     abbr: "MTL", c: "#AF1E2D" },
  "nashville-predators":  { city: "Nashville",   name: "Predators",     abbr: "NSH", c: "#FFB81C" },
  "new-jersey-devils":    { city: "New Jersey",  name: "Devils",        abbr: "NJD", c: "#CE1126" },
  "new-york-islanders":   { city: "NY Islanders",name: "Islanders",     abbr: "NYI", c: "#003087" },
  "new-york-rangers":     { city: "NY Rangers",  name: "Rangers",       abbr: "NYR", c: "#0038A8" },
  "ottawa-senators":      { city: "Ottawa",      name: "Senators",      abbr: "OTT", c: "#C8102E" },
  "philadelphia-flyers":  { city: "Philadelphia",name: "Flyers",        abbr: "PHI", c: "#F74902" },
  "pittsburgh-penguins":  { city: "Pittsburgh",  name: "Penguins",      abbr: "PIT", c: "#FCB514" },
  "san-jose-sharks":      { city: "San Jose",    name: "Sharks",        abbr: "SJS", c: "#006D75" },
  "seattle-kraken":       { city: "Seattle",     name: "Kraken",        abbr: "SEA", c: "#99D9D9" },
  "st-louis-blues":       { city: "St. Louis",   name: "Blues",         abbr: "STL", c: "#002F87" },
  "tampa-bay-lightning":  { city: "Tampa Bay",   name: "Lightning",     abbr: "TBL", c: "#002868" },
  "toronto-maple-leafs":  { city: "Toronto",     name: "Maple Leafs",   abbr: "TOR", c: "#003E7E" },
  "utah-mammoth":         { city: "Utah",        name: "Mammoth",       abbr: "UTA", c: "#6CACE4" },
  "vancouver-canucks":    { city: "Vancouver",   name: "Canucks",       abbr: "VAN", c: "#00205B" },
  "vegas-golden-knights": { city: "Vegas",       name: "Golden Knights",abbr: "VGK", c: "#B4975A" },
  "washington-capitals":  { city: "Washington",  name: "Capitals",      abbr: "WSH", c: "#C8102E" },
  "winnipeg-jets":        { city: "Winnipeg",    name: "Jets",          abbr: "WPG", c: "#041E42" },
};

const P = {
  bg: "#0d0d0d", surface: "#161616", border: "#252525",
  dove: "#686B6C", casper: "#B8C4CA", white: "#F0F0F0", dim: "#3a3a3a",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${P.bg}; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${P.dim}; border-radius: 2px; }
  input::placeholder { color: ${P.dove}; }
  input:focus { outline: none; }
`;

function Pill({ name }) {
  const parts = name.split(" ");
  const last = parts.slice(-1)[0];
  const first = parts.slice(0, -1).join(" ");
  return (
    <div style={{ padding: "5px 10px", borderRadius: "3px", background: P.surface, border: `1px solid ${P.border}`, display: "inline-flex", alignItems: "baseline", gap: "5px" }}>
      <span style={{ fontSize: "11px", color: P.dove, fontWeight: 400 }}>{first}</span>
      <span style={{ fontSize: "12px", color: P.white, fontWeight: 600, letterSpacing: "0.01em" }}>{last}</span>
    </div>
  );
}

function LineRow({ label, players, accent, tight }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: tight ? "5px" : "7px" }}>
      <span style={{ fontSize: "9px", fontWeight: 700, color: accent, letterSpacing: "0.1em", minWidth: "18px", paddingTop: "6px", textAlign: "right" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {players.map((p, i) => <Pill key={i} name={p} />)}
      </div>
    </div>
  );
}

function TeamCard({ slug, data, onClick }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?", c: P.dove };
  const fwd = data.forwards || [], def = data.defense || [], gol = data.goalies || [];
  const [hov, setHov] = useState(false);
  return (
    <div onClick={() => onClick(slug)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: P.surface, border: `1px solid ${hov ? t.c + "88" : P.border}`, borderRadius: "6px", cursor: "pointer", transition: "border-color 0.15s, transform 0.1s", transform: hov ? "translateY(-1px)" : "none", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderBottom: `1px solid ${P.border}`, background: hov ? t.c + "18" : "transparent", transition: "background 0.15s" }}>
        <div style={{ width: "30px", height: "30px", borderRadius: "5px", background: t.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>{t.abbr}</div>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: P.white, lineHeight: 1.2 }}>{t.city}</div>
          <div style={{ fontSize: "10px", color: P.dove }}>{t.name}</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={{ fontSize: "9px", color: P.dove }}>{fwd.length}L · {def.length}D · {gol.length}G</div>
        </div>
      </div>
      <div style={{ padding: "8px 10px 6px" }}>
        {fwd.length === 0
          ? <div style={{ fontSize: "10px", color: P.dim, padding: "4px 0" }}>No data available</div>
          : fwd.slice(0, 2).map((line, i) => <LineRow key={i} label={`F${i + 1}`} players={line} accent={t.c} tight />)
        }
        {gol[0] && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
            <span style={{ fontSize: "9px", color: P.dove, minWidth: "18px", textAlign: "right" }}>G</span>
            <span style={{ fontSize: "11px", color: P.dove }}>{gol[0][0]?.split(" ").slice(-1)[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamDetail({ slug, data, onBack }) {
  const t = NHL_TEAMS[slug] || { city: slug, name: "", abbr: "?", c: P.dove };
  const fwd = data.forwards || [], def = data.defense || [], gol = data.goalies || [];
  const Divider = ({ label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "18px 0 12px" }}>
      <span style={{ fontSize: "9px", fontWeight: 700, color: P.dove, letterSpacing: "0.14em" }}>{label}</span>
      <div style={{ flex: 1, height: "1px", background: P.border }} />
    </div>
  );
  const Block = ({ p }) => (
    <div style={{ padding: "7px 14px", borderRadius: "4px", background: P.surface, border: `1px solid ${P.border}`, fontSize: "13px", fontWeight: 600, color: P.white }}>{p}</div>
  );
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: P.dove, fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", marginBottom: "20px", letterSpacing: "0.06em", fontFamily: "inherit" }}>← ALL TEAMS</button>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "20px 24px", borderRadius: "8px", background: P.surface, border: `1px solid ${P.border}`, marginBottom: "24px", borderLeft: `4px solid ${t.c}` }}>
        <div style={{ width: "52px", height: "52px", borderRadius: "10px", background: t.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 800, color: "#fff" }}>{t.abbr}</div>
        <div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: P.white, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{t.city}</div>
          <div style={{ fontSize: "13px", color: P.dove, marginTop: "2px" }}>{t.name} · Line Combinations</div>
        </div>
      </div>
      <Divider label="FORWARDS" />
      {fwd.map((line, i) => (
        <div key={i} style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "9px", color: t.c, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "5px" }}>LINE {i + 1}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>{line.map((p, j) => <Block key={j} p={p} />)}</div>
        </div>
      ))}
      <Divider label="DEFENSE" />
      {def.map((pair, i) => (
        <div key={i} style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "9px", color: P.casper, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "5px" }}>PAIR {i + 1}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>{pair.map((p, j) => <Block key={j} p={p} />)}</div>
        </div>
      ))}
      {gol.length > 0 && (
        <>
          <Divider label="GOALIES" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {gol.map((g, i) => (
              <div key={i} style={{ padding: "7px 14px", borderRadius: "4px", background: P.surface, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: P.white }}>{g[0]}</span>
                <span style={{ fontSize: "9px", fontWeight: 700, color: P.dove, letterSpacing: "0.08em" }}>{i === 0 ? "STARTER" : "BACKUP"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SlateView({ teams }) {
  const slugs = Object.keys(teams).filter(s => (teams[s].forwards || []).length > 0);
  const pairs = [];
  for (let i = 0; i + 1 < slugs.length && pairs.length < 8; i += 2) pairs.push([slugs[i], slugs[i + 1]]);
  if (!pairs.length) return <div style={{ color: P.dove, fontSize: "13px", padding: "40px 0", textAlign: "center" }}>No games scheduled today.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ fontSize: "9px", color: P.dove, letterSpacing: "0.12em", marginBottom: "4px" }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()} · TONIGHT'S MATCHUPS
      </div>
      {pairs.map(([away, home], idx) => {
        const ta = NHL_TEAMS[away] || { city: away, abbr: "?", c: P.dove };
        const th = NHL_TEAMS[home] || { city: home, abbr: "?", c: P.dove };
        const da = teams[away] || {}, dh = teams[home] || {};
        return (
          <div key={idx} style={{ borderRadius: "6px", overflow: "hidden", border: `1px solid ${P.border}`, background: P.surface }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${P.border}`, background: `linear-gradient(90deg, ${ta.c}18 0%, transparent 40%, transparent 60%, ${th.c}18 100%)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "26px", height: "26px", borderRadius: "4px", background: ta.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff" }}>{ta.abbr}</div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: P.white }}>{ta.city}</div>
                  <div style={{ fontSize: "9px", color: P.dove }}>AWAY</div>
                </div>
              </div>
              <div style={{ fontSize: "10px", color: P.dim, fontWeight: 700, padding: "0 12px" }}>VS</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: P.white }}>{th.city}</div>
                  <div style={{ fontSize: "9px", color: P.dove }}>HOME</div>
                </div>
                <div style={{ width: "26px", height: "26px", borderRadius: "4px", background: th.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff" }}>{th.abbr}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ padding: "10px 12px", borderRight: `1px solid ${P.border}` }}>
                {(da.forwards || []).slice(0, 2).map((line, i) => <LineRow key={i} label={`F${i + 1}`} players={line} accent={ta.c} tight />)}
                {(da.goalies || [])[0] && <div style={{ marginTop: "4px", fontSize: "10px", color: P.dove }}><span style={{ color: P.dim, marginRight: "4px" }}>G</span>{da.goalies[0][0]?.split(" ").slice(-1)[0]}</div>}
              </div>
              <div style={{ padding: "10px 12px" }}>
                {(dh.forwards || []).slice(0, 2).map((line, i) => <LineRow key={i} label={`F${i + 1}`} players={line} accent={th.c} tight />)}
                {(dh.goalies || [])[0] && <div style={{ marginTop: "4px", fontSize: "10px", color: P.dove }}><span style={{ color: P.dim, marginRight: "4px" }}>G</span>{dh.goalies[0][0]?.split(" ").slice(-1)[0]}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [view, setView] = useState("all");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(DATA_URL)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { setRaw(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const teams = raw?.teams || {};
  const updatedAt = raw?.updated_at || "";

  const visibleSlugs = useMemo(() =>
    Object.keys(teams).filter(slug => {
      if (!search.trim()) return true;
      const t = NHL_TEAMS[slug];
      return `${t?.city} ${t?.name} ${t?.abbr}`.toLowerCase().includes(search.toLowerCase());
    }), [teams, search]);

  const TAB = (active) => ({
    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
    fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", padding: "0 0 10px",
    color: active ? P.white : P.dove,
    borderBottom: `2px solid ${active ? P.casper : "transparent"}`,
    transition: "color 0.15s, border-color 0.15s",
  });

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", background: P.bg, minHeight: "100vh", color: P.white }}>
      <style>{css}</style>
      <div style={{ borderBottom: `1px solid ${P.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "52px", position: "sticky", top: 0, zIndex: 50, background: P.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "6px", height: "28px", borderRadius: "3px", background: `linear-gradient(180deg, ${P.casper}, ${P.dove})` }} />
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: P.white, lineHeight: 1.1 }}>NHL LINE COMBOS</div>
            <div style={{ fontSize: "9px", color: P.dove, letterSpacing: "0.08em" }}>
              {updatedAt ? `UPDATED ${updatedAt.split(" ")[0]}` : "LOADING..."}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          {[["all", "ALL TEAMS"], ["slate", "DAILY SLATE"], ["team", "TEAM VIEW"]].map(([id, lbl]) => (
            <button key={id} style={TAB(view === id)} onClick={() => { setView(id); if (id !== "team") setSelected(null); }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 20px" }}>
        {loading && <div style={{ textAlign: "center", padding: "80px 0", color: P.dove, fontSize: "12px", letterSpacing: "0.1em" }}>LOADING DATA...</div>}
        {err && <div style={{ textAlign: "center", padding: "80px 0", color: "#C8102E", fontSize: "12px" }}>Failed to load: {err}</div>}

        {!loading && !err && (
          <>
            {view === "all" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ fontSize: "10px", color: P.dove, letterSpacing: "0.1em" }}>{Object.keys(teams).length} TEAMS · CLICK TO EXPAND</div>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team..."
                    style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: "4px", padding: "6px 12px", color: P.white, fontSize: "12px", fontFamily: "inherit", width: "180px" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
                  {visibleSlugs.map(slug => <TeamCard key={slug} slug={slug} data={teams[slug]} onClick={s => { setSelected(s); setView("team"); }} />)}
                </div>
              </>
            )}

            {view === "team" && (
              <div style={{ maxWidth: "720px" }}>
                {selected ? (
                  <TeamDetail slug={selected} data={teams[selected] || {}} onBack={() => { setSelected(null); setView("all"); }} />
                ) : (
                  <>
                    <div style={{ fontSize: "10px", color: P.dove, letterSpacing: "0.1em", marginBottom: "16px" }}>SELECT A TEAM</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
                      {Object.keys(teams).map(slug => {
                        const t = NHL_TEAMS[slug] || { city: slug, abbr: "?", c: P.dove };
                        return (
                          <button key={slug} onClick={() => setSelected(slug)}
                            style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: "5px", padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "10px", transition: "border-color 0.15s", textAlign: "left" }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = t.c + "88"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = P.border}>
                            <div style={{ width: "26px", height: "26px", borderRadius: "4px", background: t.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>{t.abbr}</div>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 600, color: P.white }}>{t.city}</div>
                              <div style={{ fontSize: "10px", color: P.dove }}>{t.name}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {view === "slate" && (
              <div style={{ maxWidth: "820px" }}>
                <SlateView teams={teams} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
