import { api } from '../lib/axios';
import type { Message } from '../types';

export async function listMessages(boardId: string, limit = 100) {
  const { data } = await api.get<{ messages: Message[] }>(
    `/boards/${boardId}/messages`,
    { params: { limit } },
  );
  return data.messages;
}

export async function sendMessage(boardId: string, content: string) {
  const { data } = await api.post<{ message: Message }>(`/boards/${boardId}/messages`, {
    content,
  });
  return data.message;
}
