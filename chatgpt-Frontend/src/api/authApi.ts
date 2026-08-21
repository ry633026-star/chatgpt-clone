import {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
} from '../types/auth';

const API_URL = 'http://10.0.2.2:8000';

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || 'Something went wrong');
  }

  return data;
}

export async function registerUser(data: RegisterRequest): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse<User>(response);
}

export async function loginUser(data: LoginRequest): Promise<TokenResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse<TokenResponse>(response);
}

export async function getCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<User>(response);
}
