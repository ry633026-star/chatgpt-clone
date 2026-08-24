import { Platform } from 'react-native';

import { getToken } from '../storage/tokenStorage';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
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
  const token = await getToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_URL}/api/chat/conversations`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load conversations');
  }

  return response.json();
}

export async function getMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const token = await getToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${API_URL}/api/chat/conversations/${conversationId}/messages`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to load messages');
  }

  return response.json();
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

// streaming response
export async function streamMessage(
  conversationId: string,
  content: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const token = await getToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${API_URL}/api/chat/conversations/${conversationId}/messages/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
      }),
    },
  );

  if (!response.ok) {
    const data = await response.json();

    throw new Error(data?.detail || 'Failed to stream message');
  }

  if (!response.body) {
    throw new Error('Streaming is not supported by this client');
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, {
      stream: true,
    });

    if (chunk) {
      onChunk(chunk);
    }
  }
}
