import { api } from '../lib/axios';
import type {
  AdminBoard,
  AdminStats,
  AdminUser,
  UserRole,
} from '../types';

export async function fetchAdminStats() {
  const { data } = await api.get<{ stats: AdminStats }>('/admin/stats');
  return data.stats;
}

export async function listAdminUsers(q?: string) {
  const { data } = await api.get<{
    users: AdminUser[];
    totals: { users: number; admins: number };
  }>('/admin/users', { params: q ? { q } : {} });
  return data;
}

export async function updateUserRole(userId: string, role: UserRole) {
  const { data } = await api.patch<{ user: AdminUser }>(`/admin/users/${userId}/role`, {
    role,
  });
  return data.user;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
}

export async function updateUser(userId: string, payload: UpdateUserPayload) {
  const { data } = await api.patch<{ user: AdminUser }>(`/admin/users/${userId}`, payload);
  return data.user;
}

export async function deleteUser(userId: string) {
  await api.delete(`/admin/users/${userId}`);
}

export async function listAdminBoards() {
  const { data } = await api.get<{ boards: AdminBoard[] }>('/admin/boards');
  return data.boards;
}

export async function deleteAdminBoard(boardId: string) {
  await api.delete(`/admin/boards/${boardId}`);
}
