// Midday "players to watch" carousel: one list slide, then a closer look at the top three.
import { logoImg, teamLogos, playerHeadshots } from './assets.js';
import { C, h, row, col, label, display, body, fitDisplay } from './theme.js';
import { shell, onGround, nameOf } from './recap-cards.js';
import { POSITION_LABEL, PICKS_DEEP } from './picks-select.js';

export { PICKS_DEEP };

const GAME_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const dayLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const startLabel = player => (player.start ? `${GAME_TIME.format(new Date(player.start))} ET` : '');
const accentOf = player => onGround(player.team);
const surnameOf = name => String(name || '').trim().split(/\s+/).slice(1).join(' ') || String(name || '');
const firstNameOf = name => String(name || '').trim().split(/\s+/)[0] || '';

// The display face has no arrow glyph, so a move reads as a label plus a destination:
// "UP FROM L3" / "L1", or "NEW ON" / "PP1" for a slot gained from nothing.
const MOVE_PREFIX = { forward_line: 'L', defense_pair: 'D', power_play: 'PP' };
const moveTile = move => ({
  name: move.from == null ? 'Newly on' : `Up from ${MOVE_PREFIX[move.type]}${move.from}`,
  value: `${MOVE_PREFIX[move.type]}${move.to}`,
});

const loadAssets = async (players, season) => {
  const abbrs = [...new Set(players.flatMap(player => [player.team, player.opp]))];
  const [logos, shots] = await Promise.all([
    teamLogos(abbrs, C.logoVariant),
    playerHeadshots(players.map(player => ({ name: player.display, abbr: player.team })), season),
  ]);
  return { logos, shots };
};

// A tinted tile with the player's cut-out headshot, or the crest when there is none.
const portrait = (player, assets, size) => {
  const tint = `${accentOf(player)}26`;
  const shot = assets.shots[player.display];
  return h('div', {
    style: { display: 'flex', width: size, height: size, borderRadius: 24, backgroundColor: tint, overflow: 'hidden', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 },
  }, shot
    ? h('img', { src: shot, width: size, height: size })
    : h('div', { style: { display: 'flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' } }, logoImg(assets.logos[player.team], Math.round(size * 0.5))));
};

// 1. Everyone at a glance.
export async function picksListCard(players, { date, season, index, total, title = 'Players to watch' }) {
  const assets = await loadAssets(players, season);
  // Row budget: rank 56 + gap 18 + portrait 116 + gap 20 + text column <= 968.
  const line = (player, i) =>
    row(
      { alignItems: 'center', gap: 18, height: 158, borderBottomWidth: i === players.length - 1 ? 0 : 1, borderBottomStyle: 'solid', borderBottomColor: C.border },
      display(String(i + 1), { fontSize: 44, width: 56, color: C.muted, letterSpacing: -1 }),
      portrait(player, assets, 116),
      col(
        { gap: 6, flexGrow: 1, width: 700 },
        row({ alignItems: 'center', gap: 14 },
          display(player.display, { fontSize: fitDisplay(player.display, { max: 34, min: 22, perChar: 0.95 }), letterSpacing: -0.5, lineHeight: 1, color: accentOf(player) }),
          logoImg(assets.logos[player.team], 30)),
        label(`${player.pos} · ${player.line}${player.pp === 1 ? ' · PP1' : ''} · ${player.home ? 'vs' : '@'} ${player.opp} · ${startLabel(player)}`, { fontSize: 18, letterSpacing: 1 }),
        body(player.clauses.slice(0, 2).join(' · '), { fontSize: 21, lineHeight: 1.25, maxWidth: 700 })
      )
    );

  return shell({
    index,
    total,
    accent: C.accent,
    eyebrow: dayLabel(date),
    children: col(
      { flexGrow: 1, paddingLeft: 56, paddingRight: 56, paddingTop: 14, paddingBottom: 10 },
      col({ gap: 8, paddingBottom: 16 },
        label('Tonight', { color: C.accent, fontSize: 22 }),
        display(title, { fontSize: 66, letterSpacing: -2, lineHeight: 0.98 })),
      col({ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.border }, ...players.map(line))
    ),
  });
}

const statTile = (name, value, colour) =>
  col(
    { flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 18, paddingBottom: 18, paddingLeft: 22, paddingRight: 22, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderStyle: 'solid', borderColor: C.border },
    label(name, { fontSize: 18, letterSpacing: 1.5 }),
    display(String(value), { fontSize: 50, letterSpacing: -1, color: colour })
  );

// 2-4. One player, with the reasons laid out.
export async function picksPlayerCard(player, { date, season, index, total, rank, eyebrow = 'Watch' }) {
  const assets = await loadAssets([player], season);
  const colour = accentOf(player);
  const surname = surnameOf(player.display);
  const gp = player.last10?.gp || 0;
  const hasBar = Number.isFinite(player.allowed) && Number.isFinite(player.league) && player.league > 0;
  const peak = hasBar ? Math.max(player.allowed, player.league) : 1;
  // Budget: 230 label + 622 track + 84 value + two 16 gaps = 968. The track needs a
  // real width: a percentage fill inside an auto-width track is circular and
  // overflowed the card.
  const TRACK = 622;
  const barRow = (name, value, fill) =>
    row({ alignItems: 'center', gap: 16 },
      label(name, { fontSize: 18, letterSpacing: 1, width: 230, flexShrink: 0 }),
      h('div', { style: { display: 'flex', width: TRACK, height: 22, borderRadius: 11, backgroundColor: C.surface, flexShrink: 0 } },
        h('div', { style: { display: 'flex', width: Math.max(14, Math.round((value / peak) * TRACK)), height: 22, borderRadius: 11, backgroundColor: fill } })),
      display(String(value), { fontSize: 32, width: 84, flexShrink: 0, justifyContent: 'flex-end', letterSpacing: -0.5, color: fill }));

  const shot = assets.shots[player.display];
  return shell({
    index,
    total,
    accent: colour,
    eyebrow: `${eyebrow} ${rank} of ${total - 1}`,
    children: col(
      { flexGrow: 1, paddingLeft: 56, paddingRight: 56, paddingTop: 10, paddingBottom: 6, gap: 22 },
      // Hero: name on the left, cut-out on the right. The name column is 520 wide,
      // so the surname is fitted to it (about 1.15em per capital in this face) rather than left to overflow the portrait.
      row(
        { height: 440, borderRadius: 28, backgroundColor: `${colour}22`, overflow: 'hidden', position: 'relative' },
        col(
          { width: 560, paddingLeft: 36, paddingTop: 36, paddingBottom: 36, justifyContent: 'space-between' },
          col({ gap: 10 },
            label(`${player.pos} · ${player.line}${player.pp === 1 ? ' · PP1' : ''}`, { fontSize: 20, color: colour }),
            label(firstNameOf(player.display), { fontSize: 26, color: C.text, letterSpacing: 4 }),
            display(surname, { fontSize: Math.max(30, Math.min(84, Math.floor(500 / (surname.length * 1.15)))), letterSpacing: -2, lineHeight: 0.95, color: colour, maxWidth: 520 })),
          row({ alignItems: 'center', gap: 14 },
            logoImg(assets.logos[player.team], 46),
            label(`${player.home ? 'vs' : '@'}`, { fontSize: 20 }),
            logoImg(assets.logos[player.opp], 46),
            label(startLabel(player), { fontSize: 20, color: C.text }))
        ),
        shot
          ? h('img', { src: shot, width: 440, height: 440, style: { position: 'absolute', right: 0, bottom: 0 } })
          : h('div', { style: { display: 'flex', position: 'absolute', right: 60, top: 100 } }, logoImg(assets.logos[player.team], 200))
      ),
      row({ gap: 16 },
        statTile(`Points, last ${gp}`, player.last10?.p ?? '–', colour),
        statTile(`Shots, last ${gp}`, player.last10?.sog ?? '–', colour),
        player.move
          ? statTile(moveTile(player.move).name, moveTile(player.move).value, colour)
          : statTile('Role', `${player.line}${player.pp === 1 ? ' PP1' : ''}`, colour)),
      col({ gap: 16 },
        label(player.move ? 'What changed' : 'Why it matters tonight', { color: C.accent, fontSize: 20 }),
        ...player.clauses.slice(0, 3).map(clause =>
          row({ alignItems: 'center', gap: 16 },
            h('div', { style: { display: 'flex', width: 14, height: 14, borderRadius: 7, backgroundColor: colour, flexShrink: 0 } }),
            body(clause, { fontSize: 28, color: C.text, lineHeight: 1.2, maxWidth: 880 })))),
      hasBar
        ? col({ gap: 14 },
            label(`Goals allowed to ${POSITION_LABEL[player.pos] || player.pos}, last 10`, { fontSize: 18, letterSpacing: 1 }),
            barRow(nameOf(player.opp), player.allowed, colour),
            barRow('League average', Math.round(player.league * 10) / 10, C.muted))
        : null,
      player.goalie
        ? row({ alignItems: 'center', gap: 12 },
            label('In goal', { fontSize: 18 }),
            body(`${player.goalie.name}${player.goalie.confirmed ? '' : ' (projected)'}`, { fontSize: 28, color: C.text }))
        : null
    ),
  });
}
