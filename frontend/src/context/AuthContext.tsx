import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, TOKEN_STORAGE_KEY } from '../services/api';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  setSession: (token: string, user: User) => void;
  setTokenAndFetchUser: (token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSession = useCallback((token: string, nextUser: User) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(nextUser);
  }, []);

  const setTokenAndFetchUser = useCallback(
    async (token: string) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      await refreshUser();
    },
    [refreshUser]
  );

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('reachinbox:unauthorized', onUnauthorized);
    return () => window.removeEventListener('reachinbox:unauthorized', onUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        setSession,
        setTokenAndFetchUser,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
