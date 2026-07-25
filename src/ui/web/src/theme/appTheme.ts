// SPDX-License-Identifier: Apache-2.0
import { createTheme, alpha } from '@mui/material/styles';

/**
 * WarehouseOps AI — design system
 *
 * Principles
 *  1. Neutral-first. ~90% of the surface is slate/white; colour marks meaning.
 *  2. Hairline borders over heavy shadows. Depth is earned, not sprayed.
 *  3. One radius language (10/14/20) and an 8px spacing rhythm.
 *  4. Tight, confident typography — negative tracking on headings,
 *     tabular numerals everywhere data is shown.
 */

// ── Palette ───────────────────────────────────────────────────────────────
const BRAND = {
  50: '#ECFDF7', 100: '#D1FAE9', 200: '#A7F3D6', 300: '#6EE7BE',
  400: '#34D3A4', 500: '#10B981', 600: '#059B6C', 700: '#047A57',
  800: '#065F46', 900: '#064E3B',
};
const SLATE = {
  50: '#F8FAFC', 100: '#F1F5F9', 200: '#E7ECF2', 300: '#CBD5E1',
  400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
  800: '#1E293B', 900: '#0B1220',
};

const INK = SLATE[900];
const BODY = SLATE[700];
const MUTED = SLATE[500];
const BORDER = SLATE[200];
const CANVAS = '#F7F9FC';
const SURFACE = '#FFFFFF';
const PRIMARY = BRAND[600];

// ── Elevation: subtle, layered, never muddy ───────────────────────────────
const E = [
  'none',
  '0 1px 2px rgba(11,18,32,0.04)',
  '0 1px 2px rgba(11,18,32,0.04), 0 2px 6px rgba(11,18,32,0.05)',
  '0 2px 4px rgba(11,18,32,0.04), 0 6px 14px rgba(11,18,32,0.07)',
  '0 4px 8px rgba(11,18,32,0.05), 0 12px 28px rgba(11,18,32,0.09)',
  '0 8px 16px rgba(11,18,32,0.06), 0 24px 48px rgba(11,18,32,0.12)',
];
const shadows = Array.from({ length: 25 }, (_, i) => E[Math.min(i, E.length - 1)]);

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", "SF Mono", "Roboto Mono", ui-monospace, monospace';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: PRIMARY, light: BRAND[400], dark: BRAND[700], contrastText: '#FFFFFF' },
    secondary: { main: '#4F46E5', light: '#818CF8', dark: '#3730A3', contrastText: '#FFFFFF' },
    background:{ default: CANVAS, paper: SURFACE },
    text:      { primary: INK, secondary: MUTED, disabled: SLATE[400] },
    divider:   BORDER,
    success:   { main: BRAND[600], light: BRAND[100], dark: BRAND[800], contrastText: '#FFF' },
    error:     { main: '#DC2626', light: '#FEE2E2', dark: '#991B1B', contrastText: '#FFF' },
    warning:   { main: '#D97706', light: '#FEF3C7', dark: '#92400E', contrastText: '#FFF' },
    info:      { main: '#0284C7', light: '#E0F2FE', dark: '#075985', contrastText: '#FFF' },
    grey: SLATE,
  },

  // ── Type scale: 1.20 ratio, tightening as size grows ────────────────────
  typography: {
    fontFamily: FONT,
    h1: { fontWeight: 800, fontSize: '3rem',    lineHeight: 1.08, letterSpacing: '-0.035em', color: INK },
    h2: { fontWeight: 800, fontSize: '2.25rem', lineHeight: 1.14, letterSpacing: '-0.03em',  color: INK },
    h3: { fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2,  letterSpacing: '-0.025em', color: INK },
    h4: { fontWeight: 700, fontSize: '1.375rem',lineHeight: 1.25, letterSpacing: '-0.02em',  color: INK },
    h5: { fontWeight: 650, fontSize: '1.125rem',lineHeight: 1.35, letterSpacing: '-0.015em', color: INK },
    h6: { fontWeight: 650, fontSize: '0.9375rem',lineHeight: 1.4, letterSpacing: '-0.01em',  color: INK },
    subtitle1: { fontSize: '1rem',     fontWeight: 600, lineHeight: 1.5,  color: INK },
    subtitle2: { fontSize: '0.8125rem',fontWeight: 600, lineHeight: 1.45, color: MUTED },
    body1: { fontSize: '0.9375rem', lineHeight: 1.65, color: BODY },
    body2: { fontSize: '0.875rem',  lineHeight: 1.6,  color: MUTED },
    button:{ fontSize: '0.875rem',  fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
    caption:{ fontSize: '0.75rem',  lineHeight: 1.5,  color: MUTED },
    overline:{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED },
  },

  shape: { borderRadius: 10 },
  shadows: shadows as any,

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { colorScheme: 'light' },
        body: {
          backgroundColor: CANVAS,
          color: BODY,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          fontFeatureSettings: '"cv02","cv03","cv04","ss01"',
        },
        // Numbers line up in tables and stats
        'td, th, .tabular': { fontVariantNumeric: 'tabular-nums' },
        '::selection': { background: alpha(PRIMARY, 0.18) },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          background: SLATE[300], borderRadius: 10,
          border: '3px solid transparent', backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': { background: SLATE[400], backgroundClip: 'content-box' },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*:focus-visible': { outline: `2px solid ${alpha(PRIMARY, 0.5)}`, outlineOffset: 2 },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          boxShadow: E[1],
          transition: 'box-shadow .18s cubic-bezier(.4,0,.2,1), border-color .18s, transform .18s',
        },
      },
    },
    MuiCardContent: { styleOverrides: { root: { padding: 24, '&:last-child': { paddingBottom: 24 } } } },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: SURFACE, borderRadius: 14 },
        outlined: { border: `1px solid ${BORDER}` },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10, padding: '9px 16px', fontWeight: 600, minHeight: 40,
          transition: 'background-color .15s, box-shadow .15s, transform .06s',
          '&:active': { transform: 'translateY(0.5px)' },
        },
        sizeSmall: { minHeight: 32, padding: '5px 12px', fontSize: '0.8125rem' },
        sizeLarge: { minHeight: 48, padding: '12px 24px', fontSize: '0.9375rem' },
        containedPrimary: {
          background: `linear-gradient(180deg, ${BRAND[500]}, ${BRAND[600]})`,
          boxShadow: `0 1px 2px ${alpha(BRAND[900], 0.24)}, inset 0 1px 0 ${alpha('#fff', 0.18)}`,
          '&:hover': { background: `linear-gradient(180deg, ${BRAND[600]}, ${BRAND[700]})`, boxShadow: `0 3px 10px ${alpha(BRAND[700], 0.32)}` },
          '&.Mui-disabled': { background: SLATE[200], color: SLATE[400] },
        },
        outlined: {
          borderColor: BORDER, color: BODY, backgroundColor: SURFACE,
          '&:hover': { borderColor: SLATE[300], backgroundColor: SLATE[50] },
        },
        text: { color: BODY, '&:hover': { backgroundColor: SLATE[100] } },
      },
    },

    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'default' },
      styleOverrides: {
        root: {
          backgroundColor: alpha('#FFFFFF', 0.72),
          backdropFilter: 'saturate(180%) blur(12px)',
          color: INK,
          borderBottom: `1px solid ${BORDER}`,
        },
      },
    },

    MuiDrawer: { styleOverrides: { paper: { backgroundColor: SURFACE, borderRight: `1px solid ${BORDER}` } } },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 7, height: 24, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${BORDER}`, backgroundColor: SLATE[50], color: BODY },
        label: { paddingLeft: 8, paddingRight: 8 },
        colorPrimary: { backgroundColor: BRAND[50],  borderColor: BRAND[200], color: BRAND[800] },
        colorSuccess: { backgroundColor: BRAND[50],  borderColor: BRAND[200], color: BRAND[800] },
        colorError:   { backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' },
        colorWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' },
        colorInfo:    { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', color: '#075985' },
        outlined: { backgroundColor: 'transparent' },
      },
    },

    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10, backgroundColor: SURFACE,
          '& fieldset': { borderColor: BORDER, transition: 'border-color .15s, box-shadow .15s' },
          '&:hover fieldset': { borderColor: SLATE[300] },
          '&.Mui-focused fieldset': { borderColor: PRIMARY, borderWidth: 1, boxShadow: `0 0 0 3px ${alpha(PRIMARY, 0.14)}` },
        },
        input: { '&::placeholder': { color: SLATE[400], opacity: 1 } },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: MUTED, '&.Mui-focused': { color: BRAND[700] } } } },

    MuiDialog: { styleOverrides: { paper: { borderRadius: 18, border: `1px solid ${BORDER}`, boxShadow: E[5] } } },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.0625rem', fontWeight: 700, padding: '20px 24px 4px' } } },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 4px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } } },

    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 42, borderBottom: `1px solid ${BORDER}` },
        indicator: { height: 2, borderRadius: 2, backgroundColor: PRIMARY },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 42, padding: '0 14px', fontWeight: 600, fontSize: '0.875rem',
          color: MUTED, textTransform: 'none',
          '&:hover': { color: INK },
          '&.Mui-selected': { color: BRAND[700] },
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9, marginInline: 10, paddingBlock: 8, color: BODY, fontWeight: 500,
          transition: 'background-color .14s, color .14s',
          '& .MuiListItemIcon-root': { color: SLATE[400], minWidth: 34, transition: 'color .14s' },
          '&:hover': { backgroundColor: SLATE[100], color: INK, '& .MuiListItemIcon-root': { color: SLATE[600] } },
          '&.Mui-selected': {
            backgroundColor: BRAND[50], color: BRAND[800],
            '& .MuiListItemIcon-root': { color: PRIMARY },
            '& .MuiListItemText-primary': { fontWeight: 650 },
            '&:hover': { backgroundColor: BRAND[100] },
          },
        },
      },
    },
    MuiListItemText: { styleOverrides: { primary: { fontSize: '0.875rem' } } },

    MuiTable: { styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } } },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: SLATE[50], color: MUTED, fontWeight: 700,
            fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: `1px solid ${BORDER}`, paddingBlock: 10, whiteSpace: 'nowrap',
          },
        },
      },
    },
    MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${SLATE[100]}`, fontSize: '0.875rem', color: BODY, paddingBlock: 12 } } },
    MuiTableRow: { styleOverrides: { root: { transition: 'background-color .12s', '&:hover': { backgroundColor: SLATE[50] }, '&:last-child td': { borderBottom: 0 } } } },

    MuiLinearProgress: { styleOverrides: { root: { height: 6, borderRadius: 99, backgroundColor: SLATE[100] }, bar: { borderRadius: 99 } } },
    MuiCircularProgress: { styleOverrides: { root: { color: PRIMARY } } },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: '1px solid', fontSize: '0.875rem', alignItems: 'center' },
        standardSuccess: { backgroundColor: BRAND[50], borderColor: BRAND[200], color: BRAND[800] },
        standardError:   { backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' },
        standardWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' },
        standardInfo:    { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', color: '#075985' },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: SLATE[800], fontSize: '0.75rem', fontWeight: 500, borderRadius: 8, padding: '6px 10px', boxShadow: E[3] },
        arrow: { color: SLATE[800] },
      },
    },

    MuiMenu: { styleOverrides: { paper: { borderRadius: 12, border: `1px solid ${BORDER}`, boxShadow: E[4], marginTop: 6, minWidth: 180 } } },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8, margin: '2px 6px', padding: '8px 10px', fontSize: '0.875rem', color: BODY,
          '&:hover': { backgroundColor: SLATE[100] },
          '&.Mui-selected': { backgroundColor: BRAND[50], color: BRAND[800] },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 9, color: SLATE[500], '&:hover': { backgroundColor: SLATE[100], color: INK } },
      },
    },
    MuiAvatar: { styleOverrides: { root: { fontSize: '0.8125rem', fontWeight: 700, backgroundColor: BRAND[100], color: BRAND[800] } } },
    MuiDivider: { styleOverrides: { root: { borderColor: BORDER } } },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: SLATE[100], borderRadius: 8 } } },

    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: `1px solid ${BORDER}`, borderRadius: 14, backgroundColor: SURFACE,
          fontVariantNumeric: 'tabular-nums',
          '--DataGrid-rowBorderColor': SLATE[100],
        },
        columnHeaders: { backgroundColor: SLATE[50], borderBottom: `1px solid ${BORDER}` },
        columnHeaderTitle: { fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED },
        cell: { borderBottom: `1px solid ${SLATE[100]}`, fontSize: '0.875rem', color: BODY, outline: 'none !important' },
        row: { '&:hover': { backgroundColor: SLATE[50] } },
        footerContainer: { borderTop: `1px solid ${BORDER}`, backgroundColor: SLATE[50] },
      },
    },
  } as any,
});

export const tokens = { BRAND, SLATE, INK, BODY, MUTED, BORDER, CANVAS, SURFACE, PRIMARY, FONT, MONO, E };
export default appTheme;
