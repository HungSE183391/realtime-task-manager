import { api } from '../lib/axios';
import type { AuthResponse, User } from '../types';

export async function register(email: string, password: string, name: string) {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password, name });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get<{ user: User }>('/me');
  return data.user;
}
