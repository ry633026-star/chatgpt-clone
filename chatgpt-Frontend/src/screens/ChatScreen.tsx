import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Alert,
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
  renameConversation,
  stopMessageGeneration,
  regenerateMessage,
  editMessage,
  editAndResendMessage,
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
  const activeConversationIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

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
      if (Platform.OS === 'web') {
        window.alert('Failed to delete conversation.');
      } else {
        Alert.alert('Error', 'Failed to delete conversation.');
      }
    }
  };
  // chat/conversation/rename
  const handleRenameConversation = async (id: string) => {
    const conversation = conversations.find(item => item.id === id);

    if (!conversation) {
      return;
    }
    setRenameId(id);
    setRenameText(conversation.title);
  };
  // save rename conversation
  const saveRenameConversation = async () => {
    if (!renameId) {
      return;
    }

    const title = renameText.trim();

    if (!title) {
      Alert.alert('Invalid title', 'Title cannot be empty.');
      return;
    }

    try {
      await renameConversation(renameId, title);

      setConversations(previous =>
        previous.map(item =>
          item.id === renameId
            ? {
                ...item,
                title,
              }
            : item,
        ),
      );

      setRenameId(null);
      setRenameText('');
    } catch (error) {
      console.error('Failed to rename conversation:', error);

      Alert.alert('Error', 'Failed to rename conversation.');
    }
  };
  const sendMessage = async () => {
    const text = message.trim();

    if (!text || sending || isGenerating) {
      return;
    }

    try {
      setSending(true);
      setIsGenerating(true);
      setMessage('');

      let activeConversationId = conversationId;

      if (!activeConversationId) {
        const newConv = await createConversation(generateChatTitle(text));
        activeConversationId = newConv.id;
        activeConversationIdRef.current = activeConversationId;
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
      setIsGenerating(false);
    }
  };

  // stop message generation
  const stopGeneration = async () => {
    const targetId = activeConversationIdRef.current || conversationId;
    if (!targetId) {
      return;
    }

    try {
      await stopMessageGeneration(targetId);
    } catch (error) {
      console.error('Failed to stop generation:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  //save edited message
  const saveEditedMessage = async () => {
    if (!conversationId || !editingMessageId) {
      return;
    }

    const content = editingText.trim();

    if (!content) {
      return;
    }

    const editedId = editingMessageId;

    try {
      setIsGenerating(true);

      // Update the user message locally
      // and remove everything after it.
      setMessages(previous => {
        const index = previous.findIndex(item => item.id === editedId);

        if (index === -1) {
          return previous;
        }

        return [
          ...previous.slice(0, index),
          {
            ...previous[index],
            content,
          },
        ];
      });

      setEditingMessageId(null);
      setEditingText('');

      // Create temporary assistant message
      const assistantId = `assistant-${Date.now()}`;

      setMessages(previous => [
        ...previous,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
        },
      ]);

      await editAndResendMessage(conversationId, editedId, content, chunk => {
        setMessages(previous =>
          previous.map(item =>
            item.id === assistantId
              ? {
                  ...item,
                  content: item.content + chunk,
                }
              : item,
          ),
        );
      });
    } catch (error) {
      console.error('Edit and resend error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // generate title for chat using AI
  const generateChatTitle = (text: string) => {
    const cleaned = text.replace(/\s+/g, ' ').trim();

    if (!cleaned) {
      return 'New chat';
    }

    if (cleaned.length <= 40) {
      return cleaned;
    }

    return `${cleaned.slice(0, 40)}...`;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === 'user';
    const isEditing = editingMessageId === item.id;

    if (isEditing) {
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
              styles.userBubble,
              { width: '100%', maxWidth: 600, padding: 12 },
            ]}
          >
            <TextInput
              value={editingText}
              onChangeText={setEditingText}
              multiline
              autoFocus
              style={[
                styles.messageText,
                styles.userText,
                {
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#d1d1d1',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                  minHeight: 60,
                },
              ]}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <Pressable
                onPress={cancelEditing}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: '#e5e5e5',
                }}
              >
                <Text
                  style={{ color: '#333', fontSize: 13, fontWeight: '500' }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={saveEditedMessage}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: '#10a37f',
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}
                >
                  Save & Submit
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

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
          {item.role === 'user' && (
            <Pressable
              onPress={() => startEditingMessage(item.id, item.content)}
              style={{
                padding: 6,
              }}
            >
              <Text>✏️</Text>
            </Pressable>
          )}
          {item.role === 'assistant' &&
            index === messages.length - 1 &&
            !isGenerating && (
              <Pressable
                onPress={regenerateResponse}
                style={{
                  padding: 8,
                  alignSelf: 'flex-start',
                }}
              >
                <Text>🔄 Regenerate</Text>
              </Pressable>
            )}
        </View>
      </View>
    );
  };
  // regenerate response
  const regenerateResponse = async () => {
    if (!conversationId || isGenerating) {
      return;
    }

    try {
      setIsGenerating(true);

      const assistantId = `${Date.now()}-regenerated`;

      setMessages(previous => {
        const lastAssistantIndex = [...previous]
          .map((item, index) => ({
            item,
            index,
          }))
          .reverse()
          .find(({ item }) => item.role === 'assistant')?.index;

        if (lastAssistantIndex === undefined) {
          return previous;
        }

        return previous.map((item, index) =>
          index === lastAssistantIndex
            ? {
                ...item,
                id: assistantId,
                content: '',
              }
            : item,
        );
      });

      await regenerateMessage(conversationId, chunk => {
        setMessages(previous =>
          previous.map(item =>
            item.id === assistantId
              ? {
                  ...item,
                  content: item.content + chunk,
                }
              : item,
          ),
        );
      });
    } catch (error) {
      console.error('Regenerate error:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  //delete conversation
  const confirmDeleteConversation = (id: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to delete this conversation?',
      );
      if (confirmed) {
        handleDeleteConversation(id);
      }
    } else {
      Alert.alert(
        'Delete conversation',
        'Are you sure you want to delete this conversation?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              handleDeleteConversation(id);
            },
          },
        ],
      );
    }
  };

  //start editing message
  const startEditingMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingText(content);
  };
  //cancel editing message
  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingText('');
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
              {/* Rename button */}
              <Pressable
                style={styles.renameButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  handleRenameConversation(conv.id);
                }}
              >
                <Text style={styles.renameText}>✎</Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  confirmDeleteConversation(conv.id);
                }}
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
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right', 'bottom']}
    >
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
                  !isGenerating &&
                    (!message.trim() || sending) &&
                    styles.sendButtonDisabled,
                ]}
                onPress={isGenerating ? stopGeneration : sendMessage}
                disabled={!isGenerating && (!message.trim() || sending)}
              >
                <Text
                  style={[styles.sendText, isGenerating && { fontSize: 14 }]}
                >
                  {isGenerating ? '■' : '↑'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.disclaimer}>
              ChatGPT can make mistakes. Check important information.
            </Text>
          </View>
          <Modal
            visible={renameId !== null}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setRenameId(null);
              setRenameText('');
            }}
          >
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: 20,
              }}
            >
              <View
                style={{
                  width: '100%',
                  maxWidth: 420,
                  backgroundColor: '#202123',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: '600',
                    marginBottom: 16,
                  }}
                >
                  Rename conversation
                </Text>

                <TextInput
                  value={renameText}
                  onChangeText={setRenameText}
                  autoFocus
                  maxLength={100}
                  placeholder="Conversation title"
                  placeholderTextColor="#888"
                  style={{
                    color: '#fff',
                    borderWidth: 1,
                    borderColor: '#555',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }}
                />

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setRenameId(null);
                      setRenameText('');
                    }}
                    style={{
                      padding: 12,
                      marginRight: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: '#ccc',
                      }}
                    >
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={saveRenameConversation}
                    style={{
                      backgroundColor: '#10a37f',
                      paddingVertical: 12,
                      paddingHorizontal: 18,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: '#fff',
                        fontWeight: '600',
                      }}
                    >
                      Save
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
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
  renameButton: {
    padding: 4,
    marginRight: 4,
  },
  renameText: {
    fontSize: 12,
    color: '#666',
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
