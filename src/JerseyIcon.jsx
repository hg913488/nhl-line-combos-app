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
  const id = useId().replace(/:/g, '');
  const maskId = `jersey-mask-${id}`;
  const shadeId = `jersey-shade-${id}`;
  const uniform = HOME_UNIFORMS[team] || HOME_UNIFORMS.VAN;

  return (
    <svg className="jersey-icon" width={size} height={Math.round(size * 0.84)} viewBox="270 300 715 590" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
          <image href="/jersey-template.png" x="0" y="0" width="1254" height="1254" />
        </mask>
        <filter id={shadeId} x="-10%" y="-10%" width="120%" height="120%">
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <g mask={`url(#${maskId})`}>
        <rect width="1254" height="1254" fill={uniform.body} />
        <path d="M298 420 379 349 505 324 625 430 749 324 875 374 953 480 915 521 807 454 735 411H519l-74 43-108 67-39-41Z" fill={uniform.shoulder} opacity=".92" />
        <path d="M323 610h145v24H323Zm-10 98h154v24H313Zm474-98h145v24H787Zm1 98h154v24H788ZM452 766h350v25H452Zm-1 83h352v22H451Z" fill={uniform.number} />
        <path d="M321 638h145v66H321Zm475 0h145v66H796ZM453 795h349v51H453Z" fill={uniform.stripe} />
      </g>
      <image href="/jersey-template.png" x="0" y="0" width="1254" height="1254" filter={`url(#${shadeId})`} style={{ mixBlendMode: 'multiply' }} />
      <image href={`/team-logos/${team}.svg`} x="557" y="470" width="136" height="95" preserveAspectRatio="xMidYMid meet" />
      <text x="625" y="715" textAnchor="middle" fill={uniform.number} stroke="#111111" strokeWidth="18" paintOrder="stroke" className="jersey-number">
        {number || '–'}
      </text>
    </svg>
  );
}
