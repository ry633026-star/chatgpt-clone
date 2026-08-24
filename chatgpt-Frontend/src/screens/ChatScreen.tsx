import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createConversation,
  streamMessage,
  getMessages,
  sendMessage as sendChatMessage,
} from '../api/chatApi';

interface Props {
  userName: string;
  onLogout: () => Promise<void>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatScreen({ userName, onLogout }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || sending) {
      return;
    }

    try {
      setSending(true);
      setMessage('');

      let activeConversationId = conversationId;

      if (!activeConversationId) {
        const conversation = await createConversation(text.slice(0, 40));

        activeConversationId = conversation.id;

        setConversationId(activeConversationId);
      }

      const userMessageId = `${Date.now()}-user`;

      const assistantMessageId = `${Date.now()}-assistant`;

      setMessages(prev => [
        ...prev,

        {
          id: userMessageId,
          role: 'user',
          content: text,
        },

        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
        },
      ]);

      await streamMessage(activeConversationId, text, chunk => {
        setMessages(prev =>
          prev.map(item =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: item.content + chunk,
                }
              : item,
          ),
        );
      });
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.assistantRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.assistantText,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Sidebar / Header */}
        <View style={styles.sidebar}>
          <Text style={styles.logo}>ChatGPT</Text>

          <Pressable
            style={styles.newChatButton}
            onPress={() => {
              setMessages([]);
              setConversationId(null);
              setMessage('');
            }}
          >
            <Text style={styles.newChatText}>+ New chat</Text>
          </Pressable>

          <View style={styles.sidebarSpacer} />

          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>

          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        {/* Main Chat */}
        <View style={styles.main}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New chat</Text>
          </View>

          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={[
              styles.messages,
              messages.length === 0 && styles.emptyMessages,
            ]}
            ListEmptyComponent={
              <View style={styles.welcome}>
                <Text style={styles.welcomeTitle}>
                  How can I help you today?
                </Text>

                <Text style={styles.welcomeSubtitle}>Ask me anything.</Text>
              </View>
            }
          />

          {/* Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputBox}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Message ChatGPT..."
                placeholderTextColor="#777"
                multiline
                style={styles.input}
                onSubmitEditing={() => {
                  if (Platform.OS !== 'web') {
                    sendMessage();
                  }
                }}
              />

              <Pressable
                style={[
                  styles.sendButton,
                  (!message.trim() || sending) && styles.sendButtonDisabled,
                ]}
                onPress={sendMessage}
                disabled={!message.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.sendText}>↑</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.disclaimer}>
              ChatGPT can make mistakes. Check important information.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },

  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },

  sidebar: {
    width: 260,
    backgroundColor: '#f7f7f8',
    borderRightWidth: 1,
    borderRightColor: '#e5e5e5',
    padding: 16,
  },

  logo: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },

  newChatButton: {
    borderWidth: 1,
    borderColor: '#d1d1d1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },

  newChatText: {
    fontSize: 15,
    fontWeight: '600',
  },

  sidebarSpacer: {
    flex: 1,
  },

  userName: {
    fontSize: 14,
    marginBottom: 12,
  },

  logoutButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  logoutText: {
    fontSize: 14,
  },

  main: {
    flex: 1,
  },

  header: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  messages: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },

  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
  },

  welcome: {
    alignItems: 'center',
  },

  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },

  welcomeSubtitle: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },

  messageRow: {
    width: '100%',
    marginBottom: 18,
  },

  userRow: {
    alignItems: 'flex-end',
  },

  assistantRow: {
    alignItems: 'flex-start',
  },

  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },

  userBubble: {
    backgroundColor: '#f0f0f0',
  },

  assistantBubble: {
    backgroundColor: '#fff',
  },

  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },

  userText: {
    color: '#111',
  },

  assistantText: {
    color: '#222',
  },

  inputContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },

  inputBox: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d1d1d1',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },

  input: {
    flex: 1,
    maxHeight: 140,
    fontSize: 16,
    paddingTop: 8,
    paddingBottom: 8,
    color: '#111',
    outlineStyle: 'none',
  } as any,

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  sendText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#777',
    marginTop: 8,
  },
});
