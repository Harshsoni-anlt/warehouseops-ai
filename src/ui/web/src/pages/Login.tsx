import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LoginForm {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginForm>({ username: 'admin', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(formData.username, formData.password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 2,
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(13,148,136,0.10), transparent 60%), #F6F8FB',
      }}
    >
      <Paper
        elevation={2}
        sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4.5 }, borderRadius: 4 }}
      >
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 3,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #0D9488, #10B981)',
              boxShadow: '0 6px 18px rgba(13,148,136,0.35)',
            }}
          >
            <WarehouseRoundedIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            WarehouseOps&nbsp;AI
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Sign in to the multi-agent warehouse operations console
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth size="medium" label="Username" name="username"
            value={formData.username} onChange={handleInputChange}
            margin="normal" required autoComplete="username" autoFocus
          />
          <TextField
            fullWidth size="medium" label="Password" name="password" type="password"
            value={formData.password} onChange={handleInputChange}
            margin="normal" required autoComplete="current-password"
          />
          <Button
            type="submit" fullWidth variant="contained" disableElevation
            disabled={loading}
            sx={{ mt: 2.5, mb: 1, py: 1.4, fontSize: '1rem', fontWeight: 700 }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Sign in'}
          </Button>
        </form>

        <Box
          sx={{
            mt: 2, p: 2, borderRadius: 2.5,
            backgroundColor: 'rgba(13,148,136,0.06)',
            border: '1px solid rgba(13,148,136,0.18)',
          }}
        >
          <Typography variant="overline" sx={{ color: 'primary.dark' }}>
            Demo credentials
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>
            <strong>admin</strong> &nbsp;/&nbsp; <strong>changeme</strong>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;
