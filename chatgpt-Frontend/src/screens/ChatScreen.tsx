import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createConversation,
  getConversations,
  Conversation,
  streamMessage,
  getMessages,
  deleteConversation,
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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Automatically update sidebar state when resizing between mobile & desktop
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setMessage('');
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const openConversation = async (id: string) => {
    try {
      setConversationId(id);
      setLoadingMessages(true);
      const fetchedMessages = await getMessages(id);
      setMessages(
        fetchedMessages.map(m => ({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      );
      if (isMobile) {
        setIsSidebarOpen(false);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      if (conversationId === id) {
        handleNewChat();
      }
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

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
        const newConv = await createConversation(text.slice(0, 30));
        activeConversationId = newConv.id;
        setConversationId(activeConversationId);
        loadConversations();
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

  const activeConv = conversations.find(c => c.id === conversationId);
  const headerTitle = activeConv ? activeConv.title : 'New chat';

  const renderSidebarContent = () => (
    <View style={styles.sidebarInner}>
      {/* Sidebar Header */}
      <View style={styles.sidebarHeader}>
        <Text style={styles.logo}>ChatGPT</Text>
        {isMobile && (
          <Pressable
            style={styles.closeSidebarButton}
            onPress={() => setIsSidebarOpen(false)}
          >
            <Text style={styles.closeSidebarText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* New Chat Button */}
      <Pressable style={styles.newChatButton} onPress={handleNewChat}>
        <Text style={styles.newChatText}>+ New chat</Text>
      </Pressable>

      {/* Conversation List */}
      <Text style={styles.sectionHeader}>Recent Chats</Text>
      <ScrollView style={styles.conversationList}>
        {conversations.map(conv => {
          const isActive = conv.id === conversationId;
          return (
            <View
              key={conv.id}
              style={[
                styles.conversationItem,
                isActive && styles.conversationItemActive,
              ]}
            >
              <Pressable
                style={styles.conversationTitleArea}
                onPress={() => openConversation(conv.id)}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.conversationText,
                    isActive && styles.conversationTextActive,
                  ]}
                >
                  {conv.title || 'Untitled Chat'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteConversation(conv.id)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* Sidebar Footer */}
      <View style={styles.sidebarFooter}>
        <Text style={styles.userName} numberOfLines={1}>
          {userName}
        </Text>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Mobile Backdrop Overlay */}
        {isMobile && isSidebarOpen && (
          <Pressable
            style={styles.backdrop}
            onPress={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Container */}
        {isSidebarOpen && (
          <View style={[styles.sidebar, isMobile && styles.mobileSidebar]}>
            {renderSidebarContent()}
          </View>
        )}

        {/* Main Chat Content */}
        <View style={styles.main}>
          {/* Top Bar / Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.menuButton}
              onPress={() => setIsSidebarOpen(prev => !prev)}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </Pressable>

            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>

            {isMobile ? (
              <Pressable
                style={styles.headerNewChatButton}
                onPress={handleNewChat}
              >
                <Text style={styles.headerNewChatIcon}>+</Text>
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Messages Area */}
          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#111" />
            </View>
          ) : (
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
          )}

          {/* Bottom Message Input Box */}
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
                  <ActivityIndicator size="small" color="#fff" />
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
    position: 'relative',
  },

  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 90,
  },

  sidebar: {
    width: 260,
    backgroundColor: '#f7f7f8',
    borderRightWidth: 1,
    borderRightColor: '#e5e5e5',
  },

  mobileSidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    maxWidth: '85%',
    zIndex: 100,
    backgroundColor: '#f7f7f8',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  sidebarInner: {
    flex: 1,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  },

  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  logo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },

  closeSidebarButton: {
    padding: 6,
  },

  closeSidebarText: {
    fontSize: 18,
    color: '#666',
  },

  newChatButton: {
    borderWidth: 1,
    borderColor: '#d1d1d1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    marginBottom: 16,
  },

  newChatText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },

  conversationList: {
    flex: 1,
  },

  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },

  conversationItemActive: {
    backgroundColor: '#e5e5e7',
  },

  conversationTitleArea: {
    flex: 1,
    marginRight: 8,
  },

  conversationText: {
    fontSize: 14,
    color: '#333',
  },

  conversationTextActive: {
    fontWeight: '600',
    color: '#000',
  },

  deleteButton: {
    padding: 4,
    opacity: 0.6,
  },

  deleteText: {
    fontSize: 12,
    color: '#666',
  },

  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 12,
    marginTop: 8,
  },

  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  logoutButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
  },

  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },

  main: {
    flex: 1,
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },

  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },

  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  menuIcon: {
    fontSize: 22,
    color: '#333',
  },

  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111',
    paddingHorizontal: 8,
  },

  headerNewChatButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  headerNewChatIcon: {
    fontSize: 24,
    color: '#333',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messages: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },

  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
  },

  welcome: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },

  welcomeSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },

  messageRow: {
    width: '100%',
    marginBottom: 16,
  },

  userRow: {
    alignItems: 'flex-end',
  },

  assistantRow: {
    alignItems: 'flex-start',
  },

  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },

  userBubble: {
    backgroundColor: '#f4f4f5',
  },

  assistantBubble: {
    backgroundColor: '#fff',
  },

  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },

  userText: {
    color: '#111',
  },

  assistantText: {
    color: '#222',
  },

  inputContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },

  inputBox: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#d1d1d1',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },

  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    paddingTop: 8,
    paddingBottom: 8,
    color: '#111',
    outlineStyle: 'none',
  } as any,

  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  sendButtonDisabled: {
    opacity: 0.3,
  },

  sendText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#888',
    marginTop: 6,
  },
});
