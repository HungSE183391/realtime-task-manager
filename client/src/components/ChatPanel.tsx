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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 150);
  }, [open]);

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
            className="fixed inset-0 z-40 bg-[#080c14]/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-white/[0.07] bg-[#080c14]/95 shadow-panel backdrop-blur-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-400/20">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-violet-400">
                    <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-white">Board chat</h2>
                  <p className="text-[11px] text-slate-500">{messages.length} messages</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="btn-icon h-7 w-7"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 px-4 py-4">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                </div>
              )}

              {!isLoading && messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.07]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-slate-500">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-slate-400">No messages yet</p>
                  <p className="mt-1 text-[12px] text-slate-600">Be the first to say hi to the team.</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const grouped = !!(
                    prev &&
                    prev.userId === m.userId &&
                    new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000
                  );
                  return (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    >
                      <MessageBubble message={m} isMe={m.userId === me?.id} grouped={grouped} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Composer */}
            <form
              onSubmit={onSubmit}
              className="border-t border-white/[0.07] bg-[#080c14]/80 p-3"
            >
              <div className="flex items-end gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 focus-within:border-violet-400/40 focus-within:bg-white/[0.06] transition-all duration-150">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit(e as unknown as FormEvent);
                    }
                  }}
                  rows={1}
                  placeholder="Message the team…"
                  className="flex-1 resize-none bg-transparent text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  maxLength={4000}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition-all duration-150 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M3.105 3.105a.75.75 0 01.815-.165l13.5 5.625a.75.75 0 010 1.4l-13.5 5.625a.75.75 0 01-1.005-.854l1.31-5.241L10 10 4.225 9.005l-1.31-5.241a.75.75 0 01.19-.659z" />
                  </svg>
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-slate-700">Enter to send · Shift+Enter for newline</p>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({
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
    <div className={clsx('flex gap-2.5', isMe ? 'flex-row-reverse' : 'flex-row', grouped ? 'mt-0.5' : 'mt-3')}>
      {/* Avatar */}
      <div className="w-7 shrink-0 self-end">
        {!grouped && (
          <span className="avatar h-7 w-7 text-[11px]">
            {message.user.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className={clsx('max-w-[82%]', isMe ? 'items-end' : 'items-start', 'flex flex-col')}>
        {!grouped && (
          <div className={clsx('mb-1 flex items-baseline gap-1.5 text-[11px]', isMe ? 'flex-row-reverse' : 'flex-row')}>
            <span className="font-semibold text-slate-300">
              {isMe ? 'You' : message.user.name}
            </span>
            <span className="text-slate-600">{time}</span>
          </div>
        )}
        <div
          className={clsx(
            'rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
            isMe
              ? 'rounded-br-sm bg-violet-600 text-white'
              : 'rounded-bl-sm border border-white/[0.08] bg-white/[0.05] text-slate-200',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
