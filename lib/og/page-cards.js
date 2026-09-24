// 1200x630 link-preview cards (og:image / twitter:image).
import { NHL_TEAMS, TEAM_COLORS } from '../../src/teams.js';
import { etDate, etTime, SITE_NAME, SITE_TAGLINE } from '../../src/page-meta.js';
import { BRAND_MARK, brandMark, teamLogos } from './assets.js';
import { lines } from './card-data.js';
import { C, FONTS, PAGE, applyTheme, h, row, col, label, display, body, rule, fitDisplay } from './theme.js';

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

// Home card: the site's Quick Scan view as a softened backdrop — a run of
// team strips with two of them opened to today's lines — under the mark and
// wordmark. Built from lines.json on every render, so the names stay current.
// Strips keep the site's alphabetical order but skip the run between the two
// open teams so both panels fit in 1200px.
const SCAN_ORDER = ['edmonton-oilers', 'florida-panthers', 'los-angeles-kings', 'minnesota-wild', 'montreal-canadiens', 'nashville-predators', 'toronto-maple-leafs', 'utah-mammoth', 'vancouver-canucks'];
const SCAN_OPEN = ['florida-panthers', 'toronto-maple-leafs'];
const STRIP_W = 78;
const OPEN_W = 318;
const surname = name => String(name || '').trim().split(/\s+/).slice(-1)[0] || '';

const scanTile = name =>
  col(
    {
      flexGrow: 1,
      flexBasis: 0,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: C.border,
      backgroundColor: C.surface,
      overflow: 'hidden',
    },
    h('div', { style: { display: 'flex', fontFamily: FONTS.body, fontWeight: 700, fontSize: 12, color: C.text, textTransform: 'uppercase' } }, surname(name))
  );

const openStrip = (slug, logo) => {
  const team = NHL_TEAMS[slug];
  const lineup = lines()?.teams?.[slug] || {};
  const forwards = lineup.forwards?.slice(0, 4) || [];
  const defense = lineup.defense?.slice(0, 2) || [];
  return col(
    { width: OPEN_W, height: '100%', flexShrink: 0, paddingTop: 22, paddingLeft: 16, paddingRight: 16, gap: 10, backgroundColor: '#E4EEF2', borderRightWidth: 1, borderRightStyle: 'solid', borderRightColor: C.border },
    row(
      { alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.border },
      logo ? h('img', { src: logo.src, width: Math.round(40 * logo.ratio), height: 40 }) : null,
      col(
        { gap: 2 },
        h('div', { style: { display: 'flex', fontFamily: FONTS.display, fontWeight: 800, fontSize: 17, color: C.text } }, team.city),
        h('div', { style: { display: 'flex', fontFamily: FONTS.body, fontSize: 13, color: C.muted } }, team.name)
      )
    ),
    label('Forwards', { fontSize: 11, letterSpacing: 2, marginBottom: 6 }),
    ...forwards.map((unit, index) =>
      col(
        { gap: 5 },
        label(`Line ${index + 1}`, { fontSize: 10, letterSpacing: 2 }),
        row({ gap: 5 }, ...unit.slice(0, 3).map(scanTile))
      )
    ),
    label('Defense', { fontSize: 11, letterSpacing: 2, marginTop: 6, marginBottom: 6 }),
    ...defense.map((pair, index) =>
      col(
        { gap: 5 },
        label(`Pair ${index + 1}`, { fontSize: 10, letterSpacing: 2 }),
        row({ gap: 5 }, ...pair.slice(0, 2).map(scanTile))
      )
    )
  );
};

const closedStrip = (slug, logo) => {
  const team = NHL_TEAMS[slug];
  const city = (team.short || team.city).toUpperCase();
  return col(
    { width: STRIP_W, height: '100%', flexShrink: 0, alignItems: 'center', paddingTop: 220, gap: 78, backgroundColor: C.surface, borderRightWidth: 1, borderRightStyle: 'solid', borderRightColor: C.border },
    logo ? h('img', { src: logo.src, width: Math.round(40 * logo.ratio), height: 40 }) : null,
    // Satori has no vertical writing-mode, so the city name is a rotated line
    // inside a fixed box, reading upward like the site's strips.
    row(
      { width: 150, height: 16, alignItems: 'center', justifyContent: 'center', transform: 'rotate(-90deg)' },
      h('div', { style: { display: 'flex', fontFamily: FONTS.display, fontWeight: 800, fontSize: 10, letterSpacing: 1.5, color: C.muted, whiteSpace: 'nowrap' } }, city)
    )
  );
};

const homeCard = async () => {
  applyTheme('light');
  const logos = await teamLogos(SCAN_ORDER.map(slug => NHL_TEAMS[slug].abbr), 'light');
  return h(
    'div',
    { style: { display: 'flex', position: 'relative', width: PAGE.width, height: PAGE.height, backgroundColor: C.bg, overflow: 'hidden' } },
    row(
      { position: 'absolute', left: 0, top: 0, height: PAGE.height },
      ...SCAN_ORDER.map(slug => (SCAN_OPEN.includes(slug) ? openStrip : closedStrip)(slug, logos[NHL_TEAMS[slug].abbr]))
    ),
    // Soften the scan so the wordmark leads, clearest at the edges.
    h('div', { style: { display: 'flex', position: 'absolute', left: 0, top: 0, width: PAGE.width, height: PAGE.height, backgroundImage: 'radial-gradient(ellipse 58% 40% at 50% 50%, rgba(238,242,246,0.97) 0%, rgba(238,242,246,0.9) 45%, rgba(238,242,246,0.3) 100%)' } }),
    col(
      { position: 'absolute', left: 0, top: 0, width: PAGE.width, height: PAGE.height, alignItems: 'center', justifyContent: 'center', gap: 20 },
      h('img', { src: brandMark('light'), width: 124, height: 93 }),
      display(SITE_NAME, { fontSize: 52, letterSpacing: -1, color: C.display }),
      label(SITE_TAGLINE, { fontSize: 22, letterSpacing: 2, textTransform: 'none', color: C.muted })
    )
  );
};

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
      logo ? h('img', { src: logo.src, width: Math.round(230 * logo.ratio), height: 230 }) : null,
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
      logo ? h('img', { src: logo.src, width: Math.round(190 * logo.ratio), height: 190 }) : display(abbr, { fontSize: 90 }),
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
  // `C` is shared with the Instagram templates, so pin the palette rather than
  // inherit whatever the last render in this warm instance left behind.
  applyTheme('dark');

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
