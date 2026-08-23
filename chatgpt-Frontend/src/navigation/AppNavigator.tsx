import React, { useState } from 'react';

import { View, ActivityIndicator } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatScreen from '../screens/ChatScreen';

import { useAuth } from '../auth/AuthContext';

type Screen = 'login' | 'register';

export default function AppNavigator() {
  const { user, loading, logout } = useAuth();

  const [screen, setScreen] = useState<Screen>('login');

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (user) {
    return <ChatScreen userName={user.name} onLogout={logout} />;
  }

  if (screen === 'register') {
    return <RegisterScreen onRegistered={() => setScreen('login')} />;
  }

  return <LoginScreen onRegister={() => setScreen('register')} />;
}
