import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>ChatGPT Clone</Text>

        <Text style={styles.subtitle}>Web + Android + iOS</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default App;
