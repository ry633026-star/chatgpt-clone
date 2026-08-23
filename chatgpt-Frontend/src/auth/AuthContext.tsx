import React, { createContext, useContext, useEffect, useState } from 'react';

import { getCurrentUser, loginUser } from '../api/authApi';

import { getToken, removeToken, saveToken } from '../storage/tokenStorage';

import { LoginRequest, User } from '../types/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const currentUser = await getCurrentUser(token);

      setUser(currentUser);
    } catch {
      await removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginRequest) => {
    const result = await loginUser(data);

    await saveToken(result.access_token);

    const currentUser = await getCurrentUser(result.access_token);

    setUser(currentUser);
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
