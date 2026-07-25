import React from 'react';
import { Box } from '@mui/material';

/**
 * Isometric warehouse scene.
 *
 * Drawn in SVG rather than WebGL so it renders instantly, stays crisp at any
 * density, and costs nothing on load — important for a link opened from social.
 *
 * Construction notes:
 *  - True isometric projection: every box is three faces (top / left / right)
 *    with a fixed 2:1 rhombus, lit from the upper-left so the value order is
 *    always top > right > left. That consistency is what reads as "solid".
 *  - Depth cues, in order of strength: occlusion (draw order back→front),
 *    contact shadows, atmospheric fade on distant geometry, then lighting.
 */

type Vec = { x: number; y: number };

/** Isometric projection: grid (col,row,height) → screen point. */
const iso = (c: number, r: number, h = 0, ox = 250, oy = 150, tile = 26): Vec => ({
  x: ox + (c - r) * tile,
  y: oy + (c + r) * tile * 0.5 - h,
});

/** One isometric box: three faces + optional edge highlight. */
const Box3D: React.FC<{
  c: number; r: number; h?: number; size?: number; height?: number;
  top: string; left: string; right: string; opacity?: number;
}> = ({ c, r, h = 0, size = 1, height = 22, top, left, right, opacity = 1 }) => {
  const t = 26 * size;
  const p = iso(c, r, h);
  const topPts = `${p.x},${p.y - height} ${p.x + t},${p.y + t * 0.5 - height} ${p.x},${p.y + t - height} ${p.x - t},${p.y + t * 0.5 - height}`;
  const leftPts = `${p.x - t},${p.y + t * 0.5 - height} ${p.x},${p.y + t - height} ${p.x},${p.y + t} ${p.x - t},${p.y + t * 0.5}`;
  const rightPts = `${p.x + t},${p.y + t * 0.5 - height} ${p.x},${p.y + t - height} ${p.x},${p.y + t} ${p.x + t},${p.y + t * 0.5}`;
  return (
    <g opacity={opacity}>
      <polygon points={leftPts} fill={left} />
      <polygon points={rightPts} fill={right} />
      <polygon points={topPts} fill={top} />
      <polyline points={topPts} fill="none" stroke="#FFFFFF" strokeOpacity=".35" strokeWidth=".8" />
    </g>
  );
};

const IsoWarehouse: React.FC = () => (
  <Box
    component="svg"
    viewBox="0 0 500 400"
    sx={{
      width: '100%', height: 'auto', display: 'block', overflow: 'visible',
      '@keyframes floaty': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      '@keyframes pulse':  { '0%': { r: 5, opacity: 1 }, '70%': { r: 14, opacity: 0 }, '100%': { r: 14, opacity: 0 } },
      '@keyframes dash':   { to: { strokeDashoffset: -18 } },
      '& .float': { animation: 'floaty 6s ease-in-out infinite' },
      '& .float2': { animation: 'floaty 6s ease-in-out infinite', animationDelay: '-2s' },
      '& .float3': { animation: 'floaty 6s ease-in-out infinite', animationDelay: '-4s' },
      '& .ping':  { animation: 'pulse 2.8s ease-out infinite' },
      '& .ping2': { animation: 'pulse 2.8s ease-out infinite', animationDelay: '-.9s' },
      '& .ping3': { animation: 'pulse 2.8s ease-out infinite', animationDelay: '-1.8s' },
      '& .link':  { strokeDasharray: '4 5', animation: 'dash 1.4s linear infinite' },
      '@media (prefers-reduced-motion: reduce)': {
        '& .float, & .float2, & .float3, & .ping, & .ping2, & .ping3, & .link': { animation: 'none' },
      },
    }}
    aria-hidden
  >
    <defs>
      {/* Emerald family — top face lightest, left face darkest */}
      <linearGradient id="gTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6EE7BE" /><stop offset="100%" stopColor="#34D3A4" />
      </linearGradient>
      <linearGradient id="gRight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#059B6C" />
      </linearGradient>
      <linearGradient id="gLeft" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#047A57" /><stop offset="100%" stopColor="#065F46" />
      </linearGradient>
      {/* Slate family for racking / secondary mass */}
      <linearGradient id="sTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F1F5F9" /><stop offset="100%" stopColor="#E2E8F0" />
      </linearGradient>
      <linearGradient id="sRight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#CBD5E1" /><stop offset="100%" stopColor="#B4C0CE" />
      </linearGradient>
      <linearGradient id="sLeft" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A9B6C6" /><stop offset="100%" stopColor="#94A3B8" />
      </linearGradient>

      <linearGradient id="floor" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#E9EFF5" />
      </linearGradient>
      <radialGradient id="ambient" cx="50%" cy="45%">
        <stop offset="0%" stopColor="#10B981" stopOpacity=".20" />
        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="contact" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#0B1220" stopOpacity=".26" />
        <stop offset="100%" stopColor="#0B1220" stopOpacity="0" />
      </radialGradient>
      <filter id="lift" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#0B1220" floodOpacity=".16" />
      </filter>
    </defs>

    {/* ambient glow */}
    <ellipse cx="250" cy="230" rx="230" ry="140" fill="url(#ambient)" />

    {/* ── Floor slab with thickness ── */}
    <g filter="url(#lift)">
      <path d="M250 118 L432 209 L250 300 L68 209 Z" fill="url(#floor)" />
      <path d="M68 209 L250 300 L250 312 L68 221 Z" fill="#D2DBE5" />
      <path d="M432 209 L250 300 L250 312 L432 221 Z" fill="#BCC7D4" />
      <path d="M250 118 L432 209 L250 300 L68 209 Z" fill="none" stroke="#AFBCCB" strokeWidth="1" />
    </g>

    {/* floor grid — aisle markings */}
    <g stroke="#A9B8C9" strokeWidth=".7" opacity=".5">
      {[1, 2, 3, 4, 5].map(i => {
        const a = iso(i, 0), b = iso(i, 6);
        return <line key={`c${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {[1, 2, 3, 4, 5].map(i => {
        const a = iso(0, i), b = iso(6, i);
        return <line key={`r${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
    </g>

    {/* contact shadows under each stack */}
    {[[1.2, 4.2], [4.4, 1.4], [2.6, 2.6], [4.6, 4.4], [1.0, 1.2]].map(([c, r], i) => {
      const p = iso(c, r);
      return <ellipse key={i} cx={p.x} cy={p.y + 16} rx="30" ry="15" fill="url(#contact)" />;
    })}

    {/* ── Racking (back-left), drawn first so pallets occlude it ── */}
    <g opacity=".92">
      <Box3D c={0.6} r={0.6} size={.5} height={54} top="url(#sTop)" left="url(#sLeft)" right="url(#sRight)" />
      <Box3D c={1.5} r={0.2} size={.5} height={38} top="url(#sTop)" left="url(#sLeft)" right="url(#sRight)" />
    </g>

    {/* ── Pallet stacks: back → front for correct occlusion ── */}
    <Box3D c={4.4} r={1.4} size={.72} height={20} top="url(#gTop)" left="url(#gLeft)" right="url(#gRight)" opacity={.95} />
    <Box3D c={4.4} r={1.4} h={20} size={.66} height={18} top="url(#gTop)" left="url(#gLeft)" right="url(#gRight)" opacity={.95} />

    <Box3D c={2.6} r={2.6} size={.95} height={26} top="url(#gTop)" left="url(#gLeft)" right="url(#gRight)" />
    <Box3D c={2.6} r={2.6} h={26} size={.86} height={24} top="url(#gTop)" left="url(#gLeft)" right="url(#gRight)" />
    <Box3D c={2.6} r={2.6} h={50} size={.74} height={20} top="url(#gTop)" left="url(#gLeft)" right="url(#gRight)" />

    <Box3D c={1.2} r={4.2} size={.8} height={22} top="url(#sTop)" left="url(#sLeft)" right="url(#sRight)" />
    <Box3D c={1.2} r={4.2} h={22} size={.72} height={20} top="url(#gTop)" left="url(#gLeft)" right="url(#gRight)" />

    <Box3D c={4.6} r={4.4} size={.78} height={22} top="url(#gTop)" left="url(#gLeft)" right="url(#gRight)" />

    {/* small AMR puck with a status light */}
    <g>
      {(() => { const p = iso(1.0, 1.2); return (
        <>
          <ellipse cx={p.x} cy={p.y + 12} rx="20" ry="10" fill="url(#contact)" />
          <ellipse cx={p.x} cy={p.y} rx="20" ry="10" fill="#CBD5E1" />
          <ellipse cx={p.x} cy={p.y - 6} rx="20" ry="10" fill="#E7ECF2" />
          <rect x={p.x - 20} y={p.y - 6} width="40" height="6" fill="#B4C0CE" />
          <circle cx={p.x} cy={p.y - 7} r="3.5" fill="#10B981" />
        </>
      ); })()}
    </g>

    {/* ── Agent nodes: the "multi-agent" idea, floating above the floor ── */}
    {[
      { x: 92,  y: 92,  cls: 'float',  ping: 'ping',  label: 'M4 6h16M4 12h16M4 18h10' },        // inventory
      { x: 404, y: 104, cls: 'float2', ping: 'ping2', label: 'M4 18l5-6 4 4 7-9' },              // forecasting
      { x: 424, y: 196, cls: 'float3', ping: 'ping3', label: 'M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7z' }, // safety
    ].map((n, i) => (
      <g key={i}>
        <line className="link" x1={n.x} y1={n.y} x2="250" y2="150" stroke="#10B981" strokeWidth="1.2" strokeOpacity=".5" />
        <g className={n.cls}>
          <circle cx={n.x} cy={n.y} r="5" fill="#10B981" className={n.ping} />
          <circle cx={n.x} cy={n.y} r="16" fill="#FFFFFF" stroke="#A7F3D6" strokeWidth="1.5" />
          <g transform={`translate(${n.x - 7},${n.y - 7}) scale(0.58)`}>
            <path d={n.label} fill="none" stroke="#059B6C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </g>
    ))}

    {/* planner core */}
    <g className="float">
      <circle cx="250" cy="150" r="9" fill="#059B6C" opacity=".16" />
      <circle cx="250" cy="150" r="4.5" fill="#059B6C" />
    </g>
  </Box>
);

export default IsoWarehouse;
