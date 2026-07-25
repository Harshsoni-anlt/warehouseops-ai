import React from 'react';

/**
 * Shared chart language.
 *
 * The series palette is ordered so the first two colours are maximally
 * distinct (emerald / indigo) — most charts here only plot 2–3 series, so the
 * common case reads cleanly. Hues are spaced around the wheel and kept at
 * similar lightness so no single line visually dominates, and red/green are
 * never adjacent in the order (deuteranopia safety).
 */
export const SERIES = [
  '#10B981', // emerald — brand
  '#6366F1', // indigo
  '#F59E0B', // amber
  '#0EA5E9', // sky
  '#A855F7', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F43F5E', // rose
];

export const AXIS = {
  stroke: '#94A3B8',
  tick: { fill: '#64748B', fontSize: 11, fontWeight: 500 },
  line: { stroke: '#E7ECF2' },
};

export const GRID = {
  stroke: '#EDF1F6',
  strokeDasharray: '0',   // solid hairline reads calmer than dashes
  vertical: false,        // horizontal-only: the eye compares values, not time slots
};

/** Tooltip that matches the app's surfaces rather than Recharts' default. */
export const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E7ECF2',
        borderRadius: 10,
        boxShadow: '0 4px 8px rgba(11,18,32,.05), 0 12px 28px rgba(11,18,32,.09)',
        padding: '10px 12px',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {label !== undefined && (
        <div style={{ color: '#64748B', marginBottom: 6, fontWeight: 600 }}>{String(label)}</div>
      )}
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#334155', textTransform: 'capitalize' }}>
            {String(p.name).replace(/_/g, ' ')}
          </span>
          <span style={{ marginLeft: 'auto', color: '#0B1220', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {typeof p.value === 'number' ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const legendStyle = {
  fontSize: 12,
  color: '#64748B',
  paddingTop: 8,
};
