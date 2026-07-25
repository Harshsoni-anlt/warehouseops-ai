import React from 'react';
import { Box, Typography, Select, MenuItem, Tooltip, Stack, Divider } from '@mui/material';

interface TopBarProps {
  warehouse: string;
  role: string;
  environment: string;
  connections: { nim: boolean; db: boolean; milvus: boolean; kafka: boolean };
  onWarehouseChange: (warehouse: string) => void;
  onRoleChange: (role: string) => void;
  onEnvironmentChange: (env: string) => void;
}

/**
 * Context strip for the assistant.
 *
 * This sits directly under the application header, so it deliberately does NOT
 * look like a second header: no elevation, no title, 40px tall, muted labels.
 * Service health is a row of dots rather than four wifi glyphs — status is a
 * glance, not a read.
 */
const TopBar: React.FC<TopBarProps> = ({
  warehouse, role, connections, onWarehouseChange, onRoleChange,
}) => {
  const services = [
    { key: 'LLM (Groq)', ok: connections.nim },
    { key: 'Database', ok: connections.db },
    { key: 'Vector store', ok: connections.milvus },
  ];
  const allOk = services.every(s => s.ok);

  const selectSx = {
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '& .MuiSelect-select': { py: 0.25, pl: 0.75, pr: '22px !important', fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary' },
    '& .MuiSvgIcon-root': { fontSize: 18, color: 'text.disabled' },
    minHeight: 0,
  };

  return (
    <Box
      sx={{
        height: 40, px: 2, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 1.5,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'grey.50',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Site</Typography>
        <Select value={warehouse} onChange={e => onWarehouseChange(e.target.value)} variant="outlined" sx={selectSx}>
          <MenuItem value="WH-01">WH-01</MenuItem>
          <MenuItem value="WH-02">WH-02</MenuItem>
        </Select>
      </Stack>

      <Divider orientation="vertical" flexItem sx={{ my: 1.25 }} />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Role</Typography>
        <Select value={role} onChange={e => onRoleChange(e.target.value)} variant="outlined" sx={selectSx}>
          <MenuItem value="manager">Manager</MenuItem>
          <MenuItem value="operator">Operator</MenuItem>
          <MenuItem value="viewer">Viewer</MenuItem>
        </Select>
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      <Tooltip
        title={services.map(s => `${s.key}: ${s.ok ? 'connected' : 'unavailable'}`).join(' · ')}
        arrow
      >
        <Stack direction="row" alignItems="center" spacing={0.75}
          sx={{
            px: 1, py: 0.375, borderRadius: 99, border: '1px solid', borderColor: 'divider',
            bgcolor: 'background.paper', cursor: 'default',
            mr: 11, // clear the panel toggles anchored at the top-right
          }}>
          <Stack direction="row" spacing={0.5}>
            {services.map(s => (
              <Box key={s.key} sx={{
                width: 6, height: 6, borderRadius: '50%',
                bgcolor: s.ok ? 'primary.main' : 'grey.300',
              }} />
            ))}
          </Stack>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: allOk ? 'primary.dark' : 'text.secondary' }}>
            {allOk ? 'All systems live' : 'Degraded'}
          </Typography>
        </Stack>
      </Tooltip>
    </Box>
  );
};

export default TopBar;
