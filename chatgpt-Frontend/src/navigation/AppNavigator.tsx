import React, { useEffect, useState } from 'react';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatScreen from '../screens/ChatScreen';

import { getCurrentUser } from '../api/authApi';

import { getToken, removeToken } from '../storage/tokenStorage';

import { User } from '../types/auth';

type Screen = 'login' | 'register' | 'chat';

export default function AppNavigator() {
  const [screen, setScreen] = useState<Screen>('login');

  const [user, setUser] = useState<User | null>(null);

  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const token = await getToken();

      if (!token) {
        setScreen('login');
        return;
      }

      const currentUser = await getCurrentUser(token);

      setUser(currentUser);
      setScreen('chat');
    } catch {
      await removeToken();
      setScreen('login');
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async () => {
    const token = await getToken();

    if (!token) {
      return;
    }

    try {
      const currentUser = await getCurrentUser(token);

      setUser(currentUser);
      setScreen('chat');
    } catch {
      await removeToken();
      setScreen('login');
    }
  };

  const handleLogout = async () => {
    await removeToken();

    setUser(null);
    setScreen('login');
  };

  if (checkingAuth) {
    return null;
  }

  if (screen === 'register') {
    return <RegisterScreen onRegistered={() => setScreen('login')} />;
  }

  if (screen === 'chat' && user) {
    return <ChatScreen userName={user.name} onLogout={handleLogout} />;
  }

  return (
    <LoginScreen
      onLogin={handleLogin}
      onRegister={() => setScreen('register')}
    />
  );
}
