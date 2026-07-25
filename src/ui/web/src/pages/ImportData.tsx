import React, { useRef, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Stack, Chip, Alert,
  LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Divider,
  FormControlLabel, Switch, Collapse, IconButton, Tooltip,
} from '@mui/material';
import {
  UploadFileOutlined, DownloadOutlined, CheckCircleOutlined, InsertDriveFileOutlined,
  Inventory2Outlined, PrecisionManufacturingOutlined, TimelineOutlined, CloseOutlined,
  ArrowForwardRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

type DatasetKey = 'inventory' | 'movements' | 'equipment';

const DATASETS: {
  key: DatasetKey; title: string; icon: React.ReactNode; blurb: string;
  required: string[]; optional: string[]; unlocks: string; sample: string[][];
}[] = [
  {
    key: 'inventory',
    title: 'Inventory',
    icon: <Inventory2Outlined />,
    blurb: 'Your product catalog and current stock levels.',
    required: ['sku', 'name', 'quantity'],
    optional: ['location', 'reorder_point'],
    unlocks: 'Stock questions, reorder alerts, "what’s below reorder point?"',
    sample: [
      ['SKU-001', 'Blue Widget 500ml', '1200', 'Zone A-Aisle 1', '200'],
      ['SKU-002', 'Red Widget 500ml', '850', 'Zone A-Aisle 2', '150'],
    ],
  },
  {
    key: 'movements',
    title: 'Demand history',
    icon: <TimelineOutlined />,
    blurb: 'Stock movements over time. This is what powers forecasting.',
    required: ['sku', 'movement_type', 'quantity', 'timestamp'],
    optional: ['location', 'notes'],
    unlocks: 'Demand forecasting and reorder recommendations — aim for 90+ days',
    sample: [
      ['SKU-001', 'outbound', '45', '2026-07-01 09:15:00', 'Zone A-Aisle 1', 'customer order'],
      ['SKU-001', 'inbound', '500', '2026-07-02 07:00:00', 'Receiving Dock', 'supplier delivery'],
    ],
  },
  {
    key: 'equipment',
    title: 'Equipment',
    icon: <PrecisionManufacturingOutlined />,
    blurb: 'Forklifts, robots, chargers and other assets you operate.',
    required: ['asset_id', 'type'],
    optional: ['model', 'zone', 'status', 'owner_user'],
    unlocks: 'Asset status, maintenance schedule, utilisation',
    sample: [
      ['FL-01', 'forklift', 'Toyota 8FGU25', 'Zone A', 'available', ''],
      ['AMR-01', 'amr', 'MiR-250', 'Zone B', 'charging', ''],
    ],
  },
];

interface ImportResult {
  dataset: string; imported: number; errors: string[]; message: string;
}

const ImportData: React.FC = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<DatasetKey>('inventory');
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ds = DATASETS.find(d => d.key === active)!;
  const allCols = [...ds.required, ...ds.optional];

  const downloadTemplate = () => {
    const header = allCols.join(',');
    const rows = ds.sample.map(r => r.join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${ds.key}_template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    setBusy(true); setError(null); setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/data/import/${active}?replace=${replace}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setResult(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.response?.data?.detail || 'Import failed. Check the column names match the template.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="h3">Import your data</Typography>
      </Stack>
      <Typography variant="body1" sx={{ mb: 3.5, maxWidth: 720 }}>
        This demo ships with a synthetic warehouse, but it isn’t locked to it. Export these
        columns from your WMS or a spreadsheet, upload, and every page and the assistant will
        answer about <em>your</em> operation instead.
      </Typography>

      {/* Dataset selector */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {DATASETS.map(d => {
          const selected = d.key === active;
          return (
            <Grid item xs={12} md={4} key={d.key}>
              <Card
                onClick={() => { setActive(d.key); setResult(null); setError(null); }}
                sx={{
                  cursor: 'pointer', height: '100%',
                  borderColor: selected ? 'primary.main' : 'divider',
                  boxShadow: selected ? 3 : 1,
                  bgcolor: selected ? 'primary.50' : 'background.paper',
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 2, display: 'grid', placeItems: 'center',
                      bgcolor: selected ? 'primary.main' : 'grey.100',
                      color: selected ? '#fff' : 'text.secondary',
                    }}>
                      {d.icon}
                    </Box>
                    <Typography variant="h6">{d.title}</Typography>
                    {selected && <CheckCircleOutlined sx={{ ml: 'auto', color: 'primary.main', fontSize: 18 }} />}
                  </Stack>
                  <Typography variant="body2">{d.blurb}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={2}>
        {/* Left: schema */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="h5">Expected columns</Typography>
                <Button size="small" variant="outlined" startIcon={<DownloadOutlined />} onClick={downloadTemplate}>
                  Template
                </Button>
              </Stack>

              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Unlocks:</strong> {ds.unlocks}
              </Alert>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Column</TableCell>
                    <TableCell>Required</TableCell>
                    <TableCell>Example</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allCols.map((c, i) => (
                    <TableRow key={c}>
                      <TableCell sx={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: '0.8125rem', color: 'text.primary' }}>
                        {c}
                      </TableCell>
                      <TableCell>
                        {ds.required.includes(c)
                          ? <Chip label="required" size="small" color="primary" />
                          : <Chip label="optional" size="small" />}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                        {ds.sample[0][i] || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: dropzone */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Upload your CSV</Typography>

              <Box
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                sx={{
                  p: 4, textAlign: 'center', cursor: 'pointer', borderRadius: 3,
                  border: '1.5px dashed',
                  borderColor: dragging ? 'primary.main' : 'divider',
                  bgcolor: dragging ? 'primary.50' : 'grey.50',
                  transition: 'all .15s',
                  '&:hover': { borderColor: 'primary.light', bgcolor: 'primary.50' },
                }}
              >
                <UploadFileOutlined sx={{ fontSize: 34, color: 'primary.main', mb: 1 }} />
                <Typography variant="subtitle1">
                  {dragging ? 'Drop to import' : 'Drop a CSV here, or click to choose'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Importing into <strong>{ds.title.toLowerCase()}</strong>
                </Typography>
                <input
                  ref={fileRef} type="file" accept=".csv,text/csv" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
                />
              </Box>

              <FormControlLabel
                sx={{ mt: 1.5 }}
                control={<Switch checked={replace} onChange={e => setReplace(e.target.checked)} size="small" />}
                label={
                  <Typography variant="body2">
                    Replace existing {ds.title.toLowerCase()} first
                    <Typography component="span" variant="caption" sx={{ display: 'block', color: 'text.disabled' }}>
                      Off: rows are added or updated by key. On: clears the table first.
                    </Typography>
                  </Typography>
                }
              />

              <Collapse in={busy}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 0.75 }}>Importing…</Typography>
                  <LinearProgress />
                </Box>
              </Collapse>

              <Collapse in={!!error}>
                <Alert severity="error" sx={{ mt: 2 }}
                  action={<IconButton size="small" onClick={() => setError(null)}><CloseOutlined fontSize="small" /></IconButton>}>
                  {error}
                </Alert>
              </Collapse>

              <Collapse in={!!result}>
                {result && (
                  <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircleOutlined />}>
                    <Typography variant="subtitle2" sx={{ color: 'inherit' }}>
                      Imported {result.imported} rows into {result.dataset}
                    </Typography>
                    {result.errors?.length > 0 && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                        {result.errors.length} row(s) skipped — {result.errors[0]}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button size="small" variant="contained" endIcon={<ArrowForwardRounded />}
                        onClick={() => navigate(active === 'equipment' ? '/equipment' : active === 'movements' ? '/forecasting' : '/dashboard')}>
                        See it in the app
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => navigate('/chat')}>
                        Ask about it
                      </Button>
                    </Stack>
                  </Alert>
                )}
              </Collapse>

              <Divider sx={{ my: 2.5 }} />
              <Typography variant="overline">Tips</Typography>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                <Typography variant="body2">• Column names must match exactly (lowercase).</Typography>
                <Typography variant="body2">• Extra columns are ignored, so a full WMS export is fine.</Typography>
                <Typography variant="body2">• Timestamps: <code>YYYY-MM-DD HH:MM:SS</code>.</Typography>
                <Typography variant="body2">• Re-importing the same SKU updates it rather than duplicating.</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ImportData;
