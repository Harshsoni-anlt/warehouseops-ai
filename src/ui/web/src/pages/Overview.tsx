import React from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Chip, Button, Stack, Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';

const capabilities = [
  { icon: <ChatRoundedIcon />, title: 'Ask the assistant', to: '/chat',
    desc: 'Plain-language questions get routed by a multi-agent planner to the right tool and answered from live warehouse data.' },
  { icon: <TrendingUpRoundedIcon />, title: 'Demand forecasting', to: '/forecasting',
    desc: 'Train models on 180 days of demand, view MAPE/accuracy, and get reorder recommendations per SKU.' },
  { icon: <PrecisionManufacturingRoundedIcon />, title: 'Equipment & assets', to: '/equipment',
    desc: 'Track forklifts, AMRs, chargers and their status, telemetry, assignments, and maintenance schedule.' },
  { icon: <AssignmentRoundedIcon />, title: 'Operations', to: '/operations',
    desc: 'Pick / pack / putaway / cycle-count task queue with assignees, statuses, and workforce view.' },
  { icon: <HealthAndSafetyRoundedIcon />, title: 'Safety', to: '/safety',
    desc: 'Incident log by severity plus safety policies — the kind of compliance surface a real WMS needs.' },
  { icon: <DescriptionRoundedIcon />, title: 'Document extraction', to: '/documents',
    desc: 'Upload an invoice/BOL; an OCR + LLM pipeline extracts, validates, and routes it by quality score.' },
  { icon: <HubRoundedIcon />, title: 'MCP tools', to: '/mcp-test',
    desc: 'Each agent exposes its actions over the Model Context Protocol — inspect, search, and test the tools.' },
];

const dataFacts = [
  ['16', 'inventory SKUs', 'Real snack-brand catalog (Lay’s, Doritos, Cheetos…) with quantities, locations, reorder points.'],
  ['180 days', 'of demand history', '~3,300 stock movements with weekday + seasonal patterns — enough for real forecasting.'],
  ['12', 'equipment assets', 'Forklifts, AMRs, AGVs, chargers, conveyors — with live-style telemetry and maintenance.'],
  ['40+', 'operational records', 'Tasks, safety incidents, assignments and audit entries so every page has substance.'],
];

const tryPrompts = [
  'How many bags of Lay’s Classic do we have and where are they?',
  'Which forklifts are in maintenance right now?',
  'What items are below their reorder point?',
  'Forecast demand for DOR001 over the next 30 days.',
];

const Overview: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        {/* Hero */}
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Chip
            label="Live demo · runs on free, open-source infrastructure"
            color="primary" variant="outlined" size="small"
            sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
          />
          <Typography variant="h2" sx={{ maxWidth: 820 }}>
            A multi-agent assistant for warehouse operations
          </Typography>
          <Typography variant="body1" sx={{ maxWidth: 760, fontSize: '1.05rem', color: 'text.secondary' }}>
            WarehouseOps AI turns plain-language questions into real answers over a warehouse’s data.
            A planner routes each request to specialized agents — inventory, forecasting, equipment,
            operations, safety, and document processing — that query the live database and reply with
            grounded results. This page explains what you’re looking at and what to try.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
            <Button variant="contained" size="large" startIcon={<ChatRoundedIcon />} onClick={() => navigate('/chat')}>
              Try the assistant
            </Button>
            <Button variant="outlined" size="large" startIcon={<TrendingUpRoundedIcon />} onClick={() => navigate('/forecasting')}>
              See forecasting
            </Button>
          </Stack>
        </Stack>

        {/* The data */}
        <Typography variant="h4" sx={{ mb: 0.5 }}>What’s in this demo?</Typography>
        <Typography variant="body2" sx={{ mb: 2.5, maxWidth: 720 }}>
          It’s pre-loaded with a realistic snack-distribution warehouse so nothing is empty. All data is
          synthetic and safe to explore — add, edit, and query it freely.
        </Typography>
        <Grid container spacing={2} sx={{ mb: 5 }}>
          {dataFacts.map(([num, label, desc]) => (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 800 }}>{num}</Typography>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
                  <Typography variant="body2">{desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Capabilities */}
        <Typography variant="h4" sx={{ mb: 2.5 }}>What you can do</Typography>
        <Grid container spacing={2} sx={{ mb: 5 }}>
          {capabilities.map((c) => (
            <Grid item xs={12} sm={6} md={4} key={c.title}>
              <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate(c.to)}>
                <CardContent>
                  <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center',
                    bgcolor: 'rgba(13,148,136,0.10)', color: 'primary.main', mb: 1.5 }}>
                    {c.icon}
                  </Box>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>{c.title}</Typography>
                  <Typography variant="body2">{c.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Try asking */}
        <Card sx={{ mb: 5, background: 'linear-gradient(135deg, rgba(13,148,136,0.06), rgba(16,185,129,0.04))' }}>
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <BoltRoundedIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5">Try asking the assistant</Typography>
            </Stack>
            <Grid container spacing={1.5}>
              {tryPrompts.map((p) => (
                <Grid item xs={12} md={6} key={p}>
                  <Box
                    onClick={() => navigate('/chat')}
                    sx={{ p: 1.75, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                      cursor: 'pointer', transition: 'all .15s', '&:hover': { borderColor: 'primary.main' } }}
                  >
                    <Typography variant="body2" sx={{ color: 'text.primary' }}>“{p}”</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* How it works */}
        <Typography variant="h4" sx={{ mb: 2.5 }}>How it works</Typography>
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1} alignItems="center" justifyContent="space-between"
              divider={<Box sx={{ color: 'text.disabled', px: 1 }}>→</Box>}
            >
              {[
                ['React console', 'you ask a question'],
                ['LangGraph planner', 'picks the right agent(s)'],
                ['MCP tools + guardrails', 'safe, structured actions'],
                ['SQLite + ChromaDB', 'facts & documents'],
                ['Groq LLM', 'grounded natural answer'],
              ].map(([t, s]) => (
                <Box key={t} sx={{ textAlign: 'center', flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{t}</Typography>
                  <Typography variant="caption">{s}</Typography>
                </Box>
              ))}
            </Stack>
            <Divider sx={{ my: 2.5 }} />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {['Python', 'FastAPI', 'LangGraph', 'Model Context Protocol', 'NeMo Guardrails', 'Groq',
                'sentence-transformers', 'ChromaDB', 'SQLite', 'React', 'TypeScript'].map((t) => (
                <Chip key={t} label={t} size="small" icon={<Inventory2RoundedIcon sx={{ fontSize: 14 }} />} />
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Built by Harsh Soni · Demo login: admin / changeme · All data is synthetic.
        </Typography>
      </Container>
    </Box>
  );
};

export default Overview;
