import React, { useState } from 'react';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, useTheme, useMediaQuery,
  Menu, MenuItem, Avatar, Chip, Divider, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ExploreOutlined, SpaceDashboardOutlined, ForumOutlined,
  PrecisionManufacturingOutlined, InsightsOutlined, AssignmentTurnedInOutlined,
  HealthAndSafetyOutlined, DescriptionOutlined, BarChartOutlined,
  MenuBookOutlined, HubOutlined, LogoutOutlined, CircleOutlined,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 248;

interface LayoutProps { children: React.ReactNode; }

/** Grouped navigation — reduces the "wall of links" problem. */
const navGroups: { label: string; items: { text: string; icon: React.ReactNode; path: string }[] }[] = [
  {
    label: 'Overview',
    items: [
      { text: 'Start Here', icon: <ExploreOutlined fontSize="small" />, path: '/' },
      { text: 'Dashboard', icon: <SpaceDashboardOutlined fontSize="small" />, path: '/dashboard' },
      { text: 'Assistant', icon: <ForumOutlined fontSize="small" />, path: '/chat' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { text: 'Equipment', icon: <PrecisionManufacturingOutlined fontSize="small" />, path: '/equipment' },
      { text: 'Tasks', icon: <AssignmentTurnedInOutlined fontSize="small" />, path: '/operations' },
      { text: 'Safety', icon: <HealthAndSafetyOutlined fontSize="small" />, path: '/safety' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { text: 'Forecasting', icon: <InsightsOutlined fontSize="small" />, path: '/forecasting' },
      { text: 'Documents', icon: <DescriptionOutlined fontSize="small" />, path: '/documents' },
      { text: 'Analytics', icon: <BarChartOutlined fontSize="small" />, path: '/analytics' },
    ],
  },
  {
    label: 'System',
    items: [
      { text: 'MCP Tools', icon: <HubOutlined fontSize="small" />, path: '/mcp-test' },
      { text: 'Documentation', icon: <MenuBookOutlined fontSize="small" />, path: '/documentation' },
    ],
  },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();

  const go = (path: string) => { navigate(path); if (isMobile) setMobileOpen(false); };

  const isFullBleed = location.pathname === '/chat';

  const currentTitle =
    navGroups.flatMap(g => g.items).find(i => i.path === location.pathname)?.text ?? 'WarehouseOps AI';

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand */}
      <Box sx={{ px: 2.5, height: 64, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{
          width: 30, height: 30, borderRadius: 2.2, display: 'grid', placeItems: 'center',
          background: 'linear-gradient(135deg,#10B981,#059B6C)',
          boxShadow: '0 2px 8px rgba(5,155,108,.35), inset 0 1px 0 rgba(255,255,255,.25)',
        }}>
          <Box component="svg" viewBox="0 0 24 24" sx={{ width: 17, height: 17 }} aria-hidden>
            <rect x="2" y="13" width="8.5" height="8.5" rx="1.8" fill="#fff" fillOpacity=".95" />
            <rect x="13.5" y="13" width="8.5" height="8.5" rx="1.8" fill="#fff" fillOpacity=".75" />
            <rect x="7.75" y="2.5" width="8.5" height="8.5" rx="1.8" fill="#fff" />
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 750, fontSize: '0.9375rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            WarehouseOps
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', color: 'primary.main' }}>
            AI
          </Typography>
        </Box>
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
        {navGroups.map(group => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            <Typography variant="overline" sx={{ px: 3, display: 'block', mb: 0.5, fontSize: '0.625rem' }}>
              {group.label}
            </Typography>
            <List disablePadding>
              {group.items.map(item => (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
                  <ListItemButton selected={location.pathname === item.path} onClick={() => go(item.path)}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/* Footer status */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 1,
          borderRadius: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider',
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', boxShadow: '0 0 0 3px rgba(16,185,129,.16)' }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
            Live demo · synthetic data
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      <AppBar position="fixed" sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, zIndex: t => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ minHeight: '64px !important', px: { xs: 2, md: 3 }, gap: 1 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 1, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>

          <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em', color: 'text.primary' }}>
            {currentTitle}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Chip
            size="small"
            icon={<CircleOutlined sx={{ fontSize: '10px !important' }} />}
            label="Demo"
            sx={{ display: { xs: 'none', sm: 'inline-flex' }, mr: 0.5 }}
          />

          <Tooltip title="Account">
            <IconButton onClick={e => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar sx={{ width: 30, height: 30 }}>
                {(user?.username || 'A').charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography sx={{ fontWeight: 650, fontSize: '0.875rem' }}>{user?.full_name || user?.username || 'Demo user'}</Typography>
              <Typography variant="caption">{user?.role || 'admin'}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { logout(); navigate('/login'); setAnchorEl(null); }}>
              <ListItemIcon><LogoutOutlined fontSize="small" /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
                ModalProps={{ keepMounted: true }}
                sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" open
                sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}>
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${drawerWidth}px)` }, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Toolbar sx={{ minHeight: '64px !important' }} />
        {/* The assistant is a full-height app surface: it manages its own
            scrolling, so page padding would break its height math. */}
        {isFullBleed ? (
          children
        ) : (
          <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3.5 }, maxWidth: 1440, mx: 'auto' }}>
            {children}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Layout;
