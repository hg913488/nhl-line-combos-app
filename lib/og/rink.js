// Rink diagram for the recap shot map, emitted as an SVG data URI because
// Satori lays out elements but does not draw primitives.
// NHL play-by-play coordinates: x -100..100 (length), y -42.5..42.5 (width).

const RINK = { x: -100, y: -42.5, width: 200, height: 85 };

const circle = (cx, cy, r, stroke, width = 0.4) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;

const dot = (cx, cy, fill, r = 0.8) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

/**
 * @param {{shots: Array, awayColor: string, homeColor: string, ice: string, line: string, red: string, blue: string}} options
 * @returns {string} data URI
 */
export function rinkSvg({ shots = [], awayColor, homeColor, ice, line, red, blue, plain = false }) {
  const marks = shots
    .filter(shot => Number.isFinite(shot.x) && Number.isFinite(shot.y))
    .map(shot => {
      const color = shot.side === 'home' ? homeColor : awayColor;
      if (shot.type === 'goal') {
        // Goals cluster in front of the net, so on the faint backdrop the ring
        // version tangles into a smudge. Plain dots of one colour merge into a
        // single readable shape instead.
        if (plain) return dot(shot.x, shot.y, color, 2.2);
        return `${dot(shot.x, shot.y, color, 2.6)}${circle(shot.x, shot.y, 4.2, color, 0.7)}`;
      }
      if (shot.type === 'shot') return dot(shot.x, shot.y, color, 1.7);
      // misses and blocks read as outlines so the on-goal attempts stay dominant
      return circle(shot.x, shot.y, 1.5, color, 0.5);
    })
    .join('');

  const faceoffs = [
    [-69, -22], [-69, 22], [69, -22], [69, 22],
  ].map(([cx, cy]) => `${circle(cx, cy, 15, red)}${dot(cx, cy, red)}`).join('');

  const neutralDots = [[-20, -22], [-20, 22], [20, -22], [20, 22]]
    .map(([cx, cy]) => dot(cx, cy, red)).join('');

  const crease = side =>
    `<path d="M ${side * 89} -4 A 6 6 0 0 ${side > 0 ? 0 : 1} ${side * 89} 4 Z" fill="${blue}" fill-opacity="0.18" stroke="${red}" stroke-width="0.3"/>`;

  if (plain) {
    return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${RINK.x} ${RINK.y} ${RINK.width} ${RINK.height}">
  <rect x="${RINK.x}" y="${RINK.y}" width="${RINK.width}" height="${RINK.height}" rx="28" ry="28" fill="none" stroke="${line}" stroke-width="0.9"/>
  <line x1="0" y1="${RINK.y}" x2="0" y2="${-RINK.y}" stroke="${line}" stroke-width="0.7"/>
  <line x1="-25" y1="${RINK.y}" x2="-25" y2="${-RINK.y}" stroke="${line}" stroke-width="0.7"/>
  <line x1="25" y1="${RINK.y}" x2="25" y2="${-RINK.y}" stroke="${line}" stroke-width="0.7"/>
  ${circle(0, 0, 15, line, 0.7)}
  ${circle(-69, -22, 15, line, 0.7)}${circle(-69, 22, 15, line, 0.7)}
  ${circle(69, -22, 15, line, 0.7)}${circle(69, 22, 15, line, 0.7)}
  ${marks}
</svg>`).toString('base64')}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${RINK.x} ${RINK.y} ${RINK.width} ${RINK.height}">
  <rect x="${RINK.x}" y="${RINK.y}" width="${RINK.width}" height="${RINK.height}" rx="28" ry="28" fill="${ice}" stroke="${line}" stroke-width="0.6"/>
  <line x1="0" y1="${RINK.y}" x2="0" y2="${-RINK.y}" stroke="${red}" stroke-width="1"/>
  <line x1="-25" y1="${RINK.y}" x2="-25" y2="${-RINK.y}" stroke="${blue}" stroke-width="1"/>
  <line x1="25" y1="${RINK.y}" x2="25" y2="${-RINK.y}" stroke="${blue}" stroke-width="1"/>
  <line x1="-89" y1="${RINK.y + 9}" x2="-89" y2="${-RINK.y - 9}" stroke="${red}" stroke-width="0.5"/>
  <line x1="89" y1="${RINK.y + 9}" x2="89" y2="${-RINK.y - 9}" stroke="${red}" stroke-width="0.5"/>
  ${circle(0, 0, 15, blue)}${dot(0, 0, blue)}
  ${faceoffs}${neutralDots}
  ${crease(-1)}${crease(1)}
  ${marks}
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export const RINK_RATIO = RINK.width / RINK.height;
