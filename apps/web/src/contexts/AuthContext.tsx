import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import api from '../services/api';

interface Player {
  id: string;
  email: string;
  displayName: string;
  elo: number;
  avatarUrl?: string;
}

interface AuthContextValue {
  player: Player | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setPlayer(data.player);
    localStorage.setItem('accessToken', data.accessToken);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setPlayer(null);
    localStorage.removeItem('accessToken');
  }, []);

  const refreshPlayer = useCallback(async () => {
    const { data } = await api.get('/players/me');
    setPlayer(data);
  }, []);

  return (
    <AuthContext.Provider
      value={{ player, isAuthenticated: !!player, login, logout, refreshPlayer }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
