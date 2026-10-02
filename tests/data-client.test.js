import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPlayer, positionGroup } from '../src/data-client.js';
import { movePosition } from '../src/lineup-text.js';

const VAN = [
  { id: '8483678', firstName: 'Elias', lastName: 'Pettersson', pos: 'D', team: 'VAN', active: true },
  { id: '8480012', firstName: 'Elias', lastName: 'Pettersson', pos: 'C', team: 'VAN', active: true },
  { id: '8477969', firstName: 'Marcus', lastName: 'Pettersson', pos: 'D', team: 'NYR', active: true },
];

test('same-name teammates are told apart by position', () => {
  assert.equal(pickPlayer(VAN, 'ELIAS PETTERSSON', { team: 'VAN', pos: 'C' }).id, '8480012');
  assert.equal(pickPlayer(VAN, 'ELIAS PETTERSSON', { team: 'VAN', pos: 'RD' }).id, '8483678');
  assert.equal(pickPlayer(VAN, 'Elias Pettersson', { pos: 'F' }).id, '8480012');
});

test('a middle name falls back to first and last', () => {
  assert.equal(pickPlayer(VAN, 'ELIAS NILS PETTERSSON', { team: 'VAN', pos: 'D' }).id, '8483678');
});

test('ambiguous names without hints are not guessed', () => {
  assert.equal(pickPlayer(VAN, 'ELIAS PETTERSSON'), null);
  assert.equal(pickPlayer(VAN, 'ELIAS PETTERSSON', { team: 'VAN' }), null);
});

test('unique names resolve without hints', () => {
  assert.equal(pickPlayer(VAN, 'Marcus Pettersson').id, '8477969');
  assert.equal(pickPlayer(VAN, 'Nobody Here'), null);
});

test('inactive duplicates lose to the active player', () => {
  const players = [{ ...VAN[0], id: '1', active: false }, { ...VAN[0], id: '2', team: 'SEA' }];
  assert.equal(pickPlayer(players, 'Elias Pettersson').id, '2');
});

test('position groups cover NHL codes and lineup slots', () => {
  assert.deepEqual(['C', 'L', 'RW', 'LD', 'D', 'STR', 'G', ''].map(positionGroup), ['F', 'F', 'F', 'D', 'D', 'G', 'G', null]);
  assert.equal(movePosition({ changes: [{ type: 'defense_pair' }] }), 'D');
  assert.equal(movePosition({ changes: [{ type: 'forward_line' }, { type: 'power_play' }] }), 'F');
  assert.equal(movePosition({ changes: [{ type: 'power_play' }] }), null);
});
