// 1080x1350 portrait cards for the daily Instagram carousel.
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '../../src/page-meta.js';
import { TEAM_COLORS } from '../../src/teams.js';
import { brandMark, logoImg, teamLogos, playerHeadshots } from './assets.js';
import { C, FONTS, PORTRAIT, h, row, col, label, display, body, rule, divider, chip, fitDisplay, applyTheme, slideMarker } from './theme.js';
import { slate, recentMoves, goalieDuels, watchSignals, todayET, recapGame } from './card-data.js';
import { seasonForDate } from '../../src/data-client.js';
import { recapCard, RECAP_ORDER } from './recap-cards.js';

const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, '');

const DAY_LABEL = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const dayLabel = (date = todayET()) => DAY_LABEL.format(new Date(`${date}T12:00:00Z`));

const frame = ({ eyebrow, title, subtitle, children, accent = C.rule, date }) =>
  col(
    { width: PORTRAIT.width, height: PORTRAIT.height, backgroundColor: C.bg, backgroundImage: C.pageGradient },
    rule(accent, 12),
    row(
      {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 56,
        paddingRight: 56,
        paddingTop: 34,
        paddingBottom: 34,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: C.border,
      },
      row(
        { alignItems: 'center', gap: 18 },
        h('img', { src: brandMark(C.logoVariant), width: 72, height: 54 }),
        display(SITE_NAME, { fontSize: 30, letterSpacing: -0.5, maxWidth: 320, lineHeight: 1.05 })
      ),
      label(dayLabel(date), { fontSize: 22, color: C.muted })
    ),
    col(
      { paddingLeft: 56, paddingRight: 56, paddingTop: 44, paddingBottom: 18, gap: 14 },
      label(eyebrow, { color: C.accent, fontSize: 22 }),
      display(title, { fontSize: fitDisplay(title, { max: 92, min: 56, perChar: 4 }) }),
      subtitle ? body(subtitle, { fontSize: 26, maxWidth: 900 }) : null
    ),
    col({ flexGrow: 1, paddingLeft: 56, paddingRight: 56, paddingTop: 18 }, children),
    row(
      {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 56,
        paddingRight: 56,
        paddingTop: 30,
        paddingBottom: 34,
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: C.border,
      },
      label(SITE_TAGLINE, { fontSize: 20, letterSpacing: 1 }),
      label(SITE_LABEL, { fontSize: 20, color: C.accent, letterSpacing: 1 })
    )
  );

const listRow = (children, { last = false } = {}) =>
  col(
    { gap: 0 },
    row({ alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, paddingBottom: 22, gap: 20 }, children),
    last ? null : divider()
  );

const emptyState = message =>
  col(
    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    label('Nothing to report', { fontSize: 24, color: C.muted }),
    body(message, { fontSize: 30, color: C.text, maxWidth: 760, textAlign: 'center' })
  );

const teamMark = (abbr, logos, size = 56) =>
  logoImg(logos[abbr], size) || chip(abbr, TEAM_COLORS[abbr] || C.accent);

async function slateCard(date, position = {}) {
  const games = await slate(date);
  const logos = await teamLogos(games.flatMap(game => [game.away, game.home]), C.logoVariant);
  const shown = games.slice(0, 8);
  if (!shown.length) {
    return shell({ date, ...position, children: col({ flexGrow: 1, paddingLeft: 56, paddingRight: 56, justifyContent: 'center', gap: 16 },
      label('Tonight', { color: C.accent, fontSize: 22 }),
      display('No games', { fontSize: 92 }),
      emptyState('No games on the schedule today.')) });
  }

  return shell({
    date,
    index: position.index,
    total: position.total,
    children: col(
      { flexGrow: 1 },
      col(
        { paddingLeft: 56, paddingRight: 56, paddingTop: 18, paddingBottom: 22, gap: 8 },
        label('Tonight', { color: C.accent, fontSize: 22 }),
        row({ alignItems: 'baseline', gap: 18 },
          display(String(games.length), { fontSize: 104, letterSpacing: -3, lineHeight: 0.9 }),
          display(games.length === 1 ? 'GAME' : 'GAMES', { fontSize: 62, letterSpacing: -1, color: C.muted })),
        body('Puck drop times, Eastern', { fontSize: 24, color: C.muted })
      ),
      // Rows share the remaining height so the card never ends in dead space.
      col({ flexGrow: 1 }, ...shown.map((game, index) => {
        const awayColor = wash(TEAM_COLORS[game.away] || C.border);
        const homeColor = wash(TEAM_COLORS[game.home] || C.border);
        return row(
          {
            alignItems: 'center',
            flexGrow: 1,
            paddingLeft: 56,
            paddingRight: 56,
            gap: 20,
            borderTopWidth: index === 0 ? 1 : 0,
            borderBottomWidth: 1,
            borderTopStyle: 'solid',
            borderBottomStyle: 'solid',
            borderTopColor: C.border,
            borderBottomColor: C.border,
            backgroundImage: `linear-gradient(90deg, ${awayColor}1F 0%, ${C.bg}00 28%, ${C.bg}00 72%, ${homeColor}1F 100%)`,
          },
          logoImg(logos[game.away], 56, { flexShrink: 0 }),
          display(game.away, { fontSize: 46, letterSpacing: -1 }),
          display('@', { fontSize: 30, color: C.muted }),
          display(game.home, { fontSize: 46, letterSpacing: -1 }),
          logoImg(logos[game.home], 56, { flexShrink: 0 }),
          col({ flexGrow: 1 }),
          label(game.time.replace(' ET', ''), { fontSize: 26, color: C.text, fontWeight: 700, letterSpacing: 1 })
        );
      }), games.length > 8 ? row({ paddingLeft: 56, paddingTop: 16 }, label(`+ ${games.length - 8} more`, { fontSize: 22 })) : null)
    ),
  });
}

// Satori has no color-mix; lift dark brand colours so a navy still reads as a wash.
const lift = (hex, amount = 0.45) => {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return hex;
  // Positive lifts toward white (dark cards), negative deepens toward black
  // (light cards), so a pale team colour still reads against the ground.
  // Returns hex, not rgb(): several gradients append an alpha suffix
  // (`${wash(colour)}1F`), which only parses on a hex colour.
  const mix = channel => {
    const base = parseInt(channel, 16);
    const next = Math.round(amount >= 0 ? base + (255 - base) * amount : base * (1 + amount));
    return Math.max(0, Math.min(255, next)).toString(16).padStart(2, '0');
  };
  return `#${mix(value.slice(0, 2))}${mix(value.slice(2, 4))}${mix(value.slice(4, 6))}`;
};

const wash = (hex, extra = 0) => lift(hex, C.washAmount + extra);

const surnameOf = name => String(name || '').trim().split(/\s+/).slice(-1)[0] || '';
const firstNameOf = name => String(name || '').trim().split(/\s+/).slice(0, -1).join(' ');

// Header and footer are shared with the other cards; the body is bespoke so the
// hero move reads like a sports graphic rather than another list.
const shell = ({ children, accent = C.rule, date, index, total }) =>
  col(
    { width: PORTRAIT.width, height: PORTRAIT.height, backgroundColor: C.bg, backgroundImage: C.pageGradient },
    rule(accent, 12),
    row(
      { alignItems: 'center', justifyContent: 'space-between', paddingLeft: 56, paddingRight: 56, paddingTop: 30, paddingBottom: 30 },
      row(
        { alignItems: 'center', gap: 18 },
        h('img', { src: brandMark(C.logoVariant), width: 64, height: 48 }),
        display(SITE_NAME, { fontSize: 26, letterSpacing: -0.5, maxWidth: 300, lineHeight: 1.05 })
      ),
      label(dayLabel(date), { fontSize: 20, color: C.muted })
    ),
    children,
    slideMarker(index, total),
    row(
      { alignItems: 'center', justifyContent: 'space-between', paddingLeft: 56, paddingRight: 56, paddingTop: 14, paddingBottom: 30 },
      label(SITE_TAGLINE, { fontSize: 20, letterSpacing: 1 }),
      label(SITE_LABEL, { fontSize: 20, color: C.accent, letterSpacing: 1 })
    )
  );

const moveHeadline = move => {
  const match = /^Line (\d) to (\d)$/.exec(move.note) || /^Pair (\d) to (\d)$/.exec(move.note) || /^PP(\d) to PP(\d)$/.exec(move.note);
  if (match) return { from: match[1], to: match[2], unit: move.note.startsWith('PP') ? 'PP' : move.note.startsWith('Pair') ? 'PAIR' : 'LINE' };
  return null;
};

async function movesCard(date, position = {}) {
  const moves = recentMoves({ hours: 24, limit: 5 });
  if (!moves.length) {
    return shell({ date, ...position, accent: C.accent, children: col({ flexGrow: 1, paddingLeft: 56, paddingRight: 56, justifyContent: 'center', gap: 20 },
      label('Last 24 hours', { color: C.accent, fontSize: 22 }),
      display('Line moves', { fontSize: 92 }),
      emptyState('No lineup changes in the last 24 hours.')) });
  }

  const [hero, ...rest] = moves;
  const season = seasonForDate(new Date(`${date}T12:00:00Z`));
  const [logos, shots] = await Promise.all([
    teamLogos(moves.map(move => move.abbr), C.logoVariant),
    playerHeadshots(moves.map(move => ({ name: move.player, abbr: move.abbr })), season),
  ]);
  const teamColor = TEAM_COLORS[hero.abbr] || C.accent;
  const heroWash = wash(teamColor);
  const headline = moveHeadline(hero);
  const heroShot = shots[hero.player];

  return shell({
    date,
    index: position.index,
    total: position.total,
    accent: teamColor,
    children: col(
      { flexGrow: 1 },
      // Hero: colour wash, watermark crest, cut-out headshot, oversized name.
      col(
        {
          position: 'relative',
          height: 596,
          overflow: 'hidden',
          backgroundImage: `radial-gradient(circle at 76% 46%, ${heroWash} 0%, ${C.bg}00 60%)`,
        },
        logos[hero.abbr]
          ? logoImg(logos[hero.abbr], 560, { position: 'absolute', right: -110, top: 30, opacity: 0.14 })
          : null,
        heroShot
          ? h('img', { src: heroShot, width: 470, height: 470, style: { position: 'absolute', right: 16, bottom: 0, objectFit: 'contain' } })
          : null,
        col(
          { position: 'absolute', left: 56, top: 36, right: 486, gap: 8 },
          label(hero.direction === 'up' ? 'Moving up' : hero.direction === 'down' ? 'Moving down' : 'Lineup change', {
            fontSize: 22,
            color: hero.direction === 'down' ? C.down : hero.direction === 'up' ? C.up : C.muted,
          }),
          body(firstNameOf(hero.player), { fontSize: 30, fontFamily: FONTS.label, color: C.muted, letterSpacing: 1 }),
          display(surnameOf(hero.player), { fontSize: fitDisplay(surnameOf(hero.player), { max: 96, min: 52, perChar: 7.6 }), letterSpacing: -2, lineHeight: 0.95, color: C.logoVariant === 'light' ? wash(teamColor, -0.5) : C.text }),
          headline
            ? row(
                { alignItems: 'baseline', gap: 16, marginTop: 14 },
                display(`${headline.unit} ${headline.from}`, { fontSize: 46, color: C.muted }),
                display('→', { fontSize: 46, color: teamColor }),
                display(`${headline.unit} ${headline.to}`, { fontSize: 58, color: C.text })
              )
            : body(hero.note, { fontSize: 34, marginTop: 12 }),
          body(`${hero.abbr} · last 24 hours`, { fontSize: 24, fontFamily: FONTS.label, color: C.muted, marginTop: 8 })
        )
      ),
      // Everything else, compact.
      col(
        { flexGrow: 1, paddingLeft: 56, paddingRight: 56, paddingTop: 26, gap: 0 },
        label(`${rest.length} more ${rest.length === 1 ? 'change' : 'changes'}`, { fontSize: 20, color: C.muted, marginBottom: 6 }),
        ...rest.map((move, index) =>
          row(
            {
              alignItems: 'center',
              gap: 20,
              paddingTop: 18,
              paddingBottom: 18,
              borderBottomWidth: index === rest.length - 1 ? 0 : 1,
              borderBottomStyle: 'solid',
              borderBottomColor: C.border,
            },
            shots[move.player]
              ? h('div', {
                  style: {
                    display: 'flex', width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
                    backgroundColor: wash(TEAM_COLORS[move.abbr] || C.surface, 0.25), alignItems: 'flex-end', justifyContent: 'center',
                  },
                }, h('img', { src: shots[move.player], width: 78, height: 78, style: { objectFit: 'contain' } }))
              : logos[move.abbr]
                ? logoImg(logos[move.abbr], 64)
                : null,
            col(
              { gap: 4, flexGrow: 1 },
              display(surnameOf(move.player).toUpperCase(), { fontSize: 38, letterSpacing: -0.5, lineHeight: 1 }),
              body(`${move.abbr} · ${move.note}`, { fontSize: 22, fontFamily: FONTS.label, color: C.muted })
            ),
            label(move.direction === 'up' ? 'Up' : move.direction === 'down' ? 'Down' : '—', {
              fontSize: 22,
              fontWeight: 700,
              color: move.direction === 'up' ? C.up : move.direction === 'down' ? C.down : C.muted,
            })
          )
        )
      )
    ),
  });
}

async function goaliesCard(date, position = {}) {
  const { projected, duels: allDuels } = await goalieDuels({ limit: 4, date });
  const duels = allDuels.slice(0, 4);
  const season = seasonForDate(new Date(`${date}T12:00:00Z`));
  const [logos, shots] = await Promise.all([
    teamLogos(duels.flatMap(duel => [duel.away.abbr, duel.home.abbr]), C.logoVariant),
    playerHeadshots(
      duels.flatMap(duel => [
        { name: duel.away.goalie, abbr: duel.away.abbr },
        { name: duel.home.goalie, abbr: duel.home.abbr },
      ]).filter(entry => entry.name),
      season
    ),
  ]);

  const face = (entry, align) => {
    const shot = shots[entry.goalie];
    const color = TEAM_COLORS[entry.abbr] || C.surface;
    return row(
      { alignItems: 'center', gap: 16, flexGrow: 1, minWidth: 0, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' },
      align === 'right' ? col(
        { gap: 4, alignItems: 'flex-end', maxWidth: 250 },
        display(surnameOf(entry.goalie || 'TBD').toUpperCase(), { fontSize: fitDisplay(surnameOf(entry.goalie || 'TBD'), { max: 34, min: 19, perChar: 2.2 }), letterSpacing: -0.5, lineHeight: 1 }),
        label(entry.abbr, { fontSize: 20, color: wash(color, 0.05) })
      ) : null,
      shot
        ? h('div', { style: { display: 'flex', flexShrink: 0, width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: wash(color, 0.2), alignItems: 'flex-end', justifyContent: 'center' } },
            h('img', { src: shot, width: 104, height: 104, style: { objectFit: 'contain' } }))
        : logoImg(logos[entry.abbr], 84, { flexShrink: 0 }),
      align === 'left' ? col(
        { gap: 4, maxWidth: 250 },
        display(surnameOf(entry.goalie || 'TBD').toUpperCase(), { fontSize: fitDisplay(surnameOf(entry.goalie || 'TBD'), { max: 34, min: 19, perChar: 2.2 }), letterSpacing: -0.5, lineHeight: 1 }),
        label(entry.abbr, { fontSize: 20, color: wash(color, 0.05) })
      ) : null
    );
  };

  return shell({
    date,
    index: position.index,
    total: position.total,
    accent: C.rule,
    children: col(
      { flexGrow: 1 },
      col(
        { paddingLeft: 56, paddingRight: 56, paddingTop: 18, paddingBottom: 24, gap: 8 },
        label(projected ? 'Projected starters' : 'Starting goalies', { color: projected ? C.muted : C.accent, fontSize: 22 }),
        display('In the crease', { fontSize: 86, letterSpacing: -2 }),
        body(projected ? 'Depth-chart G1s — not confirmed yet' : 'Confirmed and likely starters', { fontSize: 24, color: C.muted })
      ),
      duels.length
        ? col({ flexGrow: 1 }, ...duels.map(duel =>
            col(
              {
                flexGrow: 1,
                justifyContent: 'center',
                paddingLeft: 56,
                paddingRight: 56,
                borderTopWidth: 1,
                borderTopStyle: 'solid',
                borderTopColor: C.border,
                backgroundImage: `linear-gradient(90deg, ${wash(TEAM_COLORS[duel.away.abbr] || C.surface, -0.1)}22 0%, ${C.bg}00 35%, ${C.bg}00 65%, ${wash(TEAM_COLORS[duel.home.abbr] || C.surface, -0.1)}22 100%)`,
              },
              row(
                { alignItems: 'center', gap: 30 },
                face(duel.away, 'left'),
                col({ alignItems: 'center', gap: 2, width: 96, flexShrink: 0 },
                  label('vs', { fontSize: 22, color: C.muted }),
                  duel.time ? label(duel.time.replace(' ET', ''), { fontSize: 18, color: C.border, letterSpacing: 1 }) : null),
                face(duel.home, 'right')
              )
            )
          ))
        : col({ flexGrow: 1, justifyContent: 'center', paddingLeft: 56, paddingRight: 56 }, emptyState('No goalie matchups posted yet.')),
    ),
  });
}

async function watchCard(date, position = {}) {
  const { source, subtitle, rows } = await watchSignals({ limit: 6, date });
  const logos = await teamLogos(rows.map(entry => entry.abbr), C.logoVariant);
  const peak = Math.max(...rows.map(entry => Number(entry.value) || 0), 1);

  return shell({
    date,
    index: position.index,
    total: position.total,
    accent: C.accent,
    children: col(
      { flexGrow: 1 },
      col(
        { paddingLeft: 56, paddingRight: 56, paddingTop: 18, paddingBottom: 26, gap: 8 },
        label(source === 'props' ? 'Matchup signals' : 'Team signals', { color: C.accent, fontSize: 22 }),
        display('What to watch', { fontSize: 86, letterSpacing: -2, lineHeight: 0.98 }),
        body(subtitle, { fontSize: 24, color: C.muted, maxWidth: 860 })
      ),
      rows.length
        ? col({ flexGrow: 1, paddingLeft: 56, paddingRight: 56, gap: 0 }, ...rows.map((entry, index) => {
            const value = Number(entry.value) || 0;
            const width = Math.max(8, Math.round((value / peak) * 100));
            const color = wash(TEAM_COLORS[entry.abbr] || C.accent);
            return col(
              {
                flexGrow: 1,
                justifyContent: 'center',
                gap: 12,
                paddingTop: 16,
                paddingBottom: 16,
                borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                borderBottomStyle: 'solid',
                borderBottomColor: C.border,
              },
              row(
                { alignItems: 'center', gap: 16 },
                logoImg(logos[entry.abbr], 52),
                col({ gap: 2, flexGrow: 1 },
                  display(entry.primary.toUpperCase(), { fontSize: fitDisplay(entry.primary, { max: 34, min: 24, perChar: 0.85 }), letterSpacing: -0.4, lineHeight: 1 }),
                  body(entry.secondary, { fontSize: 20, fontFamily: FONTS.label, color: C.muted })),
                display(String(entry.value), { fontSize: 48, color, letterSpacing: -1 })
              ),
              h('div', { style: { display: 'flex', height: 10, width: '100%', backgroundColor: C.surface, borderRadius: 5, overflow: 'hidden' } },
                h('div', { style: { display: 'flex', height: 10, width: `${width}%`, backgroundColor: color, borderRadius: 5 } }))
            );
          }))
        : col({ flexGrow: 1, justifyContent: 'center', paddingLeft: 56, paddingRight: 56 }, emptyState('No matchup signals available today.')),
    ),
  });
}

/** Cards that carry no content are skipped by the Instagram job. */
export const IG_CARDS = ['slate', 'moves', 'goalies', 'watch'];

/**
 * Builds a 1080x1350 card element tree.
 * @param {URLSearchParams} params
 */
// Running order of the daily carousel; drives the "02 of 04" marker.
export const CARD_ORDER = ['slate', 'moves', 'goalies', 'watch'];

export async function igCard(params) {
  // Ice white is the house look for Instagram: hockey is played on white, the
  // headshots carry better on it, and it stands out in a feed of dark accounts.
  applyTheme(params.get('theme') === 'dark' ? 'dark' : 'light');
  const card = params.get('card') || 'slate';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : todayET();

  const asNumber = value => (/^\d{1,2}$/.test(value || '') ? Number(value) : null);
  const total = asNumber(params.get('total')) ?? CARD_ORDER.length;
  const given = asNumber(params.get('index'));
  const fallback = CARD_ORDER.indexOf(card);
  const index = given != null ? given - 1 : fallback;
  const position = index >= 0 && index < total ? { index, total } : {};

  // Post-game recap for one game: ?type=ig&recap=<gameId>&card=final|goals|shots|metrics
  const gameId = params.get('recap');
  if (gameId) {
    const game = await recapGame(gameId);
    if (game) {
      const recapIndex = given != null ? given - 1 : Math.max(0, RECAP_ORDER.indexOf(card));
      const recapTotal = asNumber(params.get('total')) ?? RECAP_ORDER.length;
      return recapCard(game, RECAP_ORDER.includes(card) ? card : 'final', { index: recapIndex, total: recapTotal });
    }
  }

  if (card === 'moves') return movesCard(date, position);
  if (card === 'goalies') return goaliesCard(date, position);
  if (card === 'watch') return watchCard(date, position);
  return slateCard(date, position);
}
