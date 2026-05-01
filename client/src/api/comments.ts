import { api } from '../lib/axios';
import type { Comment } from '../types';

export async function listComments(taskId: string) {
  const { data } = await api.get<{ comments: Comment[] }>(`/tasks/${taskId}/comments`);
  return data.comments;
}

export async function createComment(taskId: string, content: string) {
  const { data } = await api.post<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
    content,
  });
  return data.comment;
}

export async function deleteComment(commentId: string) {
  await api.delete(`/tasks/comments/${commentId}`);
}
