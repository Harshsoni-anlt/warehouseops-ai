// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

/**
 * Telemetry for one asset.
 *
 * This replaced a flat list that read:
 *
 *     battery_soc: 67.93 unknown
 *     7/24/2026, 9:56:33 PM (Quality: 100.0%)
 *
 * — raw column names, a literal "unknown" unit, no ordering, no sense of
 * whether any number was good or bad. The same data is now one card per
 * metric: current value, a readable label and unit, the direction of travel,
 * and a sparkline of the recorded history. Colour appears only where a
 * threshold is actually crossed.
 */

type Reading = {
  timestamp: string;
  asset_id: string;
  metric: string;
  value: number;
  unit?: string;
  quality_score?: number;
};

const LABELS: Record<string, string> = {
  battery_soc: 'Battery',
  battery_level: 'Battery',
  temp_c: 'Temperature',
  temperature: 'Temperature',
  speed: 'Speed',
  location_x: 'Position X',
  location_y: 'Position Y',
  utilization: 'Utilisation',
  runtime_hours: 'Runtime',
  error_count: 'Errors',
  throughput: 'Throughput',
  vibration: 'Vibration',
};

/** Returns 'warn' | 'bad' | null. Only metrics with a real operating range. */
function assess(metric: string, value: number): 'warn' | 'bad' | null {
  switch (metric) {
    case 'battery_soc':
    case 'battery_level':
      if (value < 15) return 'bad';
      if (value < 30) return 'warn';
      return null;
    case 'temp_c':
    case 'temperature':
      if (value > 60) return 'bad';
      if (value > 45) return 'warn';
      return null;
    case 'error_count':
      if (value > 5) return 'bad';
      if (value > 0) return 'warn';
      return null;
    default:
      return null;
  }
}

const label = (m: string) =>
  LABELS[m] || m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const fmt = (v: number) =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);

interface Props {
  assetId: string;
  readings?: Reading[];
  loading?: boolean;
}

const TelemetryPanel: React.FC<Props> = ({ assetId, readings, loading }) => {
  const series = React.useMemo(() => {
    if (!readings || readings.length === 0) return [];
    const byMetric = new Map<string, Reading[]>();
    readings.forEach((r) => {
      if (!byMetric.has(r.metric)) byMetric.set(r.metric, []);
      byMetric.get(r.metric)!.push(r);
    });
    return Array.from(byMetric.entries())
      .map(([metric, rows]) => {
        const sorted = [...rows].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const latest = sorted[sorted.length - 1];
        const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
        return {
          metric,
          unit: latest.unit || '',
          latest: latest.value,
          at: latest.timestamp,
          delta: previous ? latest.value - previous.value : null,
          state: assess(metric, latest.value),
          points: sorted.map((r) => ({
            t: new Date(r.timestamp).getTime(),
            v: r.value,
          })),
        };
      })
      .sort((a, b) => a.metric.localeCompare(b.metric));
  }, [readings]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (series.length === 0) {
    return (
      <Alert severity="info">
        No telemetry recorded for {assetId} in the last 7 days.
      </Alert>
    );
  }

  const colourFor = (state: 'warn' | 'bad' | null) =>
    state === 'bad' ? '#DC2626' : state === 'warn' ? '#D97706' : '#10B981';

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(3, minmax(0, 1fr))',
        },
      }}
    >
      {series.map((s) => {
        const stroke = colourFor(s.state);
        return (
          <Box
            key={s.metric}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 2,
              backgroundColor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {label(s.metric)}
              </Typography>
              {s.delta !== null && Math.abs(s.delta) > 0.001 && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
                >
                  {s.delta > 0 ? '▲' : '▼'} {fmt(Math.abs(s.delta))}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
              <Typography
                sx={{
                  fontSize: 28,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  fontVariantNumeric: 'tabular-nums',
                  color: s.state ? stroke : 'text.primary',
                }}
              >
                {fmt(s.latest)}
              </Typography>
              {s.unit && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {s.unit}
                </Typography>
              )}
            </Box>

            <Box sx={{ height: 56, mx: -0.5, mt: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s.points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id={`g-${s.metric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(15,23,42,.08)',
                    }}
                    labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                    formatter={(v: any) => [`${fmt(Number(v))} ${s.unit}`.trim(), label(s.metric)]}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={stroke}
                    strokeWidth={1.75}
                    fill={`url(#g-${s.metric})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>

            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {s.points.length} reading{s.points.length === 1 ? '' : 's'} · last{' '}
              {new Date(s.at).toLocaleString()}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default TelemetryPanel;
