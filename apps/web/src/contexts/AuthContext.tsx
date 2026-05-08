import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import api from '../services/api';

export interface Player {
  id: string;
  email: string;
  displayName: string;
  elo: number;
  avatarUrl?: string;
}

export interface AuthContextValue {
  player: Player | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // On mount, attempt to restore session via the stored access token
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
      return;
    }
    api
      .get<Player>('/players/me')
      .then(({ data }) => setPlayer(data))
      .catch(() => {
        // Token invalid or expired — clear it so the guard redirects to login
        localStorage.removeItem('accessToken');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ player: Player; accessToken: string }>(
      '/auth/login',
      { email, password },
    );
    localStorage.setItem('accessToken', data.accessToken);
    setPlayer(data.player);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setPlayer(null);
      localStorage.removeItem('accessToken');
    }
  }, []);

  const refreshPlayer = useCallback(async () => {
    const { data } = await api.get<Player>('/players/me');
    setPlayer(data);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        player,
        isAuthenticated: !!player,
        isLoading,
        login,
        logout,
        refreshPlayer,
      }}
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
