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
    border: '#CBD4DE',
    text: '#12161B',
    muted: '#5A6470',
    accent: '#1F6E9C',
    rule: '#12161B',
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
        color: C.text,
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
