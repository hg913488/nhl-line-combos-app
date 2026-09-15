import React, { useId } from 'react';

export const HOME_UNIFORMS = {
  ANA: { body: '#FC4C02', shoulder: '#111111', stripe: '#B9975B', number: '#FFFFFF' },
  BOS: { body: '#111111', shoulder: '#111111', stripe: '#FFB81C', number: '#FFFFFF' },
  BUF: { body: '#003087', shoulder: '#003087', stripe: '#FFB81C', number: '#FFFFFF' },
  CGY: { body: '#C8102E', shoulder: '#C8102E', stripe: '#F1BE48', number: '#FFFFFF' },
  CAR: { body: '#CC0000', shoulder: '#CC0000', stripe: '#111111', number: '#FFFFFF' },
  CHI: { body: '#CF0A2C', shoulder: '#CF0A2C', stripe: '#111111', number: '#FFFFFF' },
  COL: { body: '#6F263D', shoulder: '#236192', stripe: '#A2AAAD', number: '#FFFFFF' },
  CBJ: { body: '#041E42', shoulder: '#041E42', stripe: '#CE1126', number: '#FFFFFF' },
  DAL: { body: '#006847', shoulder: '#006847', stripe: '#8F8F8C', number: '#FFFFFF' },
  DET: { body: '#CE1126', shoulder: '#CE1126', stripe: '#FFFFFF', number: '#FFFFFF' },
  EDM: { body: '#041E42', shoulder: '#041E42', stripe: '#FF4C00', number: '#FFFFFF' },
  FLA: { body: '#C8102E', shoulder: '#041E42', stripe: '#B9975B', number: '#FFFFFF' },
  LAK: { body: '#111111', shoulder: '#111111', stripe: '#A2AAAD', number: '#FFFFFF' },
  MIN: { body: '#154734', shoulder: '#154734', stripe: '#EAAA00', number: '#EEE3C7' },
  MTL: { body: '#AF1E2D', shoulder: '#AF1E2D', stripe: '#192168', number: '#FFFFFF' },
  NSH: { body: '#FFB81C', shoulder: '#041E42', stripe: '#FFFFFF', number: '#041E42' },
  NJD: { body: '#CE1126', shoulder: '#111111', stripe: '#FFFFFF', number: '#FFFFFF' },
  NYI: { body: '#00539B', shoulder: '#00539B', stripe: '#F47D30', number: '#FFFFFF' },
  NYR: { body: '#0038A8', shoulder: '#0038A8', stripe: '#CE1126', number: '#FFFFFF' },
  OTT: { body: '#111111', shoulder: '#C8102E', stripe: '#C69214', number: '#FFFFFF' },
  PHI: { body: '#F74902', shoulder: '#111111', stripe: '#FFFFFF', number: '#FFFFFF' },
  PIT: { body: '#111111', shoulder: '#111111', stripe: '#FCB514', number: '#FFFFFF' },
  SJS: { body: '#006D75', shoulder: '#006D75', stripe: '#111111', number: '#FFFFFF' },
  SEA: { body: '#001628', shoulder: '#355464', stripe: '#99D9D9', number: '#FFFFFF' },
  STL: { body: '#006AC6', shoulder: '#006AC6', stripe: '#FFB81C', number: '#FFFFFF' },
  TBL: { body: '#002868', shoulder: '#002868', stripe: '#FFFFFF', number: '#FFFFFF' },
  TOR: { body: '#003E7E', shoulder: '#003E7E', stripe: '#FFFFFF', number: '#FFFFFF' },
  UTA: { body: '#050505', shoulder: '#050505', stripe: '#6CACE4', number: '#FFFFFF' },
  VAN: { body: '#00205B', shoulder: '#00205B', stripe: '#00843D', number: '#FFFFFF' },
  VGK: { body: '#B4975A', shoulder: '#333F48', stripe: '#C8102E', number: '#FFFFFF' },
  WSH: { body: '#C8102E', shoulder: '#041E42', stripe: '#FFFFFF', number: '#FFFFFF' },
  WPG: { body: '#041E42', shoulder: '#041E42', stripe: '#7B9AC0', number: '#FFFFFF' },
};

export default function JerseyIcon({ team, number, size = 62 }) {
  const clipId = `jersey-${useId().replace(/:/g, '')}`;
  const uniform = HOME_UNIFORMS[team] || HOME_UNIFORMS.VAN;
  const jerseyPath = 'M33 6 42 2c2 4 14 4 16 0l9 4 19 10 11 35-16 6-11-26 9 53H21l9-53-11 26-16-6 11-35Z';

  return (
    <svg className="jersey-icon" width={size} height={Math.round(size * 0.9)} viewBox="0 0 100 88" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={jerseyPath} />
        </clipPath>
      </defs>
      <path d={jerseyPath} fill={uniform.body} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <g clipPath={`url(#${clipId})`}>
        <path d="M29 5 42 0c2 6 14 6 16 0l13 5 7 16-18 7H40l-18-7Z" fill={uniform.shoulder} />
        <path d="m7 37 17 6-3 8-17-6Zm86 0-17 6 3 8 17-6ZM20 68h60v7H20Z" fill={uniform.stripe} />
        <path d="M20 76h60v2H20Z" fill={uniform.number} opacity=".9" />
      </g>
      <path d="M43 2c2 4 12 4 14 0l-3 13-4 4-4-4Z" fill={uniform.stripe} stroke="currentColor" strokeWidth="1" />
      <path d="M46 4c2 2 6 2 8 0l-2 7-2 2-2-2Z" fill={uniform.body} />
      <image href={`/team-logos/${team}.svg`} x="41" y="17" width="18" height="15" preserveAspectRatio="xMidYMid meet" />
      <text x="50" y="60" textAnchor="middle" fill={uniform.number} stroke="#111111" strokeWidth="2.5" paintOrder="stroke" className="jersey-number">
        {number || '–'}
      </text>
    </svg>
  );
}
