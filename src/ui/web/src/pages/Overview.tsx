import React from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button, Stack, Divider, alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import IsoWarehouse from '../components/IsoWarehouse';
import {
  ForumOutlined, InsightsOutlined, PrecisionManufacturingOutlined,
  AssignmentTurnedInOutlined, HealthAndSafetyOutlined, DescriptionOutlined,
  HubOutlined, BoltOutlined, ArrowForwardRounded, UploadFileOutlined,
} from '@mui/icons-material';

const capabilities = [
  { icon: <ForumOutlined />, title: 'Ask the assistant', to: '/chat',
    desc: 'Plain-language questions routed by a multi-agent planner and answered from live warehouse data.' },
  { icon: <InsightsOutlined />, title: 'Demand forecasting', to: '/forecasting',
    desc: 'Train models on 180 days of demand, compare MAPE and accuracy, get reorder recommendations.' },
  { icon: <PrecisionManufacturingOutlined />, title: 'Equipment & assets', to: '/equipment',
    desc: 'Forklifts, AMRs and chargers with status, telemetry, assignments and maintenance.' },
  { icon: <AssignmentTurnedInOutlined />, title: 'Operations', to: '/operations',
    desc: 'Pick, pack, putaway and cycle-count queues with assignees and workforce view.' },
  { icon: <HealthAndSafetyOutlined />, title: 'Safety', to: '/safety',
    desc: 'Incident log by severity plus the policy surface a real WMS needs.' },
  { icon: <DescriptionOutlined />, title: 'Document extraction', to: '/documents',
    desc: 'Upload an invoice — text extraction plus an LLM pulls vendor, dates and line items.' },
];

// Counts are read from the API, not hard-coded. The headline feature of this
// demo is importing your own data — a landing page that still insists there
// are 16 SKUs after you have loaded 400 of your own undermines the whole point.
const statCards = [
  { key: 'inventory', label: 'inventory SKUs',   hint: 'Product catalogue with locations and reorder points', spark: [6, 9, 7, 11, 9, 13, 12] },
  { key: 'movements', label: 'days of demand',   hint: 'Stock movements with weekday and seasonal patterns',   spark: [4, 7, 6, 10, 8, 12, 15] },
  { key: 'equipment', label: 'equipment assets', hint: 'Forklifts, AMRs, AGVs, chargers, conveyors',           spark: [8, 8, 10, 9, 11, 10, 12] },
  { key: 'mcp',       label: 'MCP tools',        hint: 'Discoverable agent actions over Model Context Protocol', spark: [2, 5, 6, 9, 12, 14, 16] },
];

/** Tiny inline sparkline — signals "this is live data", costs nothing. */
const Spark: React.FC<{ points: number[] }> = ({ points }) => {
  const w = 72, h = 22, max = Math.max(...points), min = Math.min(...points);
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / Math.max(1, max - min)) * (h - 4) - 2;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <Box component="svg" viewBox={`0 0 ${w} ${h}`} sx={{ width: w, height: h, overflow: 'visible' }} aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#sparkFill)" opacity=".18" />
      <path d={d} fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
    </Box>
  );
};

const flow = [
  ['You ask', 'plain language'],
  ['Planner', 'picks the agents'],
  ['MCP tools', 'safe actions'],
  ['SQLite + vectors', 'facts & docs'],
  ['Answer', 'grounded in data'],
];

const Overview: React.FC = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = React.useState<Record<string, string>>({
    inventory: '—', movements: '—', equipment: '—', mcp: '—',
  });

  React.useEffect(() => {
    const json = (url: string) => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
    (async () => {
      const [inv, eq, mcp] = await Promise.all([
        json('/api/v1/inventory/items?limit=1000'),
        json('/api/v1/equipment'),
        json('/api/v1/mcp/tools'),
      ]);
      const len = (v: any) => (Array.isArray(v) ? v.length : Array.isArray(v?.items) ? v.items.length : null);
      setCounts({
        inventory: len(inv)?.toLocaleString() ?? '—',
        // Demand history is the horizon the forecaster trains on, not a row count.
        movements: '180',
        equipment: len(eq)?.toLocaleString() ?? '—',
        mcp: (mcp?.total_tools ?? len(mcp?.tools))?.toLocaleString() ?? '—',
      });
    })();
  }, []);

  return (
    <Box>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative', overflow: 'hidden', borderRadius: 4, mb: 5,
          border: '1px solid', borderColor: 'divider',
          background: 'linear-gradient(135deg,#FFFFFF 0%,#F7FBF9 45%,#EEF7F3 100%)',
          boxShadow: '0 1px 2px rgba(11,18,32,.04), 0 12px 32px rgba(11,18,32,.06)',
        }}
      >
        {/* subtle grid texture */}
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.5,
          backgroundImage: `linear-gradient(${alpha('#0B1220', .045)} 1px, transparent 1px),
                            linear-gradient(90deg, ${alpha('#0B1220', .045)} 1px, transparent 1px)`,
          backgroundSize: '34px 34px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 30% 30%, #000 35%, transparent 75%)',
        }} />

        <Grid container sx={{ position: 'relative' }} alignItems="center">
          <Grid item xs={12} md={7}>
            <Box sx={{ p: { xs: 3, md: 6 } }}>
              <Chip label="Live demo · runs on free infrastructure" color="primary" size="small" sx={{ mb: 2.5 }} />
              <Typography variant="h1" sx={{ fontSize: { xs: '2rem', md: '3rem' }, mb: 2 }}>
                Warehouse operations,<br />answered in plain English.
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1.0625rem', maxWidth: 560, mb: 3.5 }}>
                Ask a question — a planner routes it to specialist agents for inventory,
                equipment, safety, forecasting and documents. They query the live database
                and answer with grounded results, not guesses.
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                <Button size="large" variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/chat')}>
                  Try the assistant
                </Button>
                <Button size="large" variant="outlined" startIcon={<InsightsOutlined />} onClick={() => navigate('/forecasting')}>
                  See forecasting
                </Button>
              </Stack>
            </Box>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ p: { xs: 2, md: 4 }, pr: { md: 6 } }}><IsoWarehouse /></Box>
          </Grid>
        </Grid>
      </Box>

      {/* ── Stats ────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h4">What's inside</Typography>
        <Typography variant="body2">pre-loaded so nothing is empty</Typography>
      </Stack>
      <Grid container spacing={2} sx={{ mb: 5 }}>
        {statCards.map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card
              sx={{
                height: '100%', position: 'relative', overflow: 'hidden',
                '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
                // accent edge — ties the card to the brand without flooding it
                '&::before': {
                  content: '""', position: 'absolute', insetInline: 0, top: 0, height: 3,
                  background: 'linear-gradient(90deg,#34D3A4,#10B981 40%,transparent)',
                },
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'primary.dark' }} className="tabular">
                    {counts[s.key as string]}
                  </Typography>
                  <Spark points={s.spark} />
                </Stack>
                <Typography variant="subtitle2" sx={{ mt: 0.75, mb: 1, color: 'text.primary' }}>{s.label}</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{s.hint}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Capabilities ─────────────────────────────────────── */}
      <Typography variant="h4" sx={{ mb: 2 }}>What you can do</Typography>
      <Grid container spacing={2} sx={{ mb: 5 }}>
        {capabilities.map(c => (
          <Grid item xs={12} sm={6} md={4} key={c.title}>
            <Card
              onClick={() => navigate(c.to)}
              sx={{
                height: '100%', cursor: 'pointer',
                '&:hover': { boxShadow: 3, transform: 'translateY(-2px)', borderColor: 'primary.light' },
                '&:hover .arrow': { opacity: 1, transform: 'translateX(0)' },
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Box sx={{
                    width: 38, height: 38, borderRadius: 2.5, display: 'grid', placeItems: 'center', mb: 1.75,
                    bgcolor: 'primary.50', color: 'primary.main',
                    border: '1px solid', borderColor: 'primary.100',
                  }}>
                    {c.icon}
                  </Box>
                  <ArrowForwardRounded className="arrow" sx={{ fontSize: 18, color: 'primary.main', opacity: 0, transform: 'translateX(-6px)', transition: 'all .18s' }} />
                </Stack>
                <Typography variant="h6" sx={{ mb: 0.5 }}>{c.title}</Typography>
                <Typography variant="body2">{c.desc}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Try + Bring your own data ────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 5 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <BoltOutlined sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="h5">Try asking</Typography>
              </Stack>
              <Stack spacing={1}>
                {[
                  'How many bags of Lay’s Classic do we have and where are they?',
                  'Which forklifts are in maintenance right now?',
                  'What items are below their reorder point?',
                  'Forecast demand for DOR001 over the next 30 days.',
                ].map(q => (
                  <Box key={q} onClick={() => navigate('/chat')}
                    sx={{
                      p: 1.5, borderRadius: 2.5, cursor: 'pointer',
                      border: '1px solid', borderColor: 'divider', bgcolor: 'grey.50',
                      transition: 'all .15s',
                      '&:hover': { borderColor: 'primary.light', bgcolor: 'primary.50' },
                    }}>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>“{q}”</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%', background: 'linear-gradient(160deg,#FFFFFF,#F4FBF8)' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <UploadFileOutlined sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="h5">Use your own data</Typography>
              </Stack>
              <Typography variant="body2" sx={{ mb: 2 }}>
                This demo ships with a synthetic snack-distribution warehouse — but it isn’t
                locked to it. Download a CSV template, fill it from your WMS export, upload,
                and the agents answer about <em>your</em> operation.
              </Typography>
              <Stack spacing={0.75}>
                {[
                  ['inventory', 'sku, name, quantity, location, reorder_point'],
                  ['movements', 'sku, movement_type, quantity, timestamp'],
                  ['equipment', 'asset_id, type, model, zone, status'],
                ].map(([name, cols]) => (
                  <Box key={name} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                    <Chip label={name} size="small" color="primary" />
                    <Typography variant="caption" sx={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: '0.6875rem' }}>
                      {cols}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── How it works ─────────────────────────────────────── */}
      <Typography variant="h4" sx={{ mb: 2 }}>How it works</Typography>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 1 }} alignItems="stretch">
            {flow.map(([title, sub], i) => (
              <React.Fragment key={title}>
                <Box sx={{ flex: 1, textAlign: { xs: 'left', md: 'center' } }}>
                  <Box sx={{
                    width: 26, height: 26, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', mb: 1,
                    bgcolor: 'primary.50', color: 'primary.dark', border: '1px solid', borderColor: 'primary.100',
                    fontSize: '0.75rem', fontWeight: 700,
                  }}>{i + 1}</Box>
                  <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{title}</Typography>
                  <Typography variant="caption">{sub}</Typography>
                </Box>
                {i < flow.length - 1 && (
                  <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', color: 'grey.300' }}>→</Box>
                )}
              </React.Fragment>
            ))}
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {['Python', 'FastAPI', 'LangGraph', 'Model Context Protocol', 'NeMo Guardrails', 'Groq',
              'sentence-transformers', 'ChromaDB', 'SQLite', 'scikit-learn', 'React', 'TypeScript'].map(t => (
              <Chip key={t} label={t} size="small" variant="outlined" />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        Built by Harsh Soni · All data shown is synthetic · Apache-2.0
      </Typography>
    </Box>
  );
};

export default Overview;
