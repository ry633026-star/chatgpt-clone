import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = '@chatgpt_access_token';

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}
