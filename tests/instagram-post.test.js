import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaption, cardUrl } from '../scripts/instagram-post.mjs';

const GAMES = [
  { away: 'DAL', home: 'STL', gameType: 2 },
  { away: 'MTL', home: 'TOR', gameType: 2 },
];

test('card URLs point at the public JPEG endpoint for the given date', () => {
  const url = cardUrl('slate', '2026-10-08', 'https://example.test');
  assert.equal(url, 'https://example.test/api/og?type=ig&card=slate&format=jpg&date=2026-10-08');
});

test('caption names the day, the matchups, and tags each team once', () => {
  const caption = buildCaption(GAMES, '2026-10-08');
  assert.match(caption, /Thursday, October 8/);
  assert.match(caption, /2 games on the slate/);
  assert.match(caption, /DAL @ STL · MTL @ TOR/);
  assert.match(caption, /#NHL/);
  for (const abbr of ['DAL', 'STL', 'MTL', 'TOR']) {
    assert.equal(caption.split(`#${abbr}`).length - 1, 1, `#${abbr} appears once`);
  }
});

test('caption stays within Instagram limits and avoids betting language', () => {
  const caption = buildCaption(Array.from({ length: 16 }, (_, i) => ({ away: `A${i}`, home: `H${i}`, gameType: 2 })), '2026-10-08');
  assert.ok(caption.length < 2200, `caption length ${caption.length}`);
  assert.doesNotMatch(caption, /\b(bet|odds|parlay|pick'?em|wager)\b/i);
});

test('a single game reads in the singular', () => {
  assert.match(buildCaption([GAMES[0]], '2026-10-08'), /1 game on the slate/);
});
