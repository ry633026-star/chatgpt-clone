import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { loginUser } from '../api/authApi';
import { saveToken } from '../storage/tokenStorage';

interface Props {
  onLogin: () => void;
  onRegister: () => void;
}

export default function LoginScreen({ onLogin, onRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      setLoading(true);

      const result = await loginUser({
        email,
        password,
      });

      await saveToken(result.access_token);

      onLogin();
    } catch (error) {
      Alert.alert(
        'Login failed',
        error instanceof Error ? error.message : 'Unable to login',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>

      <Text style={styles.subtitle}>Login to your ChatGPT account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Login" onPress={handleLogin} />
      )}

      <View style={styles.register}>
        <Text>Don't have an account?</Text>

        <Button title="Create account" onPress={onRegister} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
  },

  register: {
    marginTop: 24,
    alignItems: 'center',
  },
});
