import { api } from '../client';

// Type definitions for auth
export type AuthRole = 'owner' | 'manager';

export interface LoginCredentials {
  /** Role-based login matches the backend `/auth/login` contract. */
  role: AuthRole;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export interface User {
  id: string;
  name: string;
  role: string;
}

// Auth Service
export const authService = {
  // Login user (role + password)
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (response.token) {
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  },

  // Enter as read-only visitor (no password). Issues a real JWT so the
  // authenticated GET routes work; mutations stay blocked server-side.
  loginAsVisitor: async (): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/visitor');
    if (response.token) {
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  // Get current user
  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('authToken');
  },

  // Verify token with backend
  verifyToken: async (): Promise<boolean> => {
    try {
      await api.get('/auth/verify');
      return true;
    } catch {
      return false;
    }
  },
};
