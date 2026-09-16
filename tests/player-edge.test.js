import test from 'node:test';
import assert from 'node:assert/strict';
import playerEdge, { normalizeEdgeResponse } from '../api/player-edge.js';

function response() {
  return {
    code: 200,
    headers: {},
    status(code) { this.code = code; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    json(body) { this.body = body; return this; },
  };
}

const fixtures = {
  'skater-detail': {
    player: {
      id: 8478402,
      firstName: { default: 'Connor' },
      lastName: { default: 'McDavid' },
      position: 'C',
      sweaterNumber: 97,
      headshot: 'https://assets.nhle.com/mug.png',
      team: { abbrev: 'EDM' },
    },
    topShotSpeed: { imperial: 82.05, percentile: 0.3098, leagueAvg: { imperial: 83.62 } },
    skatingSpeed: {
      speedMax: { imperial: 24.6119, percentile: 0.9967, leagueAvg: { imperial: 22.1684 } },
      burstsOver20: { value: 681, percentile: 1, leagueAvg: { value: 75.2 } },
    },
    totalDistanceSkated: { imperial: 330.2671, percentile: 1, leagueAvg: { imperial: 123.5454 } },
    sogSummary: [{ locationCode: 'high', shots: 120, goals: 26, shootingPctg: 0.2167, shotsPercentile: 0.9984, goalsPercentile: 0.9951 }],
    zoneTimeDetails: { offensiveZonePctg: 0.47687929, offensiveZonePercentile: 0.9788, offensiveZoneLeagueAvg: 0.43087924 },
  },
  'skater-comparison': {
    shotSpeedDetails: { avgShotSpeed: { imperial: 48.3919 } },
    skatingSpeedDetails: { burstsOver22: 151, bursts20To22: 530, bursts18To20: 922 },
  },
  'skater-shot-speed-detail': {
    hardestShots: [{ gameDate: '2026-01-01', playerOnHomeTeam: false, shotSpeed: { imperial: 82.05 }, homeTeam: { abbrev: 'VAN' }, gameCenterLink: '/gamecenter/test' }],
  },
  'skater-skating-speed-detail': {
    topSkatingSpeeds: [{ gameDate: '2026-01-02', playerOnHomeTeam: true, skatingSpeed: { imperial: 24.6119 }, awayTeam: { abbrev: 'CGY' } }],
  },
  'skater-zone-time': {
    zoneTimeDetails: [{ strengthCode: 'all', offensiveZonePctg: 0.4769, offensiveZonePercentile: 0.9788, offensiveZoneLeagueAvg: 0.4309, neutralZonePctg: 0.1692, defensiveZonePctg: 0.3539 }],
    zoneStarts: { offensiveZoneStartsPctg: 0.4407, offensiveZoneStartsPctgPercentile: 0.9537 },
  },
};

test('rejects invalid identifiers and options before fetching', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not fetch'); });
  for (const query of [
    { playerId: 'bad', season: '20252026', gameType: '2' },
    { playerId: '8478402', season: '20252027', gameType: '2' },
    { playerId: '8478402', season: '20252026', gameType: '9' },
  ]) {
    const res = response();
    await playerEdge({ query }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('fetches Edge sections in parallel and returns a compact stable response', async t => {
  const pending = [];
  t.mock.method(globalThis, 'fetch', url => new Promise(resolve => {
    pending.push({ url, resolve });
    if (pending.length === 5) {
      for (const request of pending) {
        const endpoint = Object.keys(fixtures).find(key => request.url.includes(`/${key}/`));
        request.resolve({ ok: true, json: async () => fixtures[endpoint] });
      }
    }
  }));

  const res = response();
  await playerEdge({ query: { playerId: '8478402', season: '20252026', gameType: '2' } }, res);

  assert.equal(pending.length, 5);
  assert.equal(res.code, 200);
  assert.equal(res.body.availability, 'available');
  assert.deepEqual(res.body.player, {
    id: '8478402', firstName: 'Connor', lastName: 'McDavid', position: 'C', team: 'EDM',
    sweaterNumber: 97, headshot: 'https://assets.nhle.com/mug.png',
  });
  assert.deepEqual(res.body.headline.maxSkatingSpeed, {
    value: 24.61, unit: 'mph', percentile: 99.7, rank: null, leagueAverage: 22.17,
  });
  assert.equal(res.body.headline.offensiveZoneShare.value, 47.7);
  assert.equal(res.body.sections.comparison.averageShotSpeed.value, 48.39);
  assert.equal(res.body.sections.shotSpeed.hardest[0].opponent, 'VAN');
  assert.equal(res.body.sections.zoneTime.strengths[0].offensive.percentile, 97.9);
  assert.deepEqual(res.body.source.successfulSections, ['details', 'comparison', 'shotSpeed', 'skatingSpeed', 'zoneTime']);
  assert.match(res.headers['Cache-Control'], /s-maxage=900/);
});

test('degrades individual sections without failing the response', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('/skater-shot-speed-detail/')) throw new Error('schema moved');
    if (url.includes('/skater-zone-time/')) return { ok: false };
    const endpoint = Object.keys(fixtures).find(key => url.includes(`/${key}/`));
    return { ok: true, json: async () => fixtures[endpoint] };
  });

  const res = response();
  await playerEdge({ query: { playerId: '8478402', season: '20252026' } }, res);

  assert.equal(res.code, 200);
  assert.equal(res.body.availability, 'partial');
  assert.equal(res.body.sections.shotSpeed.available, false);
  assert.deepEqual(res.body.sections.shotSpeed.hardest, []);
  assert.equal(res.body.sections.zoneTime.available, false);
  assert.equal(res.body.headline.topShotSpeed.value, 82.05);
});

test('returns an unavailable contract and short cache when every upstream fails', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  const res = response();
  await playerEdge({ query: { playerId: '8478402', season: '20252026', gameType: '3' } }, res);

  assert.equal(res.code, 200);
  assert.equal(res.body.availability, 'unavailable');
  assert.equal(res.body.player, null);
  assert.equal(res.body.sections.details.available, false);
  assert.deepEqual(res.body.source.successfulSections, []);
  assert.match(res.headers['Cache-Control'], /s-maxage=30/);
});

test('normalizer preserves an upstream rank when Edge supplies one', () => {
  const body = normalizeEdgeResponse('1', '20252026', '2', {
    details: { ok: true, data: { topShotSpeed: { imperial: 100, percentile: 99, rank: 2 } } },
  }, '2026-09-15T00:00:00.000Z');
  assert.equal(body.headline.topShotSpeed.rank, 2);
  assert.equal(body.headline.topShotSpeed.percentile, 99);
  assert.equal(body.source.fetchedAt, '2026-09-15T00:00:00.000Z');
});

test('comparison and zone feeds can backfill headlines without inventing zeroes', () => {
  const body = normalizeEdgeResponse('1', '20252026', '2', {
    comparison: { ok: true, data: {
      shotSpeedDetails: { topShotSpeed: { imperial: 91.4, percentile: 0.8 } },
      skatingSpeedDetails: { maxSkatingSpeed: { imperial: 22.7 } },
    } },
    zoneTime: { ok: true, data: { zoneTimeDetails: [{ strengthCode: 'all', offensiveZonePctg: 0.45 }] } },
  });
  assert.equal(body.headline.topShotSpeed.value, 91.4);
  assert.equal(body.headline.maxSkatingSpeed.value, 22.7);
  assert.equal(body.headline.offensiveZoneShare.value, 45);
  assert.equal(body.headline.offensiveZoneShare.rank, null);
  assert.equal(body.headline.totalDistanceSkated, null);
});
