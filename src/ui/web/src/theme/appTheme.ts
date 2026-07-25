// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License").

import { createTheme } from '@mui/material/styles';

/**
 * WarehouseOps AI — light, clean SaaS theme.
 * Teal/emerald accent, slate neutrals, generous whitespace, soft shadows.
 */

const TEAL = '#0D9488';
const TEAL_DARK = '#0F766E';
const TEAL_LIGHT = '#14B8A6';
const EMERALD = '#10B981';
const INK = '#0F172A';        // slate-900 (headings)
const BODY = '#334155';       // slate-700 (body)
const MUTED = '#64748B';      // slate-500 (secondary)
const FAINT = '#94A3B8';      // slate-400 (disabled)
const BORDER = '#E6E9EF';     // hairline borders
const SURFACE = '#FFFFFF';    // cards
const CANVAS = '#F6F8FB';     // app background
const HEAD_BG = '#F8FAFC';    // table head / subtle fills

const tealTint = (a: number) => `rgba(13, 148, 136, ${a})`;

const softShadow = [
  'none',
  '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
  '0 2px 4px rgba(15,23,42,0.05), 0 2px 8px rgba(15,23,42,0.06)',
  '0 4px 10px rgba(15,23,42,0.06), 0 2px 6px rgba(15,23,42,0.05)',
  '0 8px 20px rgba(15,23,42,0.08), 0 3px 8px rgba(15,23,42,0.06)',
  '0 12px 28px rgba(15,23,42,0.10), 0 4px 10px rgba(15,23,42,0.06)',
];
const shadows = Array.from({ length: 25 }, (_, i) => softShadow[Math.min(i, softShadow.length - 1)]);

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: TEAL, light: TEAL_LIGHT, dark: TEAL_DARK, contrastText: '#FFFFFF' },
    secondary: { main: EMERALD, light: '#34D399', dark: '#059669', contrastText: '#FFFFFF' },
    background: { default: CANVAS, paper: SURFACE },
    text: { primary: INK, secondary: MUTED, disabled: FAINT },
    divider: BORDER,
    success: { main: '#10B981', light: '#D1FAE5', dark: '#047857', contrastText: '#FFFFFF' },
    error: { main: '#EF4444', light: '#FEE2E2', dark: '#B91C1C', contrastText: '#FFFFFF' },
    warning: { main: '#F59E0B', light: '#FEF3C7', dark: '#B45309', contrastText: '#FFFFFF' },
    info: { main: '#0EA5E9', light: '#E0F2FE', dark: '#0369A1', contrastText: '#FFFFFF' },
    grey: {
      50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
      400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
      800: '#1E293B', 900: '#0F172A',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, fontSize: '2.25rem', lineHeight: 1.2, letterSpacing: '-0.02em', color: INK },
    h2: { fontWeight: 700, fontSize: '1.875rem', lineHeight: 1.25, letterSpacing: '-0.02em', color: INK },
    h3: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.3, letterSpacing: '-0.015em', color: INK },
    h4: { fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.35, letterSpacing: '-0.01em', color: INK },
    h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4, color: INK },
    h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.45, color: INK },
    subtitle1: { fontSize: '1rem', lineHeight: 1.6, fontWeight: 600, color: INK },
    subtitle2: { fontSize: '0.8125rem', lineHeight: 1.5, fontWeight: 600, color: MUTED },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6, color: BODY },
    body2: { fontSize: '0.875rem', lineHeight: 1.55, color: MUTED },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: '0.9375rem' },
    caption: { fontSize: '0.75rem', lineHeight: 1.4, color: MUTED },
    overline: { fontSize: '0.6875rem', lineHeight: 1.4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED },
  },
  shape: { borderRadius: 12 },
  shadows: shadows as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: CANVAS,
          color: BODY,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '*::-webkit-scrollbar': { width: 8, height: 8 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: 8 },
        '*::-webkit-scrollbar-thumb:hover': { background: '#94A3B8' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          boxShadow: softShadow[1],
          transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
          '&:hover': { boxShadow: softShadow[3], borderColor: '#D7DCE5' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundColor: SURFACE, backgroundImage: 'none', border: `1px solid ${BORDER}`, borderRadius: 14 },
        elevation0: { border: `1px solid ${BORDER}` },
        elevation1: { boxShadow: softShadow[1] },
        elevation2: { boxShadow: softShadow[2] },
        elevation3: { boxShadow: softShadow[3] },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, padding: '9px 18px', fontWeight: 600, textTransform: 'none', boxShadow: 'none' },
        containedPrimary: {
          backgroundColor: TEAL, color: '#FFFFFF', boxShadow: '0 1px 2px rgba(13,148,136,0.25)',
          '&:hover': { backgroundColor: TEAL_DARK, boxShadow: '0 4px 12px rgba(13,148,136,0.28)' },
          '&:active': { backgroundColor: TEAL_DARK },
          '&:disabled': { backgroundColor: '#E2E8F0', color: FAINT },
        },
        outlined: {
          borderColor: BORDER, color: BODY, backgroundColor: SURFACE,
          '&:hover': { borderColor: TEAL, color: TEAL_DARK, backgroundColor: tealTint(0.05) },
        },
        text: { color: BODY, '&:hover': { backgroundColor: tealTint(0.06), color: TEAL_DARK } },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'default' },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'saturate(180%) blur(8px)',
          color: INK,
          borderBottom: `1px solid ${BORDER}`,
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: SURFACE, borderRight: `1px solid ${BORDER}`, boxShadow: 'none' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { backgroundColor: HEAD_BG, border: `1px solid ${BORDER}`, color: BODY, fontWeight: 600, fontSize: '0.75rem', height: 24, borderRadius: 8 },
        colorPrimary: { backgroundColor: tealTint(0.10), borderColor: tealTint(0.35), color: TEAL_DARK },
        colorSuccess: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857' },
        colorError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' },
        colorWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#B45309' },
        colorInfo: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', color: '#0369A1' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: SURFACE, borderRadius: 10,
            '& fieldset': { borderColor: BORDER },
            '&:hover fieldset': { borderColor: '#CBD5E1' },
            '&.Mui-focused fieldset': { borderColor: TEAL, borderWidth: 2 },
            '& input': { color: INK, '&::placeholder': { color: FAINT, opacity: 1 } },
          },
          '& .MuiInputLabel-root': { color: MUTED, '&.Mui-focused': { color: TEAL_DARK } },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: softShadow[5] },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { borderBottom: `1px solid ${BORDER}`, padding: '18px 24px', color: INK, fontWeight: 700 } } },
    MuiDialogContent: { styleOverrides: { root: { padding: 24, color: BODY } } },
    MuiTabs: { styleOverrides: { root: { borderBottom: `1px solid ${BORDER}`, minHeight: 44 }, indicator: { backgroundColor: TEAL, height: 3, borderRadius: 3 } } },
    MuiTab: {
      styleOverrides: {
        root: { color: MUTED, fontWeight: 600, textTransform: 'none', fontSize: '0.9375rem', minHeight: 44, '&.Mui-selected': { color: TEAL_DARK }, '&:hover': { color: INK } },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10, margin: '2px 10px', color: BODY,
          '&.Mui-selected': {
            backgroundColor: tealTint(0.10), color: TEAL_DARK,
            '&:hover': { backgroundColor: tealTint(0.14) },
            '& .MuiListItemIcon-root': { color: TEAL },
          },
          '&:hover': { backgroundColor: '#F1F5F9' },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { color: MUTED, minWidth: 38 } } },
    MuiLinearProgress: { styleOverrides: { root: { backgroundColor: '#EDF1F6', borderRadius: 6, height: 8 }, bar: { borderRadius: 6, backgroundColor: TEAL } } },
    MuiCircularProgress: { styleOverrides: { root: { color: TEAL } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: '1px solid', fontWeight: 500 },
        standardSuccess: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' },
        standardError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' },
        standardWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' },
        standardInfo: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', color: '#075985' },
      },
    },
    MuiTable: { styleOverrides: { root: { backgroundColor: SURFACE } } },
    MuiTableHead: {
      styleOverrides: {
        root: { backgroundColor: HEAD_BG, '& .MuiTableCell-head': { color: MUTED, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${BORDER}` } },
      },
    },
    MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${BORDER}`, color: BODY, fontSize: '0.875rem' } } },
    MuiTableRow: { styleOverrides: { root: { '&:hover': { backgroundColor: '#F8FAFC' }, '&.Mui-selected': { backgroundColor: tealTint(0.08), '&:hover': { backgroundColor: tealTint(0.12) } } } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: INK, color: '#FFFFFF', borderRadius: 8, fontSize: '0.75rem', padding: '6px 10px', boxShadow: softShadow[3] },
        arrow: { color: INK },
      },
    },
    MuiMenu: { styleOverrides: { paper: { backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: softShadow[4], marginTop: 4 } } },
    MuiMenuItem: {
      styleOverrides: {
        root: { color: BODY, fontSize: '0.9rem', borderRadius: 8, margin: '2px 6px', padding: '8px 12px', '&:hover': { backgroundColor: '#F1F5F9' }, '&.Mui-selected': { backgroundColor: tealTint(0.10), color: TEAL_DARK, '&:hover': { backgroundColor: tealTint(0.14) } } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { color: MUTED, '&:hover': { backgroundColor: tealTint(0.08), color: TEAL_DARK } } } },
    MuiAvatar: { styleOverrides: { root: { backgroundColor: tealTint(0.12), color: TEAL_DARK, fontWeight: 700 } } },
    MuiDivider: { styleOverrides: { root: { borderColor: BORDER } } },
    MuiToggleButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderColor: BORDER, color: BODY, '&.Mui-selected': { backgroundColor: tealTint(0.12), color: TEAL_DARK, '&:hover': { backgroundColor: tealTint(0.16) } } },
      },
    },
  },
});
