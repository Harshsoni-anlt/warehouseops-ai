import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Public portfolio demo: no login screen. Silently authenticate as the demo
  // user on load so everyone lands straight in and every feature works.
  const setUserFromToken = (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({
        id: parseInt(payload.sub),
        username: payload.username,
        email: payload.email || '',
        full_name: payload.username,
        role: payload.role,
        status: 'active',
      });
      return true;
    } catch {
      return false;
    }
  };

  const demoLogin = async () => {
    const username = process.env.REACT_APP_DEMO_USER || 'admin';
    const password = process.env.REACT_APP_DEMO_PASS || 'changeme';
    const resp = await api.post('/auth/login', { username, password }, { timeout: 30000 });
    const token = resp.data.access_token;
    if (token) {
      localStorage.setItem('auth_token', token);
      setUserFromToken(token);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem('auth_token');
      if (token && setUserFromToken(token)) {
        setIsLoading(false);
        return;
      }
      // Auto-login (retry a couple of times while the backend warms up).
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          await demoLogin();
          break;
        } catch {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    // Login timeout increased to 30 seconds to accommodate slow backend responses
    // Login should be fast, but backend might be slow during initialization
    const response = await api.post('/auth/login', {
      username,
      password,
    }, {
      timeout: 30000, // 30 second timeout for login
    });

    if (response.data.access_token) {
      localStorage.setItem('auth_token', response.data.access_token);
      
      // Extract user data from JWT token
      const token = response.data.access_token;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userData = {
        id: parseInt(payload.sub),
        username: payload.username,
        email: payload.email,
        full_name: payload.username, // Use username as fallback for full_name
        role: payload.role,
        status: 'active' // Default status
      };
      
      localStorage.setItem('user_info', JSON.stringify(userData));
      setUser(userData);
    } else {
      throw new Error('No token received');
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
