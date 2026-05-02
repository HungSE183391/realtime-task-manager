import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  deleteAttachment,
  downloadAttachment,
  fetchAttachmentObjectUrl,
  listAttachments,
  uploadAttachment,
} from '../api/attachments';
import { useAuthStore } from '../store/authStore';
import type { Attachment } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function TaskAttachments({ taskId }: { taskId: string }) {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments', taskId],
    queryFn: () => listAttachments(taskId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(taskId, file),
    onSuccess: () => toast.success('File uploaded'),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onMutate: async (id) => {
      const prev = qc.getQueryData<Attachment[]>(['attachments', taskId]);
      qc.setQueryData<Attachment[]>(['attachments', taskId], (old) => old ? old.filter((a) => a.id !== id) : old);
      return { prev };
    },
    onError: (err: any, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['attachments', taskId], ctx.prev);
      toast.error(err?.response?.data?.error || 'Failed to delete');
    },
  });

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_FILE_SIZE) { toast.error('File too large (max 10 MB)'); return; }
    uploadMutation.mutate(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-slate-500">
            <path d="M9.5 2a2.5 2.5 0 013.536 3.536L5.293 13.28a4 4 0 11-5.657-5.657L8.5 0.5" />
          </svg>
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
            Attachments
            {attachments.length > 0 && (
              <span className="ml-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-normal text-slate-500 normal-case tracking-normal">
                {attachments.length}
              </span>
            )}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="btn-ghost text-[11px] py-1 px-2"
        >
          {uploadMutation.isPending ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading…
            </span>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M8 1a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0V8.75H1.75a.75.75 0 010-1.5H7.25V1.75A.75.75 0 018 1z" />
              </svg>
              Add file
            </>
          )}
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { handleFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        animate={{
          borderColor: dragActive ? 'rgba(124, 58, 237, 0.5)' : 'rgba(255, 255, 255, 0.07)',
          backgroundColor: dragActive ? 'rgba(124, 58, 237, 0.06)' : 'rgba(255, 255, 255, 0.02)',
        }}
        transition={{ duration: 0.12 }}
        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
      >
        <svg viewBox="0 0 24 24" fill="none" className={clsx('h-6 w-6 transition-colors', dragActive ? 'text-violet-400' : 'text-slate-600')}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-[11px] text-slate-600">
          {dragActive ? 'Release to upload' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[10px] text-slate-700">Max 10 MB</p>
      </motion.div>

      {/* Attachments list */}
      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
          </div>
        )}
        <AnimatePresence initial={false}>
          {attachments.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <AttachmentRow
                attachment={a}
                canDelete={a.userId === me?.id}
                onDelete={() => deleteMutation.mutate(a.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AttachmentRow({ attachment: a, canDelete, onDelete }: { attachment: Attachment; canDelete: boolean; onDelete: () => void }) {
  const isImage = a.mimeType.startsWith('image/');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let revoke: string | null = null;
    let cancelled = false;
    fetchAttachmentObjectUrl(a).then((url) => {
      if (cancelled) { URL.revokeObjectURL(url); return; }
      revoke = url;
      setPreviewUrl(url);
    }).catch(() => undefined);
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [a.id, isImage]);

  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 transition-all hover:border-white/[0.12] hover:bg-white/[0.05]">
      {/* Thumbnail / icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-brand text-[10px] font-bold text-white">
        {previewUrl ? (
          <img src={previewUrl} alt={a.originalName} className="h-full w-full object-cover" />
        ) : (
          <FileIcon mime={a.mimeType} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-slate-200" title={a.originalName}>
          {a.originalName}
        </p>
        <p className="text-[10px] text-slate-600">
          {formatBytes(a.size)} · {a.user.name}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-all group-hover:opacity-100">
        <button
          type="button"
          onClick={() => downloadAttachment(a)}
          className="btn-icon h-7 w-7 text-slate-500 hover:text-violet-400"
          title="Download"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8 1a.75.75 0 01.75.75v7.19l1.97-1.97a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 8.03a.75.75 0 111.06-1.06l1.97 1.97V1.75A.75.75 0 018 1zM1.5 13.5a.75.75 0 000 1.5h13a.75.75 0 000-1.5h-13z" />
          </svg>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="btn-icon h-7 w-7 text-slate-500 hover:text-red-400"
            title="Delete"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M6.5 1.75a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3zM2 4.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H13l-.5 7.5A2 2 0 0110.5 14.5h-5A2 2 0 013.5 12.5L3 5H2.75A.75.75 0 012 4.25z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function FileIcon({ mime }: { mime: string }) {
  let label = 'FILE';
  if (mime.startsWith('image/')) label = 'IMG';
  else if (mime.startsWith('video/')) label = 'VID';
  else if (mime.startsWith('audio/')) label = 'AUD';
  else if (mime.includes('pdf')) label = 'PDF';
  else if (mime.includes('zip') || mime.includes('compressed')) label = 'ZIP';
  else if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) label = 'TXT';
  return <span className="text-[9px] font-bold tracking-wider">{label}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
