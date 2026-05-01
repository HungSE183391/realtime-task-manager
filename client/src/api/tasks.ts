import { api } from '../lib/axios';
import type { Task } from '../types';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assignedToId?: string | null;
  dueDate?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  completed?: boolean;
  assignedToId?: string | null;
  dueDate?: string | null;
  columnId?: string;
  beforeId?: string | null;
  afterId?: string | null;
}

export async function createTask(columnId: string, payload: CreateTaskPayload) {
  const { data } = await api.post<{ task: Task }>(`/columns/${columnId}/tasks`, payload);
  return data.task;
}

export async function updateTask(id: string, payload: UpdateTaskPayload) {
  const { data } = await api.patch<{ task: Task }>(`/tasks/${id}`, payload);
  return data.task;
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`);
}
