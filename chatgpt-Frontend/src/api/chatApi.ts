import { Platform } from 'react-native';

import { getToken } from '../storage/tokenStorage';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

const API_URL =
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://192.168.31.69:8000';

async function authorizedFetch(url: string, options: RequestInit = {}) {
  const token = await getToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createConversation(
  title = 'New chat',
): Promise<Conversation> {
  const response = await authorizedFetch(`${API_URL}/api/chat/conversations`, {
    method: 'POST',
    body: JSON.stringify({
      title,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || 'Failed to create conversation');
  }

  return data;
}

export async function getConversations(): Promise<Conversation[]> {
  const response = await authorizedFetch(`${API_URL}/api/chat/conversations`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || 'Failed to load conversations');
  }

  return data;
}

export async function getMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const response = await authorizedFetch(
    `${API_URL}/api/chat/conversations/${conversationId}/messages`,
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || 'Failed to load messages');
  }

  return data;
}

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<ChatMessage[]> {
  const response = await authorizedFetch(
    `${API_URL}/api/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        content,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || 'Failed to send message');
  }

  return data;
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const response = await authorizedFetch(
    `${API_URL}/api/chat/conversations/${conversationId}`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    const data = await response.json();

    throw new Error(data?.detail || 'Failed to delete conversation');
  }
}
