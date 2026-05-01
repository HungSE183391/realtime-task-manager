import { api } from '../lib/axios';
import type { BoardDetail, BoardMember, BoardSummary, Role } from '../types';

export async function listBoards() {
  const { data } = await api.get<{ boards: BoardSummary[] }>('/boards');
  return data.boards;
}

export async function createBoard(title: string) {
  const { data } = await api.post<{ board: BoardSummary }>('/boards', { title });
  return data.board;
}

export async function getBoard(id: string) {
  const { data } = await api.get<{ board: BoardDetail; role: Role }>(`/boards/${id}`);
  return data;
}

export async function updateBoard(id: string, title: string) {
  const { data } = await api.patch<{ board: BoardSummary }>(`/boards/${id}`, { title });
  return data.board;
}

export async function deleteBoard(id: string) {
  await api.delete(`/boards/${id}`);
}

export async function inviteMember(boardId: string, email: string) {
  const { data } = await api.post<{ member: BoardMember }>(`/boards/${boardId}/members`, { email });
  return data.member;
}

export async function removeMember(boardId: string, userId: string) {
  await api.delete(`/boards/${boardId}/members/${userId}`);
}

export async function createColumn(boardId: string, title: string) {
  const { data } = await api.post(`/boards/${boardId}/columns`, { title });
  return data.column;
}
