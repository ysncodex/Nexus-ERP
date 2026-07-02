import { useState, useEffect } from 'react';
import { authService, type AuthRole, type User } from '@/core/api/services';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (role: AuthRole, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

/**
 * Custom hook for authentication
 * Usage: const { user, isAuthenticated, login, logout } = useAuth();
 */
export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated on mount
    const checkAuth = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          // Verify token with backend
          const isValid = await authService.verifyToken();
          if (isValid) {
            setUser(currentUser);
          } else {
            authService.logout();
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        authService.logout();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (role: AuthRole, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await authService.login({ role, password });
      setUser(response.user);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    error,
  };
};
