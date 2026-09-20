// 1080x1350 portrait cards for the daily Instagram carousel.
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '../../src/page-meta.js';
import { TEAM_COLORS } from '../../src/teams.js';
import { BRAND_MARK, teamLogos } from './assets.js';
import { C, FONTS, PORTRAIT, h, row, col, label, display, body, rule, divider, chip, fitDisplay } from './theme.js';
import { slate, recentMoves, goalieDuels, watchSignals, todayET } from './card-data.js';

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
    { width: PORTRAIT.width, height: PORTRAIT.height, backgroundColor: C.bg },
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
        h('img', { src: BRAND_MARK, width: 72, height: 54 }),
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
  logos[abbr]
    ? h('img', { src: logos[abbr], width: size, height: size })
    : chip(abbr, TEAM_COLORS[abbr] || C.accent);

async function slateCard(date) {
  const games = await slate(date);
  const logos = await teamLogos(games.flatMap(game => [game.away, game.home]));
  const shown = games.slice(0, 8);
  return frame({
    eyebrow: 'Tonight',
    title: `${games.length || 'No'} game${games.length === 1 ? '' : 's'}`,
    subtitle: games.length ? 'Puck drop times, Eastern' : null,
    date,
    children: shown.length
      ? shown.map((game, index) =>
          listRow(
            [
              row(
                { alignItems: 'center', gap: 18 },
                teamMark(game.away, logos, 54),
                display(`${game.away} @ ${game.home}`, { fontSize: 42, letterSpacing: -1 }),
                teamMark(game.home, logos, 54)
              ),
              label(game.time, { fontSize: 26, color: C.muted, fontWeight: 700 }),
            ],
            { last: index === shown.length - 1 && games.length <= 8 }
          )
        ).concat(games.length > 8 ? [label(`+ ${games.length - 8} more`, { fontSize: 22, paddingTop: 20 })] : [])
      : emptyState('No games on the schedule today.'),
  });
}

async function movesCard(date) {
  const moves = recentMoves({ hours: 24, limit: 6 });
  const logos = await teamLogos(moves.map(move => move.abbr));
  return frame({
    eyebrow: 'Last 24 hours',
    title: 'Line moves',
    subtitle: moves.length ? 'Who went up, who went down' : null,
    date,
    accent: C.accent,
    children: moves.length
      ? moves.map((move, index) =>
          listRow(
            [
              row(
                { alignItems: 'center', gap: 18, maxWidth: 700 },
                teamMark(move.abbr, logos, 52),
                col(
                  { gap: 6 },
                  display(move.player, { fontSize: fitDisplay(move.player, { max: 40, min: 28, perChar: 0.6 }), letterSpacing: -0.5 }),
                  body(move.note, { fontSize: 24, fontFamily: FONTS.label })
                )
              ),
              label(move.direction === 'up' ? 'Up' : move.direction === 'down' ? 'Down' : 'Move', {
                fontSize: 22,
                fontWeight: 700,
                color: move.direction === 'up' ? C.up : move.direction === 'down' ? C.down : C.muted,
              }),
            ],
            { last: index === moves.length - 1 }
          )
        )
      : emptyState('No lineup changes in the last 24 hours.'),
  });
}

async function goaliesCard(date) {
  const { projected, duels } = await goalieDuels({ limit: 6, date });
  const logos = await teamLogos(duels.flatMap(duel => [duel.away.abbr, duel.home.abbr]));
  const side = (entry, align) =>
    col(
      { gap: 8, alignItems: align === 'right' ? 'flex-end' : 'flex-start', maxWidth: 330 },
      row({ alignItems: 'center', gap: 12 }, teamMark(entry.abbr, logos, 44)),
      display(entry.goalie || 'TBD', { fontSize: fitDisplay(entry.goalie || 'TBD', { max: 32, min: 22, perChar: 0.5 }), letterSpacing: -0.5, textAlign: align })
    );
  return frame({
    eyebrow: projected ? 'Projected starters' : 'Starting goalies',
    title: 'In the crease',
    subtitle: projected ? 'Depth-chart G1s — not yet confirmed' : 'Confirmed and likely starters',
    date,
    accent: projected ? C.muted : C.rule,
    children: duels.length
      ? duels.map((duel, index) =>
          listRow(
            [side(duel.away, 'left'), label('vs', { fontSize: 22 }), side(duel.home, 'right')],
            { last: index === duels.length - 1 }
          )
        )
      : emptyState('No goalie matchups posted yet.'),
  });
}

async function watchCard(date) {
  const { source, subtitle, rows } = await watchSignals({ limit: 6, date });
  const logos = await teamLogos(rows.map(entry => entry.abbr));
  return frame({
    eyebrow: source === 'props' ? 'Matchup signals' : 'Team signals',
    title: 'What to watch',
    subtitle,
    date,
    accent: C.accent,
    children: rows.length
      ? rows.map((entry, index) =>
          listRow(
            [
              row(
                { alignItems: 'center', gap: 18, maxWidth: 740 },
                teamMark(entry.abbr, logos, 52),
                col(
                  { gap: 6 },
                  display(entry.primary, { fontSize: fitDisplay(entry.primary, { max: 38, min: 26, perChar: 0.6 }), letterSpacing: -0.5 }),
                  body(entry.secondary, { fontSize: 22, fontFamily: FONTS.label })
                )
              ),
              entry.value ? label(entry.value, { fontSize: 26, color: C.accent, fontWeight: 700 }) : null,
            ],
            { last: index === rows.length - 1 }
          )
        )
      : emptyState('No matchup signals available today.'),
  });
}

/** Cards that carry no content are skipped by the Instagram job. */
export const IG_CARDS = ['slate', 'moves', 'goalies', 'watch'];

/**
 * Builds a 1080x1350 card element tree.
 * @param {URLSearchParams} params
 */
export async function igCard(params) {
  const card = params.get('card') || 'slate';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : todayET();
  if (card === 'moves') return movesCard(date);
  if (card === 'goalies') return goaliesCard(date);
  if (card === 'watch') return watchCard(date);
  return slateCard(date);
}
