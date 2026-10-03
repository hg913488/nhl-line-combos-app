import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeLine, momentumLine } from '../src/summary-lines.js';

const momentum = {
  labels: [{ type: 'point-streak', label: '4-game point streak' }],
  summaries: { last5: { perGame: { points: 1.2 }, versusSeason: { pointsPerGame: 0.4 } } },
};

test('momentum line leads with pace, then the headline label, then role', () => {
  assert.equal(momentumLine({ momentum, role: { slot: 'Line 1', pp: 'PP1' } }), '1.2 P/GP (+0.4) · 4-game point streak · Line 1 · PP1');
});

test('momentum line copes with missing pieces', () => {
  assert.equal(momentumLine({ momentum: { summaries: { last5: { perGame: { points: 0.6 }, versusSeason: { pointsPerGame: -0.2 } } } } }), '0.6 P/GP (-0.2)');
  assert.equal(momentumLine({ momentum: { summaries: { last5: { perGame: { points: 0 } } } } }), '0 P/GP');
  assert.equal(momentumLine({}), 'Last 5 vs season');
});

test('edge line shows the first two metrics that have values', () => {
  const metrics = [
    ['Top shot', { value: 91.2, unit: 'mph' }],
    ['Top speed', undefined],
    ['32+ km/h bursts', { value: 14, unit: 'bursts' }],
    ['O-zone time', { value: 44, unit: 'percent' }],
    ['Extra', { value: 1, unit: 'x' }],
  ];
  assert.equal(edgeLine(metrics), 'Top shot 91.2 mph · 32+ km/h bursts 14');
  assert.equal(edgeLine([]), 'Player tracking');
});
