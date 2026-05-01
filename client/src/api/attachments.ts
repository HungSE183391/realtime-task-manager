import { api } from '../lib/axios';
import type { Attachment } from '../types';

export async function listAttachments(taskId: string) {
  const { data } = await api.get<{ attachments: Attachment[] }>(
    `/tasks/${taskId}/attachments`,
  );
  return data.attachments;
}

export async function uploadAttachment(taskId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post<{ attachment: Attachment }>(
    `/tasks/${taskId}/attachments`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachment;
}

export async function deleteAttachment(attachmentId: string) {
  await api.delete(`/tasks/attachments/${attachmentId}`);
}

export async function downloadAttachment(att: Attachment) {
  const { data } = await api.get<Blob>(`/tasks/attachments/${att.id}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = att.originalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchAttachmentObjectUrl(att: Attachment): Promise<string> {
  const { data } = await api.get<Blob>(`/tasks/attachments/${att.id}/download`, {
    params: { inline: 1 },
    responseType: 'blob',
  });
  return URL.createObjectURL(data);
}
