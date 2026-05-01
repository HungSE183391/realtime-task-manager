import { api } from '../lib/axios';
import type { DirectMessage, DMConversation } from '../types';

export async function listConversations() {
  const { data } = await api.get<{ conversations: DMConversation[] }>(
    '/dm/conversations',
  );
  return data.conversations;
}

export async function listMessagesWith(userId: string, limit = 100) {
  const { data } = await api.get<{ messages: DirectMessage[] }>(
    `/dm/with/${userId}`,
    { params: { limit } },
  );
  return data.messages;
}

export async function sendDM(userId: string, content: string) {
  const { data } = await api.post<{ message: DirectMessage }>(
    `/dm/with/${userId}`,
    { content },
  );
  return data.message;
}
