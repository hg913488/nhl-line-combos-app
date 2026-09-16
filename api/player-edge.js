import { currentSeason, validSeason } from './gamelog.js';

const EDGE_BASE = 'https://api-web.nhle.com/v1/edge';
const UPSTREAM_TIMEOUT_MS = 6500;
const SECTION_ENDPOINTS = {
  details: 'skater-detail',
  comparison: 'skater-comparison',
  shotSpeed: 'skater-shot-speed-detail',
  skatingSpeed: 'skater-skating-speed-detail',
  zoneTime: 'skater-zone-time',
};

const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? Number(value)
  : null;
const rounded = (value, places = 2) => {
  const parsed = number(value);
  return parsed == null ? null : Number(parsed.toFixed(places));
};
const percentile = value => {
  const parsed = number(value);
  if (parsed == null) return null;
  return rounded(Math.abs(parsed) <= 1 ? parsed * 100 : parsed, 1);
};
const localized = value => value?.default || (typeof value === 'string' ? value : '');

function metric(source, unit, valueKey = 'value', averageKey = valueKey) {
  if (!source || typeof source !== 'object') return null;
  const value = number(source[valueKey]);
  if (value == null) return null;
  return {
    value: rounded(value),
    unit,
    percentile: percentile(source.percentile),
    rank: number(source.rank),
    leagueAverage: rounded(source.leagueAvg?.[averageKey] ?? source.leagueAverage?.[averageKey]),
  };
}

function normalizePlayer(player, fallbackId) {
  if (!player || typeof player !== 'object') return null;
  return {
    id: String(player.id ?? fallbackId),
    firstName: localized(player.firstName),
    lastName: localized(player.lastName),
    position: player.position || player.positionCode || '',
    team: player.team?.abbrev || player.teamAbbrev || '',
    sweaterNumber: number(player.sweaterNumber),
    headshot: typeof player.headshot === 'string' ? player.headshot : '',
  };
}

function normalizeEvent(event, valueKey, unit) {
  const value = metric(event?.[valueKey], unit, 'imperial', 'imperial');
  if (!value) return null;
  return {
    date: typeof event.gameDate === 'string' ? event.gameDate : null,
    value: value.value,
    unit,
    opponent: event.playerOnHomeTeam ? event.awayTeam?.abbrev || null : event.homeTeam?.abbrev || null,
    gameCenterLink: typeof event.gameCenterLink === 'string' ? event.gameCenterLink : null,
  };
}

function zoneRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    strength: row.strengthCode || 'all',
    offensive: {
      share: percentile(row.offensiveZonePctg),
      percentile: percentile(row.offensiveZonePercentile),
      leagueAverage: percentile(row.offensiveZoneLeagueAvg),
    },
    neutral: {
      share: percentile(row.neutralZonePctg),
      percentile: percentile(row.neutralZonePercentile),
      leagueAverage: percentile(row.neutralZoneLeagueAvg),
    },
    defensive: {
      share: percentile(row.defensiveZonePctg),
      percentile: percentile(row.defensiveZonePercentile),
      leagueAverage: percentile(row.defensiveZoneLeagueAvg),
    },
  };
}

export function normalizeEdgeResponse(playerId, season, gameType, payloads, fetchedAt = new Date().toISOString()) {
  const available = key => payloads[key]?.ok === true;
  const data = key => available(key) ? payloads[key].data : null;
  const detail = data('details');
  const comparison = data('comparison');
  const zones = data('zoneTime');
  const successfulSections = Object.keys(SECTION_ENDPOINTS).filter(available);
  const zoneSummary = detail?.zoneTimeDetails
    || zones?.zoneTimeDetails?.find(row => row?.strengthCode === 'all')
    || zones?.zoneTimeDetails?.[0];

  const sections = {
    details: {
      available: available('details'),
      shotLocations: Array.isArray(detail?.sogSummary)
        ? detail.sogSummary.slice(0, 8).map(row => ({
          area: row.locationCode || '',
          shots: number(row.shots),
          goals: number(row.goals),
          shootingPercentage: percentile(row.shootingPctg),
          shotsPercentile: percentile(row.shotsPercentile),
          goalsPercentile: percentile(row.goalsPercentile),
        }))
        : [],
    },
    comparison: {
      available: available('comparison'),
      averageShotSpeed: metric(comparison?.shotSpeedDetails?.avgShotSpeed, 'mph', 'imperial', 'imperial'),
      bursts: comparison?.skatingSpeedDetails ? {
        over22Mph: number(comparison.skatingSpeedDetails.burstsOver22),
        from20To22Mph: number(comparison.skatingSpeedDetails.bursts20To22),
        from18To20Mph: number(comparison.skatingSpeedDetails.bursts18To20),
      } : null,
    },
    shotSpeed: {
      available: available('shotSpeed'),
      hardest: Array.isArray(data('shotSpeed')?.hardestShots)
        ? data('shotSpeed').hardestShots.slice(0, 5).map(event => normalizeEvent(event, 'shotSpeed', 'mph')).filter(Boolean)
        : [],
    },
    skatingSpeed: {
      available: available('skatingSpeed'),
      fastest: Array.isArray(data('skatingSpeed')?.topSkatingSpeeds)
        ? data('skatingSpeed').topSkatingSpeeds.slice(0, 5).map(event => normalizeEvent(event, 'skatingSpeed', 'mph')).filter(Boolean)
        : [],
    },
    zoneTime: {
      available: available('zoneTime'),
      strengths: Array.isArray(zones?.zoneTimeDetails) ? zones.zoneTimeDetails.map(zoneRow).filter(Boolean) : [],
      starts: zones?.zoneStarts ? {
        offensive: percentile(zones.zoneStarts.offensiveZoneStartsPctg),
        offensivePercentile: percentile(zones.zoneStarts.offensiveZoneStartsPctgPercentile),
        neutral: percentile(zones.zoneStarts.neutralZoneStartsPctg),
        neutralPercentile: percentile(zones.zoneStarts.neutralZoneStartsPctgPercentile),
        defensive: percentile(zones.zoneStarts.defensiveZoneStartsPctg),
        defensivePercentile: percentile(zones.zoneStarts.defensiveZoneStartsPctgPercentile),
      } : null,
    },
  };

  return {
    availability: successfulSections.length === 0
      ? 'unavailable'
      : successfulSections.length === Object.keys(SECTION_ENDPOINTS).length ? 'available' : 'partial',
    playerId: String(playerId),
    season,
    gameType: Number(gameType),
    player: normalizePlayer(detail?.player || comparison?.player, playerId),
    headline: {
      topShotSpeed: metric(detail?.topShotSpeed || comparison?.shotSpeedDetails?.topShotSpeed, 'mph', 'imperial', 'imperial'),
      maxSkatingSpeed: metric(detail?.skatingSpeed?.speedMax || comparison?.skatingSpeedDetails?.maxSkatingSpeed, 'mph', 'imperial', 'imperial'),
      burstsOver20Mph: metric(detail?.skatingSpeed?.burstsOver20, 'bursts'),
      totalDistanceSkated: metric(detail?.totalDistanceSkated, 'mi', 'imperial', 'imperial'),
      offensiveZoneShare: zoneSummary ? {
        value: percentile(zoneSummary.offensiveZonePctg),
        unit: 'percent',
        percentile: percentile(zoneSummary.offensiveZonePercentile),
        rank: number(zoneSummary.offensiveZoneRank),
        leagueAverage: percentile(zoneSummary.offensiveZoneLeagueAvg),
      } : null,
    },
    sections,
    source: {
      provider: 'NHL Edge',
      status: 'unofficial',
      fetchedAt,
      successfulSections,
      requestedSections: Object.keys(SECTION_ENDPOINTS),
      cacheSeconds: successfulSections.length ? 900 : 30,
    },
  };
}

async function fetchSection(endpoint, playerId, season, gameType) {
  try {
    const response = await fetch(`${EDGE_BASE}/${endpoint}/${playerId}/${season}/${gameType}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false };
    const data = await response.json();
    return data && typeof data === 'object' ? { ok: true, data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export default async function handler(req, res) {
  const { playerId, season = currentSeason(), gameType = '2' } = req.query;
  if (!/^\d{1,10}$/.test(playerId || '') || !validSeason(season) || !['2', '3'].includes(String(gameType))) {
    return res.status(400).json({ error: 'Invalid player, season, or game type' });
  }

  const entries = Object.entries(SECTION_ENDPOINTS);
  const results = await Promise.all(entries.map(([, endpoint]) => fetchSection(endpoint, playerId, season, gameType)));
  const payloads = Object.fromEntries(entries.map(([key], index) => [key, results[index]]));
  const body = normalizeEdgeResponse(playerId, season, gameType, payloads);
  const cache = body.availability === 'unavailable'
    ? 's-maxage=30, stale-while-revalidate=60'
    : 's-maxage=900, stale-while-revalidate=3600';
  res.setHeader('Cache-Control', cache);
  return res.status(200).json(body);
}
