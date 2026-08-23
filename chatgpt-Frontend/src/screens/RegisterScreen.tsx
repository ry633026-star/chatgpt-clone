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

import { registerUser } from '../api/authApi';

interface Props {
  onRegistered: () => void;
}

export default function RegisterScreen({ onRegistered }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      Alert.alert('Success', 'Account created successfully. Please login.');

      onRegistered();
    } catch (error) {
      Alert.alert(
        'Registration failed',
        error instanceof Error ? error.message : 'Unable to create account.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>

      <Text style={styles.subtitle}>Create your ChatGPT account</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

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
        <Button title="Create account" onPress={handleRegister} />
      )}

      <View style={styles.login}>
        <Text>Already have an account?</Text>

        <Button title="Login" onPress={onRegistered} />
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

  login: {
    marginTop: 24,
    alignItems: 'center',
  },
});
