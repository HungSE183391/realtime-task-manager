import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { createComment, deleteComment, listComments } from '../api/comments';
import { useAuthStore } from '../store/authStore';
import type { Comment } from '../types';

export default function TaskComments({ taskId }: { taskId: string }) {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => listComments(taskId),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => createComment(taskId, content),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to add comment'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onMutate: async (id) => {
      const prev = qc.getQueryData<Comment[]>(['comments', taskId]);
      qc.setQueryData<Comment[]>(['comments', taskId], (old) => old ? old.filter((c) => c.id !== id) : old);
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
    <div className="flex flex-col space-y-3">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-slate-500">
          <path d="M14 3v8a1.5 1.5 0 01-1.5 1.5H4.5L2 15V3A1.5 1.5 0 013.5 1.5h9A1.5 1.5 0 0114 3z" />
        </svg>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          Comments
          {comments.length > 0 && (
            <span className="ml-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-normal text-slate-500 normal-case tracking-normal">
              {comments.length}
            </span>
          )}
        </h3>
      </div>

      {/* Comments list */}
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
          </div>
        )}
        {!isLoading && comments.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-center">
            <p className="text-[12px] text-slate-600">No comments yet.</p>
          </div>
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
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="flex items-start gap-2.5"
              >
                <span className="avatar h-6 w-6 shrink-0 text-[10px]">
                  {c.user.name.charAt(0).toUpperCase()}
                </span>
                <div className={clsx(
                  'group min-w-0 flex-1 rounded-xl border px-3 py-2 transition-colors',
                  isMe
                    ? 'border-violet-400/20 bg-violet-500/[0.07]'
                    : 'border-white/[0.07] bg-white/[0.03]',
                )}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-semibold text-slate-300">
                      {isMe ? 'You' : c.user.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600">{formatTime(c.createdAt)}</span>
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(c.id)}
                          className="text-[10px] text-red-500/0 transition-all group-hover:text-red-400/60 hover:!text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[13px] text-slate-300">{c.content}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Comment composer */}
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex flex-1 items-end rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 focus-within:border-violet-400/40 focus-within:bg-white/[0.06] transition-all duration-150">
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
            placeholder="Add a comment…"
            className="flex-1 resize-none bg-transparent text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
            maxLength={4000}
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || sendMutation.isPending}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M1.5 1.5l13 5.5-13 5.5V9.5l9-2-9-2V1.5z" />
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
