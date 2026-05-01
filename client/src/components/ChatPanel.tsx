import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { listMessages, sendMessage } from '../api/messages';
import { useAuthStore } from '../store/authStore';
import type { Message } from '../types';

interface Props {
  boardId: string;
  open: boolean;
  onClose: () => void;
}

export default function ChatPanel({ boardId, open, onClose }: Props) {
  const me = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', boardId],
    queryFn: () => listMessages(boardId),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(boardId, content),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to send'),
  });

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    sendMutation.mutate(v);
    setDraft('');
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-slate-950/85 shadow-2xl shadow-black/60 backdrop-blur-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
              Board chat
            </p>
            <h2 className="text-lg font-bold tracking-tight text-white">Messages</h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close chat"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
          {isLoading && <p className="text-center text-sm text-slate-500">Loading...</p>}
          {!isLoading && messages.length === 0 && (
            <div className="mt-12 text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-slate-400">
                  <path
                    d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-400">No messages yet.</p>
              <p className="mt-1 text-xs text-slate-500">Be the first to say hi.</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const groupedWithPrev =
                prev &&
                prev.userId === m.userId &&
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                >
                  <MessageItem
                    message={m}
                    isMe={m.userId === me?.id}
                    grouped={!!groupedWithPrev}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 border-t border-white/10 bg-slate-950/60 p-3"
        >
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
            placeholder="Write a message... (Enter to send, Shift+Enter for newline)"
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MessageItem({
  message,
  isMe,
  grouped,
}: {
  message: Message;
  isMe: boolean;
  grouped: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={clsx('flex gap-2.5', isMe ? 'justify-end' : 'justify-start', grouped && '-mt-2')}>
      {!isMe && (
        <div className="w-8 shrink-0">
          {!grouped && (
            <span className="bg-gradient-brand inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
              {message.user.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}
      <div className={clsx('max-w-[78%]', isMe && 'items-end')}>
        {!grouped && (
          <div
            className={clsx(
              'mb-1 flex items-baseline gap-2 text-xs',
              isMe ? 'justify-end' : 'justify-start',
            )}
          >
            <span className="font-semibold text-slate-200">
              {isMe ? 'You' : message.user.name}
            </span>
            <span className="text-slate-500">{time}</span>
          </div>
        )}
        <div
          className={clsx(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isMe
              ? 'rounded-tr-sm bg-gradient-brand text-white shadow-md shadow-brand-900/30'
              : 'rounded-tl-sm border border-white/10 bg-white/5 text-slate-100',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
