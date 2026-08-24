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

import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';

interface Props {
  onRegister: () => void;
}

export default function LoginScreen({ onRegister }: Props) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }

    try {
      setLoading(true);

      await login({
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (error) {
      Alert.alert(
        'Login failed',
        error instanceof Error ? error.message : 'Unable to login.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.container}>
      <Text style={styles.logo}>ChatGPT</Text>

      <Text style={styles.title}>Welcome back</Text>

      <Text style={styles.subtitle}>Log in to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
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
        <Button title="Log in" onPress={handleLogin} />
      )}

      <View style={styles.register}>
        <Text>Don't have an account?</Text>

        <Button title="Create account" onPress={onRegister} />
      </View>
    </View>
  </SafeAreaView>
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

  logo: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    marginBottom: 28,
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
