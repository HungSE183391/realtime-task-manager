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

interface Props {
  taskId: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function TaskAttachments({ taskId }: Props) {
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
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onMutate: async (id) => {
      const prev = qc.getQueryData<Attachment[]>(['attachments', taskId]);
      qc.setQueryData<Attachment[]>(['attachments', taskId], (old) =>
        old ? old.filter((a) => a.id !== id) : old,
      );
      return { prev };
    },
    onError: (err: any, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['attachments', taskId], ctx.prev);
      toast.error(err?.response?.data?.error || 'Failed to delete file');
    },
  });

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large (max 10 MB)');
      return;
    }
    uploadMutation.mutate(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    e.target.value = '';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Attachments {attachments.length > 0 && (
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({attachments.length})
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="btn-ghost text-xs"
        >
          {uploadMutation.isPending ? 'Uploading...' : '+ Add file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={onChange}
        />
      </div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        animate={{
          borderColor: dragActive ? 'rgba(139, 92, 246, 0.6)' : 'rgba(255, 255, 255, 0.1)',
          backgroundColor: dragActive ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
        }}
        transition={{ duration: 0.15 }}
        className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-slate-400"
      >
        {dragActive
          ? 'Drop file here to upload'
          : 'Drag & drop a file here, or click "+ Add file" (max 10 MB)'}
      </motion.div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {isLoading && (
          <p className="text-center text-xs text-slate-500">Loading attachments...</p>
        )}
        <AnimatePresence initial={false}>
          {attachments.map((a) => {
            const canDelete = a.userId === me?.id;
            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <AttachmentRow
                  attachment={a}
                  canDelete={canDelete}
                  onDelete={() => deleteMutation.mutate(a.id)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AttachmentRow({
  attachment: a,
  canDelete,
  onDelete,
}: {
  attachment: Attachment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const isImage = a.mimeType.startsWith('image/');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let revoke: string | null = null;
    let cancelled = false;
    fetchAttachmentObjectUrl(a)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoke = url;
        setPreviewUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [a.id, isImage]);

  return (
    <div
      className={clsx(
        'group flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-2.5 transition hover:border-brand-400/30 hover:bg-white/5',
      )}
    >
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-brand text-white">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={a.originalName}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileIcon mime={a.mimeType} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold text-slate-100"
          title={a.originalName}
        >
          {a.originalName}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {formatBytes(a.size)} · {a.user.name} · {new Date(a.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <motion.button
          type="button"
          onClick={() => downloadAttachment(a)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-brand-300"
          title="Download"
          aria-label="Download"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10 2a1 1 0 011 1v8.59l2.3-2.3a1 1 0 011.4 1.42l-4 4a1 1 0 01-1.4 0l-4-4A1 1 0 016.7 9.3l2.3 2.3V3a1 1 0 011-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
        </motion.button>
        {canDelete && (
          <motion.button
            type="button"
            onClick={onDelete}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400"
            title="Delete"
            aria-label="Delete"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
            </svg>
          </motion.button>
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
  return <span className="text-[10px] font-bold tracking-wider">{label}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
