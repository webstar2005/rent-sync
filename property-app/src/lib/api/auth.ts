import { api } from './client';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
};

export async function login(email: string, password: string) {
  const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { email, password });
  localStorage.setItem('property_app_token', result.token);
  localStorage.setItem('property_app_user', JSON.stringify(result.user));
  return result;
}

export async function register(payload: { name: string; email: string; password: string; role?: string }) {
  const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/register', payload);
  localStorage.setItem('property_app_token', result.token);
  localStorage.setItem('property_app_user', JSON.stringify(result.user));
  return result;
}

export async function googleLogin(credential: string) {
  const result = await api.post<{ token: string; user: AuthUser }>('/api/auth/google', { credential });
  localStorage.setItem('property_app_token', result.token);
  localStorage.setItem('property_app_user', JSON.stringify(result.user));
  return result;
}

export function logout() {
  localStorage.removeItem('property_app_token');
  localStorage.removeItem('property_app_user');
}
