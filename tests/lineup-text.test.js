import test from 'node:test';
import assert from 'node:assert/strict';
import { latestMove, lineupName, moveClause, moveGlyph, playerRole, titleCase } from '../src/lineup-text.js';

const team = {
  forwards: [['A ONE', 'B TWO', 'C THREE'], ['D FOUR', 'ÉMILE FIVE', 'F SIX']],
  defense: [['G SEVEN', 'H EIGHT']],
  goalies: [['I NINE'], ['J TEN']],
  pp1: ['A ONE', 'G SEVEN'],
  pp2: ['ÉMILE FIVE'],
};

test('role finds line, pair, goalie slot and PP unit, accent-insensitive', () => {
  assert.deepEqual(playerRole(team, 'A One'), { slot: 'Line 1', pp: 'PP1' });
  assert.deepEqual(playerRole(team, 'Emile Five'), { slot: 'Line 2', pp: 'PP2' });
  assert.deepEqual(playerRole(team, 'G Seven'), { slot: 'Pair 1', pp: 'PP1' });
  assert.deepEqual(playerRole(team, 'J Ten'), { slot: 'Backup', pp: null });
  assert.equal(playerRole(team, 'Nobody Here'), null);
  assert.equal(playerRole(undefined, 'A One'), null);
});

test('latest move matches team and name, newest first', () => {
  const events = [
    { team: 'toronto-maple-leafs', player: 'A ONE', changes: [{ type: 'forward_line', from: 2, to: 1 }] },
    { team: 'toronto-maple-leafs', player: 'A ONE', changes: [{ type: 'forward_line', from: 1, to: 2 }] },
    { team: 'ottawa-senators', player: 'A ONE', changes: [] },
  ];
  assert.equal(latestMove(events, 'toronto-maple-leafs', 'A One'), events[0]);
  assert.equal(latestMove(events, 'boston-bruins', 'A One'), null);
});

test('move clauses and title case read naturally', () => {
  assert.equal(moveClause({ type: 'forward_line', from: 2, to: 1 }), 'moves up to line 1');
  assert.equal(moveClause({ type: 'power_play', from: null, to: 2 }), 'slots onto PP2');
  assert.equal(titleCase("RYAN O'REILLY"), "Ryan O'Reilly");
});

test('same-name teammates keep their own slots', () => {
  const van = {
    forwards: [['JAKE DEBRUSK', 'ELIAS PETTERSSON', 'JONATHAN LEKKERIMAKI']],
    defense: [['QUINN HUGHES', 'FILIP HRONEK'], ['MARCUS X', 'ELIAS NILS PETTERSSON']],
    goalies: [], pp1: ['ELIAS PETTERSSON', 'QUINN HUGHES'], pp2: ['ELIAS NILS PETTERSSON'],
  };
  assert.deepEqual(playerRole(van, 'Elias Pettersson', 'C'), { slot: 'Line 1', pp: 'PP1' });
  assert.deepEqual(playerRole(van, 'Elias Pettersson', 'D'), { slot: 'Pair 2', pp: 'PP2' });
  assert.equal(lineupName(van, 'Elias Pettersson', 'D'), 'ELIAS NILS PETTERSSON');
  assert.equal(lineupName(van, 'Elias Pettersson'), 'ELIAS PETTERSSON');
});

test('moveGlyph pairs a symbol with the destination', () => {
  assert.deepEqual(moveGlyph({ type: 'forward_line', from: 2, to: 1 }), { mark: '↑', kind: 'up', text: 'line 1' });
  assert.deepEqual(moveGlyph({ type: 'forward_line', from: 1, to: 3 }), { mark: '↓', kind: 'down', text: 'line 3' });
  assert.deepEqual(moveGlyph({ type: 'removal' }), { mark: '✕', kind: 'out', text: 'out' });
  assert.deepEqual(moveGlyph({ type: 'power_play', from: 1, to: null }), { mark: '✕', kind: 'out', text: 'off PP1' });
});
