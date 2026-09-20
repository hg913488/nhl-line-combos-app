// Post-game recap carousel: what happened, then the numbers behind it.
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '../../src/page-meta.js';
import { TEAM_COLORS, NHL_TEAMS } from '../../src/teams.js';
import { brandMark, logoImg, teamLogos } from './assets.js';
import { C, FONTS, PORTRAIT, h, row, col, label, display, body, rule, fitDisplay, applyTheme, slideMarker } from './theme.js';
import { rinkSvg, RINK_RATIO } from './rink.js';

const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, '');
const GAME_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });

export const RECAP_ORDER = ['final', 'goals', 'shots', 'metrics'];

const mix = (hex, amount) => {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return hex;
  const channel = part => {
    const base = parseInt(part, 16);
    const next = Math.round(amount >= 0 ? base + (255 - base) * amount : base * (1 + amount));
    return Math.max(0, Math.min(255, next)).toString(16).padStart(2, '0');
  };
  return `#${channel(value.slice(0, 2))}${channel(value.slice(2, 4))}${channel(value.slice(4, 6))}`;
};

const teamColor = abbr => TEAM_COLORS[abbr] || C.accent;
const onGround = abbr => mix(teamColor(abbr), C.washAmount);
const nameOf = abbr => {
  const entry = Object.values(NHL_TEAMS).find(team => team.abbr === abbr);
  return entry ? entry.name : abbr;
};
const surname = name => String(name || '').trim().split(/\s+/).slice(-1)[0] || '';

const shell = ({ children, accent, index, total, eyebrow }) =>
  col(
    { width: PORTRAIT.width, height: PORTRAIT.height, backgroundColor: C.bg, backgroundImage: C.pageGradient },
    rule(accent || C.rule, 12),
    row(
      { alignItems: 'center', justifyContent: 'space-between', paddingLeft: 56, paddingRight: 56, paddingTop: 30, paddingBottom: 30 },
      row(
        { alignItems: 'center', gap: 18 },
        h('img', { src: brandMark(C.logoVariant), width: 64, height: 48 }),
        display(SITE_NAME, { fontSize: 26, letterSpacing: -0.5, maxWidth: 300, lineHeight: 1.05 })
      ),
      label(eyebrow, { fontSize: 20, color: C.muted })
    ),
    children,
    slideMarker(index, total),
    row(
      { alignItems: 'center', justifyContent: 'space-between', paddingLeft: 56, paddingRight: 56, paddingTop: 14, paddingBottom: 30 },
      label(SITE_TAGLINE, { fontSize: 20, letterSpacing: 1 }),
      label(SITE_LABEL, { fontSize: 20, color: C.accent, letterSpacing: 1 })
    )
  );

const resultLine = game => {
  const winner = game.home.score > game.away.score ? game.home : game.away;
  const loser = winner === game.home ? game.away : game.home;
  const overtime = game.periodType === 'OT' || game.periodType === 'SO' ? ` in ${game.periodType === 'SO' ? 'a shootout' : 'overtime'}` : '';
  return `${nameOf(winner.abbr)} ${winner.score}–${loser.score}${overtime}`;
};

// 1. The result.
function finalCard(game, logos, position) {
  const side = (team, align) =>
    col(
      { alignItems: align, gap: 12, flexGrow: 1 },
      logoImg(logos[team.abbr], 184),
      display(team.abbr, { fontSize: 64, letterSpacing: -1, color: onGround(team.abbr) }),
      label(nameOf(team.abbr), { fontSize: 21, color: C.muted })
    );
  const winnerIsHome = game.home.score > game.away.score;
  const awayColor = onGround(game.away.abbr);
  const homeColor = onGround(game.home.abbr);

  // Goals per period, so the card shows the shape of the game, not just the total.
  const periods = (game.shotsByPeriod || []).map(entry => entry.periodType === 'OT' ? 'OT' : `P${entry.period}`);
  const goalsIn = (label_, side_) => game.goals.filter(goal =>
    (goal.periodType === 'OT' ? 'OT' : `P${goal.period}`) === label_ && goal.side === side_).length;

  // The team-abbr column hangs off the left of every row, so without a matching
  // column on the right the grid of numbers centres 48px right of the score and
  // the result line above it.
  const gutter = () => h('div', { style: { display: 'flex', width: 96 } });
  const scoreRow = (values, color) =>
    row({ alignItems: 'center' }, ...values.map(value =>
      col({ width: 96, alignItems: 'center' }, display(String(value), { fontSize: 30, color }))), gutter());

  // The ice itself as the backdrop, with this game's goals where they were
  // scored — a graphic that means something rather than decoration.
  const backdropWidth = 820;
  const ghost = colour => mix(colour, C.logoVariant === 'light' ? 0.62 : -0.45);
  const backdrop = rinkSvg({
    plain: true,
    shots: game.goals.map(goal => ({ ...goal, type: 'goal' })),
    awayColor: ghost(awayColor),
    homeColor: ghost(homeColor),
    line: C.border,
  });

  return shell({
    ...position,
    accent: winnerIsHome ? homeColor : awayColor,
    eyebrow: game.periodType && game.periodType !== 'REG' ? `Final / ${game.periodType}` : 'Final',
    children: col(
      { flexGrow: 1, position: 'relative', paddingLeft: 56, paddingRight: 56, paddingTop: 20, paddingBottom: 16, justifyContent: 'space-around' },
      // Centred and sat in the open band under the score. Running it wider than
      // the card sliced the boards off mid-line, and sitting it higher drew the
      // top edge straight through the numerals as a stray rule.
      h('img', {
        src: backdrop,
        width: backdropWidth,
        height: Math.round(backdropWidth / RINK_RATIO),
        style: {
          position: 'absolute',
          left: Math.round((PORTRAIT.width - backdropWidth) / 2),
          top: 420,
          opacity: 0.35,
        },
      }),
      row(
        { alignItems: 'center', gap: 16 },
        side(game.away, 'flex-start'),
        row(
          { alignItems: 'center', gap: 26, justifyContent: 'center', width: 340 },
          display(String(game.away.score), { fontSize: 158, letterSpacing: -6, color: winnerIsHome ? C.muted : awayColor }),
          // Drawn, not typed: the display face's dash sits badly against 158px numerals.
          h('div', { style: { display: 'flex', width: 4, height: 112, marginTop: 16, borderRadius: 2, backgroundColor: C.border } }),
          display(String(game.home.score), { fontSize: 158, letterSpacing: -6, color: winnerIsHome ? homeColor : C.muted })
        ),
        side(game.home, 'flex-end')
      ),
      col(
        { alignItems: 'center', gap: 8 },
        display(resultLine(game), { fontSize: fitDisplay(resultLine(game), { max: 50, min: 30, perChar: 1.1 }), letterSpacing: -1, textAlign: 'center' }),
        label([game.venue, GAME_TIME.format(new Date(game.startTimeUTC))].filter(Boolean).join(' · '), { fontSize: 21 })
      ),
      periods.length
        ? col(
            { alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.border },
            row({ alignItems: 'center', paddingTop: 14 },
              gutter(),
              ...periods.map(name => col({ width: 96, alignItems: 'center' }, label(name, { fontSize: 19, color: C.muted }))),
              gutter()),
            row({ alignItems: 'center' },
              col({ width: 96, alignItems: 'center' }, label(game.away.abbr, { fontSize: 20, color: awayColor })),
              scoreRow(periods.map(name => goalsIn(name, 'away')), awayColor)),
            row({ alignItems: 'center' },
              col({ width: 96, alignItems: 'center' }, label(game.home.abbr, { fontSize: 20, color: homeColor })),
              scoreRow(periods.map(name => goalsIn(name, 'home')), homeColor)),
            row({ alignItems: 'center', gap: 10, paddingTop: 10 },
              label(`Shots ${game.away.sog ?? 0} – ${game.home.sog ?? 0}`, { fontSize: 20, color: C.muted }))
          )
        : null
    ),
  });
}

// 2. How it happened.
function goalsCard(game, logos, position) {
  const goals = game.goals.slice(0, 7);
  return shell({
    ...position,
    eyebrow: `${game.away.abbr} at ${game.home.abbr}`,
    children: col(
      { flexGrow: 1 },
      col(
        { paddingLeft: 56, paddingRight: 56, paddingTop: 10, paddingBottom: 20, gap: 8 },
        label('How it happened', { color: C.accent, fontSize: 22 }),
        display(`${game.goals.length} goals`, { fontSize: 82, letterSpacing: -2 }),
        game.goals.length > goals.length
          ? body(`First ${goals.length} · ${game.goals.length - goals.length} more in the game`, { fontSize: 22, color: C.muted })
          : null
      ),
      col({ flexGrow: 1 }, ...goals.map((goal, index) =>
        row(
          {
            alignItems: 'center',
            gap: 20,
            flexGrow: 1,
            paddingLeft: 56,
            paddingRight: 56,
            borderTopWidth: index === 0 ? 1 : 0,
            borderBottomWidth: 1,
            borderTopStyle: 'solid',
            borderBottomStyle: 'solid',
            borderTopColor: C.border,
            borderBottomColor: C.border,
            backgroundImage: `linear-gradient(90deg, ${onGround(goal.team)}14 0%, ${C.bg}00 42%)`,
          },
          col({ width: 96, gap: 2 },
            label(goal.periodType === 'OT' ? 'OT' : `P${goal.period}`, { fontSize: 18, color: C.muted }),
            label(goal.time, { fontSize: 20, color: C.display, letterSpacing: 0 })),
          logoImg(logos[goal.team], 52, { flexShrink: 0 }),
          col({ gap: 3, flexGrow: 1, minWidth: 0 },
            display(goal.scorer, { fontSize: fitDisplay(goal.scorer, { max: 36, min: 24, perChar: 0.9 }), letterSpacing: -0.5, lineHeight: 1 }),
            goal.assists?.length
              ? body(goal.assists.map(surname).join(', '), { fontSize: 20, fontFamily: FONTS.label, color: C.muted })
              : body('unassisted', { fontSize: 20, fontFamily: FONTS.label, color: C.muted })),
          col({ alignItems: 'flex-end', gap: 3 },
            display(`${goal.awayScore}–${goal.homeScore}`, { fontSize: 30, color: onGround(goal.team) }),
            goal.strength && goal.strength !== 'EV' ? label(goal.strength, { fontSize: 17, color: C.muted }) : null)
        )
      ))
    ),
  });
}

// 3. Every attempt, placed on the ice.
function shotsCard(game, logos, position) {
  const ice = C.logoVariant === 'light' ? '#FFFFFF' : '#1B2028';
  const svg = rinkSvg({
    shots: game.shots,
    awayColor: onGround(game.away.abbr),
    homeColor: onGround(game.home.abbr),
    ice,
    line: C.border,
    red: C.logoVariant === 'light' ? '#D8556040' : '#D0757540',
    blue: C.logoVariant === 'light' ? '#6E93C840' : '#5C7FB040',
  });
  const width = PORTRAIT.width - 112;
  const awayColor = onGround(game.away.abbr);
  const homeColor = onGround(game.home.abbr);
  const periods = game.shotsByPeriod || [];
  const peak = Math.max(...periods.flatMap(entry => [entry.away, entry.home]), 1);

  const legend = (abbr, color, align) =>
    row({ alignItems: 'center', gap: 10, width: 300, justifyContent: align },
      h('div', { style: { display: 'flex', width: 18, height: 18, borderRadius: 9, backgroundColor: color } }),
      label(`${abbr} · ${(abbr === game.away.abbr ? game.away.sog : game.home.sog) ?? 0} on goal`, { fontSize: 20, color: C.muted }));

  return shell({
    ...position,
    eyebrow: `${game.away.abbr} at ${game.home.abbr}`,
    children: col(
      { flexGrow: 1, paddingLeft: 56, paddingRight: 56 },
      col({ paddingTop: 8, paddingBottom: 16, gap: 6 },
        label('Every attempt', { color: C.accent, fontSize: 22 }),
        display('Shot map', { fontSize: 76, letterSpacing: -2 }),
        body(`${game.away.abbr} attacks left · ${game.home.abbr} attacks right`, { fontSize: 22, color: C.muted })),
      h('img', { src: svg, width, height: Math.round(width / RINK_RATIO) }),
      row({ alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 6 },
        legend(game.away.abbr, awayColor, 'flex-start'),
        label('Filled = on goal · ring = missed', { fontSize: 18, color: C.muted }),
        legend(game.home.abbr, homeColor, 'flex-end')),
      // Shots by period fills the lower half with the shape of the game.
      col({ flexGrow: 1, paddingTop: 14, gap: 4 },
        label('Shots on goal by period', { fontSize: 19, color: C.muted, marginBottom: 4 }),
        ...periods.map(entry =>
          row({ alignItems: 'center', gap: 16, flexGrow: 1 },
            label(entry.periodType === 'OT' ? 'OT' : `P${entry.period}`, { fontSize: 20, color: C.display, width: 62 }),
            display(String(entry.away), { fontSize: 26, color: awayColor, width: 44 }),
            row({ flexGrow: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
              h('div', { style: { display: 'flex', width: `${Math.round((entry.away / peak) * 44)}%`, height: 14, borderRadius: 7, backgroundColor: awayColor } })),
            row({ flexGrow: 1, alignItems: 'center', gap: 6 },
              h('div', { style: { display: 'flex', width: `${Math.round((entry.home / peak) * 44)}%`, height: 14, borderRadius: 7, backgroundColor: homeColor } })),
            display(String(entry.home), { fontSize: 26, color: homeColor, width: 44, textAlign: 'right' })))
      )
    ),
  });
}

// 4. The numbers behind it.
const STAT_LABELS = {
  sog: 'Shots on goal',
  faceoffWinningPctg: 'Faceoffs won',
  powerPlay: 'Power play',
  pim: 'Penalty minutes',
  hits: 'Hits',
  blockedShots: 'Blocked shots',
  giveaways: 'Giveaways',
  takeaways: 'Takeaways',
};

const statValue = (category, value) => {
  if (category === 'faceoffWinningPctg') return `${Math.round(Number(value) * 100)}%`;
  return String(value ?? '—');
};

const statShare = (category, away, home) => {
  const toNumber = value => {
    if (category === 'powerPlay') return Number(String(value).split('/')[0]) || 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const [a, b] = [toNumber(away), toNumber(home)];
  if (a + b <= 0) return 50;
  return Math.max(8, Math.min(92, Math.round((a / (a + b)) * 100)));
};

function metricsCard(game, logos, position) {
  const rows = game.teamStats
    .filter(stat => STAT_LABELS[stat.category])
    .sort((a, b) => Object.keys(STAT_LABELS).indexOf(a.category) - Object.keys(STAT_LABELS).indexOf(b.category))
    .slice(0, 6);
  const awayColor = onGround(game.away.abbr);
  const homeColor = onGround(game.home.abbr);

  return shell({
    ...position,
    eyebrow: `${game.away.abbr} at ${game.home.abbr}`,
    children: col(
      { flexGrow: 1 },
      col({ paddingLeft: 56, paddingRight: 56, paddingTop: 10, paddingBottom: 18, gap: 8 },
        label('The numbers', { color: C.accent, fontSize: 22 }),
        display('By the numbers', { fontSize: 78, letterSpacing: -2 }),
        row({ alignItems: 'center', gap: 14, paddingTop: 4 },
          logoImg(logos[game.away.abbr], 44),
          label(game.away.abbr, { fontSize: 22, color: awayColor }),
          col({ flexGrow: 1 }),
          label(game.home.abbr, { fontSize: 22, color: homeColor }),
          logoImg(logos[game.home.abbr], 44))),
      col({ flexGrow: 1, paddingLeft: 56, paddingRight: 56 }, ...rows.map((stat, index) => {
        const share = statShare(stat.category, stat.away, stat.home);
        return col(
          {
            flexGrow: 1,
            justifyContent: 'center',
            gap: 10,
            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
            borderBottomStyle: 'solid',
            borderBottomColor: C.border,
          },
          row({ alignItems: 'baseline' },
            display(statValue(stat.category, stat.away), { fontSize: 38, color: awayColor }),
            col({ flexGrow: 1, alignItems: 'center' }, label(STAT_LABELS[stat.category], { fontSize: 20, color: C.muted })),
            display(statValue(stat.category, stat.home), { fontSize: 38, color: homeColor })),
          row({ height: 12, width: '100%', borderRadius: 6, overflow: 'hidden' },
            h('div', { style: { display: 'flex', width: `${share}%`, height: 12, backgroundColor: awayColor } }),
            h('div', { style: { display: 'flex', width: `${100 - share}%`, height: 12, backgroundColor: homeColor } }))
        );
      }))
    ),
  });
}

export async function recapCard(game, card, position) {
  applyTheme(C.logoVariant === 'light' ? 'light' : 'dark');
  const logos = await teamLogos([game.away.abbr, game.home.abbr], C.logoVariant);
  if (card === 'goals') return goalsCard(game, logos, position);
  if (card === 'shots') return shotsCard(game, logos, position);
  if (card === 'metrics') return metricsCard(game, logos, position);
  return finalCard(game, logos, position);
}
