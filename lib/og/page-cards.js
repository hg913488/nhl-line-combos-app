// 1200x630 link-preview cards (og:image / twitter:image).
import { NHL_TEAMS, TEAM_COLORS } from '../../src/teams.js';
import { etDate, etTime, SITE_NAME, SITE_TAGLINE } from '../../src/page-meta.js';
import { BRAND_MARK, teamLogos } from './assets.js';
import { C, FONTS, PAGE, h, row, col, label, display, body, rule, fitDisplay } from './theme.js';

const EYEBROW = 'NHL · Daily lineup intelligence';

const ROUTE_CARDS = {
  teams: { title: 'Team Lines', sub: 'Forward lines, pairs, and power-play units for all 32 teams' },
  compare: { title: 'Compare', sub: 'Two lineups, side by side' },
  news: { title: 'NHL News', sub: 'The headlines that move lineups' },
  reporters: { title: 'Beat Reporters', sub: 'Morning-skate and warmup notes, team by team' },
  moves: { title: 'Line Moves', sub: 'Promotions, demotions, scratches — newest first' },
  injuries: { title: 'Injuries', sub: 'Who is out, and the hole it leaves' },
  players: { title: 'Player Stats', sub: 'Recent form next to current lineup role' },
  matchups: { title: 'Matchups', sub: 'Goals against by position and tonight’s edges' },
  playoffs: { title: 'Playoffs', sub: 'Bracket, lineups, and starting goalies' },
  picks: { title: 'Picks', sub: 'The daily log, graded on the record' },
  disclaimer: { title: 'Disclaimer', sub: 'The fine print, in plain words' },
  game: { title: 'Game Preview', sub: 'Lineups, line moves, and starting goalies' },
};

const FOOTER_LEFT = 'Line combos · Line moves · Starting goalies · Injuries';

const frame = (children, { accent = C.rule, footerRight = 'Updated daily', footerLeft = FOOTER_LEFT } = {}) =>
  col(
    { width: PAGE.width, height: PAGE.height, backgroundColor: C.bg },
    rule(accent),
    row(
      {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 56,
        paddingRight: 56,
        paddingTop: 30,
        paddingBottom: 30,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: C.border,
      },
      label(EYEBROW),
      label(SITE_NAME, { color: C.accent, letterSpacing: 2 })
    ),
    col({ flexGrow: 1, justifyContent: 'center', paddingLeft: 56, paddingRight: 56 }, children),
    row(
      {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 56,
        paddingRight: 56,
        paddingTop: 26,
        paddingBottom: 26,
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: C.border,
      },
      label(footerLeft, { fontSize: 18, letterSpacing: 2 }),
      label(footerRight, { fontSize: 18, letterSpacing: 2 })
    )
  );

const mark = size => h('img', { src: BRAND_MARK, width: size, height: Math.round((size * 3) / 4) });

const homeCard = () =>
  frame(
    row(
      { alignItems: 'center', gap: 56 },
      mark(230),
      col(
        { gap: 18 },
        display(SITE_NAME, { fontSize: 104, lineHeight: 0.9, maxWidth: 700 }),
        body(SITE_TAGLINE, { fontFamily: FONTS.label, fontSize: 30, letterSpacing: 1 })
      )
    )
  );

const routeCard = card => {
  const route = ROUTE_CARDS[card] || ROUTE_CARDS.teams;
  return frame(
    row(
      { alignItems: 'center', justifyContent: 'space-between', gap: 40 },
      col(
        { gap: 22, maxWidth: 760 },
        label(SITE_NAME, { color: C.accent, fontSize: 22 }),
        display(route.title, { fontSize: fitDisplay(route.title, { max: 112, min: 66, perChar: 5 }) }),
        body(route.sub, { fontSize: 30, maxWidth: 700 })
      ),
      mark(190)
    )
  );
};

const teamCard = (slug, logo) => {
  const team = NHL_TEAMS[slug];
  if (!team) return routeCard('teams');
  const accent = TEAM_COLORS[team.abbr] || C.accent;
  return frame(
    row(
      { alignItems: 'center', gap: 54 },
      logo ? h('img', { src: logo, width: 230, height: 230 }) : null,
      col(
        { gap: 16, maxWidth: 740 },
        label(team.city, { fontSize: 26, color: C.muted }),
        display(team.name, { fontSize: fitDisplay(team.name, { max: 104, min: 58, perChar: 6 }) }),
        h('div', { style: { display: 'flex', width: 120, height: 8, backgroundColor: accent, marginTop: 6, marginBottom: 6 } }),
        body('Line combinations · Line moves', { fontFamily: FONTS.label, fontSize: 24, letterSpacing: 1 })
      )
    ),
    { accent, footerRight: team.abbr }
  );
};

const gameCard = (away, home, start, logos) => {
  const day = etDate(start);
  const time = etTime(start);
  const when = [day, time].filter(Boolean).join(' · ') || 'Puck drop TBD';
  const side = (abbr, logo) =>
    col(
      { alignItems: 'center', gap: 14 },
      logo ? h('img', { src: logo, width: 190, height: 190 }) : display(abbr, { fontSize: 90 }),
      label(abbr, { fontSize: 26, color: C.text })
    );
  return frame(
    col(
      { alignItems: 'center', gap: 26 },
      row(
        { alignItems: 'center', gap: 56 },
        side(away, logos[away]),
        display('@', { fontSize: 64, color: C.muted, letterSpacing: 0 }),
        side(home, logos[home])
      ),
      display(`${away} @ ${home}`, { fontSize: 66 }),
      label(when, { fontSize: 24, color: C.accent })
    ),
    { footerRight: day || 'Tonight' }
  );
};

const compareCard = slugs => {
  const teams = slugs.filter(slug => NHL_TEAMS[slug]).slice(0, 2);
  if (teams.length < 2) return routeCard('compare');
  const [first, second] = teams.map(slug => NHL_TEAMS[slug]);
  return frame(
    col(
      { gap: 22 },
      label(SITE_NAME, { color: C.accent, fontSize: 22 }),
      display(`${first.name} vs ${second.name}`, {
        fontSize: fitDisplay(`${first.name} vs ${second.name}`, { max: 96, min: 52, perChar: 3 }),
        maxWidth: 1050,
      }),
      body('Lineups side by side: forward lines, pairs, power-play units', { fontSize: 28 })
    ),
    { accent: TEAM_COLORS[first.abbr] || C.rule }
  );
};

/**
 * Builds a 1200x630 card element tree.
 * @param {URLSearchParams} params
 */
export async function pageCard(params) {
  const card = params.get('card') || 'home';
  if (card === 'home') return homeCard();

  if (card === 'team') {
    const slug = params.get('team') || '';
    const abbr = NHL_TEAMS[slug]?.abbr;
    const logos = abbr ? await teamLogos([abbr]) : {};
    return teamCard(slug, logos[abbr]);
  }

  if (card === 'game') {
    const away = (params.get('away') || '').toUpperCase();
    const home = (params.get('home') || '').toUpperCase();
    if (!away || !home) return routeCard('game');
    const logos = await teamLogos([away, home]);
    return gameCard(away, home, params.get('start'), logos);
  }

  if (card === 'compare') {
    const slugs = (params.get('teams') || '').split(',').map(slug => slug.trim().toLowerCase());
    return compareCard(slugs);
  }

  return routeCard(card);
}
