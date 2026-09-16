export function normalizePlayer(player) {
  if (!player?.playerId || typeof player.name !== 'string') return null;
  const parts = player.name.trim().split(/\s+/);
  return {
    id: String(player.playerId),
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
    pos: player.positionCode || '',
    team: player.teamAbbrev || player.lastTeamAbbrev || '',
    active: Boolean(player.active),
  };
}

const NHL_TEAMS = [
  ['ANA', 'anaheim', 'ducks', 'anaheim ducks'],
  ['BOS', 'boston', 'bruins', 'boston bruins'],
  ['BUF', 'buffalo', 'sabres', 'buffalo sabres'],
  ['CGY', 'calgary', 'flames', 'calgary flames'],
  ['CAR', 'carolina', 'hurricanes', 'carolina hurricanes'],
  ['CHI', 'chicago', 'blackhawks', 'chicago blackhawks'],
  ['COL', 'colorado', 'avalanche', 'colorado avalanche'],
  ['CBJ', 'columbus', 'blue jackets', 'columbus blue jackets'],
  ['DAL', 'dallas', 'stars', 'dallas stars'],
  ['DET', 'detroit', 'red wings', 'detroit red wings'],
  ['EDM', 'edmonton', 'oilers', 'edmonton oilers'],
  ['FLA', 'florida', 'panthers', 'florida panthers'],
  ['LAK', 'los angeles', 'kings', 'la kings', 'los angeles kings'],
  ['MIN', 'minnesota', 'wild', 'minnesota wild'],
  ['MTL', 'montreal', 'canadiens', 'habs', 'montreal canadiens'],
  ['NSH', 'nashville', 'predators', 'nashville predators'],
  ['NJD', 'new jersey', 'devils', 'new jersey devils'],
  ['NYI', 'islanders', 'new york islanders', 'ny islanders'],
  ['NYR', 'rangers', 'new york rangers', 'ny rangers'],
  ['OTT', 'ottawa', 'senators', 'ottawa senators'],
  ['PHI', 'philadelphia', 'flyers', 'philadelphia flyers'],
  ['PIT', 'pittsburgh', 'penguins', 'pittsburgh penguins'],
  ['SJS', 'san jose', 'sharks', 'san jose sharks'],
  ['SEA', 'seattle', 'kraken', 'seattle kraken'],
  ['STL', 'st louis', 'blues', 'st louis blues'],
  ['TBL', 'tampa bay', 'lightning', 'tampa bay lightning'],
  ['TOR', 'toronto', 'maple leafs', 'leafs', 'toronto maple leafs'],
  ['UTA', 'utah', 'mammoth', 'utah mammoth'],
  ['VAN', 'vancouver', 'canucks', 'vancouver canucks'],
  ['VGK', 'vegas', 'golden knights', 'vegas golden knights'],
  ['WSH', 'washington', 'capitals', 'washington capitals'],
  ['WPG', 'winnipeg', 'jets', 'winnipeg jets'],
];

const normalizeQuery = value => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .trim()
  .toLowerCase();

const TEAM_ALIASES = NHL_TEAMS.flatMap(([abbr, ...aliases]) =>
  [abbr.toLowerCase(), ...aliases].map(alias => ({ abbr, alias: normalizeQuery(alias) }))
).sort((a, b) => b.alias.length - a.alias.length);

export function parsePlayerQuery(value) {
  const query = normalizeQuery(value);
  const match = TEAM_ALIASES.find(({ alias }) =>
    query === alias || query.startsWith(`${alias} `) || query.endsWith(` ${alias}`)
  );
  if (!match) return { name: value.trim(), team: '' };
  const name = query === match.alias
    ? ''
    : query.startsWith(`${match.alias} `)
      ? query.slice(match.alias.length).trim()
      : query.slice(0, -match.alias.length).trim();
  return { name, team: match.abbr };
}

function normalizeRosterPlayer(player, team) {
  if (!player?.id) return null;
  const firstName = player.firstName?.default || '';
  const lastName = player.lastName?.default || '';
  if (!firstName && !lastName) return null;
  return {
    id: String(player.id),
    firstName,
    lastName,
    pos: player.positionCode || '',
    team,
    active: true,
  };
}

export default async function handler(req, res) {
  const query = String(req.query.q || '').trim();
  if (query.length < 2 || query.length > 60) {
    return res.status(400).json({ error: 'Enter at least 2 characters' });
  }
  try {
    const parsed = parsePlayerQuery(query);
    const url = parsed.team
      ? `https://api-web.nhle.com/v1/roster/${parsed.team}/current`
      : `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=20&q=${encodeURIComponent(parsed.name)}`;
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return res.status(502).json({ error: 'Player search is temporarily unavailable.' });
    const data = await upstream.json();
    const players = parsed.team
      ? ['forwards', 'defensemen', 'goalies']
        .flatMap(group => Array.isArray(data[group]) ? data[group] : [])
        .map(player => normalizeRosterPlayer(player, parsed.team))
        .filter(Boolean)
        .filter(player => !parsed.name || normalizeQuery(`${player.firstName} ${player.lastName}`).includes(normalizeQuery(parsed.name)))
        .slice(0, 25)
      : Array.isArray(data)
        ? data.map(normalizePlayer).filter(Boolean)
        : null;
    if (!players) throw new Error('Invalid player search response');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ players });
  } catch {
    return res.status(502).json({ error: 'Player search is temporarily unavailable.' });
  }
}
