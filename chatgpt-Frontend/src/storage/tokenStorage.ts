let accessToken: string | null = null;

export async function saveToken(token: string): Promise<void> {
  accessToken = token;
}

export async function getToken(): Promise<string | null> {
  return accessToken;
}

export async function removeToken(): Promise<void> {
  accessToken = null;
}
