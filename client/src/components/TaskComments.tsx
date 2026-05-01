import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  createComment,
  deleteComment,
  listComments,
} from '../api/comments';
import { useAuthStore } from '../store/authStore';
import type { Comment } from '../types';

interface Props {
  taskId: string;
}

export default function TaskComments({ taskId }: Props) {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => listComments(taskId),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => createComment(taskId, content),
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Failed to add comment'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onMutate: async (id) => {
      const prev = qc.getQueryData<Comment[]>(['comments', taskId]);
      qc.setQueryData<Comment[]>(['comments', taskId], (old) =>
        old ? old.filter((c) => c.id !== id) : old,
      );
      return { prev };
    },
    onError: (err: any, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['comments', taskId], ctx.prev);
      toast.error(err?.response?.data?.error || 'Failed to delete comment');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    sendMutation.mutate(v);
    setDraft('');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Comments {comments.length > 0 && (
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({comments.length})
            </span>
          )}
        </h3>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {isLoading && (
          <p className="text-center text-xs text-slate-500">Loading comments...</p>
        )}
        {!isLoading && comments.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
            No comments yet. Be the first to comment.
          </p>
        )}
        <AnimatePresence initial={false}>
          {comments.map((c) => {
            const isMe = c.userId === me?.id;
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="flex items-start gap-2.5"
              >
                <span className="bg-gradient-brand inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white">
                  {c.user.name.charAt(0).toUpperCase()}
                </span>
                <div
                  className={clsx(
                    'group min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2',
                    isMe && 'border-brand-400/30 bg-brand-500/10',
                  )}
                >
                  <div className="mb-0.5 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">
                      {isMe ? 'You' : c.user.name}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">
                      {formatTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-200">
                    {c.content}
                  </p>
                  {isMe && (
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(c.id)}
                        className="text-[10px] font-medium text-red-400 opacity-0 transition group-hover:opacity-100 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as unknown as FormEvent);
            }
          }}
          rows={1}
          placeholder="Write a comment... (Enter to send)"
          className="input min-h-[40px] resize-none"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMutation.isPending}
          className="btn-primary shrink-0"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M3.105 3.105a.75.75 0 01.815-.165l13.5 5.625a.75.75 0 010 1.4l-13.5 5.625a.75.75 0 01-1.005-.854l1.31-5.241L10 10 4.225 9.005l-1.31-5.241a.75.75 0 01.19-.659z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
