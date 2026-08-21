import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

interface Props {
  userName: string;
  onLogout: () => void;
}

export default function ChatScreen({ userName, onLogout }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>ChatGPT</Text>

        <Button title="Logout" onPress={onLogout} />
      </View>

      <View style={styles.content}>
        <Text style={styles.welcome}>Hello, {userName} 👋</Text>

        <Text style={styles.subtitle}>How can I help you today?</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },

  logo: {
    fontSize: 22,
    fontWeight: '700',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  welcome: {
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 10,
    fontSize: 16,
  },
});
