// Brand tokens and the tiny element factory used by the share-card templates.
// Satori accepts plain `{ type, props }` objects, so no JSX/React is needed:
// https://github.com/vercel/satori#use-without-jsx

// Card palettes. `C` is mutated per render by applyTheme() — the same pattern
// the app uses for its own palette, so every template reads plain tokens.
export const PALETTES = {
  dark: {
    bg: '#17191D',
    surface: '#22262C',
    border: '#3B4149',
    text: '#E7EAF0',
    display: '#E7EAF0',
    muted: '#A7ADB5',
    accent: '#438BB7',
    rule: '#CDD3DA',
    up: '#6FB48A',
    down: '#D08A7F',
    logoVariant: 'dark',
    washAmount: 0.4,
    pageGradient: 'linear-gradient(170deg, #1E2229 0%, #17191D 52%, #121418 100%)',
  },
  light: {
    bg: '#EEF2F6',
    surface: '#FFFFFF',
    // Ink carries the ground's blue bias — flat near-black sat on top of the
    // gradient instead of belonging to it.
    border: '#C6D1DD',
    text: '#1E2A38',
    // Large display type at full ink weight reads as a black slab on the pale
    // ground, so headlines sit a step lighter than body copy.
    display: '#2C3D4E',
    muted: '#5A6672',
    accent: '#1F6E9C',
    rule: '#2A3846',
    up: '#1E7A4F',
    down: '#B4453A',
    logoVariant: 'light',
    washAmount: -0.25,
    pageGradient: 'linear-gradient(170deg, #FBFCFD 0%, #EEF2F6 48%, #DDE5EC 100%)',
  },
};

export const C = { ...PALETTES.dark };

/** Switches every template to a palette before the element tree is built. */
export function applyTheme(name) {
  Object.assign(C, PALETTES[name] || PALETTES.dark);
  return C;
}

export const FONTS = {
  display: 'Syne',
  body: 'Space Grotesk',
  label: 'Space Mono',
};

export const PAGE = { width: 1200, height: 630 };
export const PORTRAIT = { width: 1080, height: 1350 };

/**
 * Element factory. Every node with more than one child gets `display: flex`
 * automatically, which Satori requires.
 */
export function h(type, props = {}, ...children) {
  const kids = children.flat().filter(child => child !== null && child !== undefined && child !== false);
  const style = props.style ? { ...props.style } : {};
  if (type === 'div' && kids.length > 1 && !style.display) style.display = 'flex';
  return { type, props: { ...props, style, children: kids.length === 1 ? kids[0] : kids } };
}

export const row = (style, ...children) => h('div', { style: { display: 'flex', flexDirection: 'row', ...style } }, ...children);
export const col = (style, ...children) => h('div', { style: { display: 'flex', flexDirection: 'column', ...style } }, ...children);

export const label = (text, style = {}) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        fontFamily: FONTS.label,
        fontSize: 20,
        letterSpacing: 3,
        textTransform: 'uppercase',
        color: C.muted,
        ...style,
      },
    },
    text
  );

export const display = (text, style = {}) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        fontFamily: FONTS.display,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: -2,
        lineHeight: 0.95,
        color: C.display || C.text,
        ...style,
      },
    },
    text
  );

export const body = (text, style = {}) =>
  h(
    'div',
    {
      style: { display: 'flex', fontFamily: FONTS.body, fontSize: 28, color: C.muted, lineHeight: 1.35, ...style },
    },
    text
  );

export const rule = (color = C.rule, height = 10) => h('div', { style: { display: 'flex', width: '100%', height, backgroundColor: color } });

export const divider = () => h('div', { style: { display: 'flex', width: '100%', height: 1, backgroundColor: C.border } });

/** Rounded team-colour chip used for abbreviations. */
export const chip = (text, color) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 74,
        height: 40,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 8,
        backgroundColor: `${color}22`,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: `${color}88`,
        fontFamily: FONTS.label,
        fontSize: 22,
        letterSpacing: 1,
        color: C.text,
      },
    },
    text
  );

/** Shrinks a display size so long strings still fit one line. */
export function fitDisplay(text, { max, min, perChar }) {
  const size = max - Math.max(0, String(text).length - 9) * perChar;
  return Math.max(min, Math.round(size));
}

/**
 * Carousel position marker: an "03 OF 08" pill, so a card saved or reposted on
 * its own still says where it sat in the set.
 *
 * No dot row — Instagram draws its own dots under the carousel, and a second
 * set on the artwork read as a duplicate of the app's chrome.
 */
export function slideMarker(index, total) {
  if (!Number.isFinite(index) || !Number.isFinite(total) || total < 2) return null;
  const pad = value => String(value).padStart(2, '0');
  return row(
    { alignItems: 'center', justifyContent: 'flex-end', paddingLeft: 56, paddingRight: 56, paddingTop: 10, paddingBottom: 6 },
    row(
      {
        alignItems: 'center',
        justifyContent: 'center',
        width: 150,
        paddingTop: 9,
        paddingBottom: 9,
        borderRadius: 24,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: C.border,
      },
      label(`${pad(index + 1)} of ${pad(total)}`, { fontSize: 19, color: C.muted, letterSpacing: 2 })
    )
  );
}
