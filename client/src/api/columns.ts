import { api } from '../lib/axios';
import type { Column } from '../types';

export interface UpdateColumnPayload {
  title?: string;
  beforeId?: string | null;
  afterId?: string | null;
}

export async function updateColumn(id: string, payload: UpdateColumnPayload) {
  const { data } = await api.patch<{ column: Column }>(`/columns/${id}`, payload);
  return data.column;
}

export async function deleteColumn(id: string) {
  await api.delete(`/columns/${id}`);
}
