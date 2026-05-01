import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { listConversations, listMessagesWith, sendDM } from '../api/dm';
import { useAuthStore } from '../store/authStore';
import type { DirectMessage, DMConversation, User } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * If provided, the hub auto-selects (and auto-creates) a conversation with this user.
   * Used when launching DM from a member list.
   */
  initialUser?: User | null;
}

export default function DMHub({ open, onClose, initialUser }: Props) {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeUser, setActiveUser] = useState<User | null>(null);

  const { data: conversations = [], isLoading: convLoading } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: listConversations,
    enabled: open,
  });

  // When the panel opens with an initialUser, switch to that conversation.
  useEffect(() => {
    if (!open) return;
    if (initialUser) {
      setActiveUser(initialUser);
    } else if (!activeUser && conversations[0]) {
      setActiveUser(conversations[0].otherUser);
    }
  }, [open, initialUser, conversations, activeUser]);

  // Sorted conversation list — also include initialUser if no conversation exists yet.
  const items: DMConversation[] = useMemo(() => {
    const list = [...conversations];
    if (initialUser && !list.some((c) => c.otherUser.id === initialUser.id)) {
      list.unshift({
        otherUser: initialUser,
        latestMessage: null as unknown as DirectMessage,
        unreadCount: 0,
      });
    }
    return list;
  }, [conversations, initialUser]);

  function handleSelect(u: User) {
    setActiveUser(u);
    // Optimistically clear unread count for that conversation in the cache.
    queryClient.setQueryData<DMConversation[]>(['dm-conversations'], (old) =>
      old
        ? old.map((c) =>
            c.otherUser.id === u.id ? { ...c, unreadCount: 0 } : c,
          )
        : old,
    );
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
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl border-l border-white/10 bg-slate-950/85 shadow-2xl shadow-black/60 backdrop-blur-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
        {/* Sidebar */}
        <div className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-slate-950/60">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
                Direct
              </p>
              <h2 className="text-lg font-bold tracking-tight text-white">Messages</h2>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto py-2">
            {convLoading && (
              <p className="px-5 py-4 text-center text-sm text-slate-500">Loading...</p>
            )}
            {!convLoading && items.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-slate-400">No conversations yet.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Start one from a board's members list.
                </p>
              </div>
            )}
            {items.map((c, idx) => {
              const active = activeUser?.id === c.otherUser.id;
              const last = c.latestMessage;
              const lastIsMe = last && me ? last.fromUserId === me.id : false;
              return (
                <motion.button
                  key={c.otherUser.id}
                  onClick={() => handleSelect(c.otherUser)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                  whileHover={{ x: 2 }}
                  className={clsx(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5',
                    active && 'bg-white/10',
                  )}
                >
                  <span className="bg-gradient-brand inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                    {c.otherUser.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {c.otherUser.name}
                      </p>
                      {last && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">
                          {formatTimeShort(last.createdAt)}
                        </span>
                      )}
                    </div>
                    <p
                      className={clsx(
                        'mt-0.5 truncate text-xs',
                        c.unreadCount > 0 && !active
                          ? 'font-semibold text-slate-100'
                          : 'text-slate-400',
                      )}
                    >
                      {last
                        ? `${lastIsMe ? 'You: ' : ''}${last.content}`
                        : 'Say hi'}
                    </p>
                  </div>
                  {c.unreadCount > 0 && !active && (
                    <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Conversation pane */}
        <div className="flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            {activeUser ? (
              <motion.div
                key={activeUser.id}
                className="flex flex-1 flex-col"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                <ConversationPane otherUser={activeUser} onClose={onClose} />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                className="flex flex-1 items-center justify-center px-8 text-center text-slate-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div>
                  <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-slate-400">
                      <path
                        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-300">Select a conversation</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Or message a board member to start one.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ConversationPane({
  otherUser,
  onClose: _onClose,
}: {
  otherUser: User;
  onClose: () => void;
}) {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dm', otherUser.id],
    queryFn: () => listMessagesWith(otherUser.id),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendDM(otherUser.id, content),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to send'),
  });

  // When opening this conversation, locally clear unread count.
  useEffect(() => {
    queryClient.setQueryData<DMConversation[]>(['dm-conversations'], (old) =>
      old
        ? old.map((c) =>
            c.otherUser.id === otherUser.id ? { ...c, unreadCount: 0 } : c,
          )
        : old,
    );
  }, [otherUser.id, queryClient]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    sendMutation.mutate(v);
    setDraft('');
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <span className="bg-gradient-brand inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white">
          {otherUser.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{otherUser.name}</p>
          <p className="truncate text-xs text-slate-400">{otherUser.email}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {isLoading && <p className="text-center text-sm text-slate-500">Loading...</p>}
        {!isLoading && messages.length === 0 && (
          <div className="mt-12 text-center">
            <p className="text-sm text-slate-400">No messages yet.</p>
            <p className="mt-1 text-xs text-slate-500">Send the first message.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const groupedWithPrev =
              prev &&
              prev.fromUserId === m.fromUserId &&
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                5 * 60_000;
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <DMItem
                  message={m}
                  isMe={m.fromUserId === me?.id}
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
          placeholder={`Message ${otherUser.name}...`}
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
    </>
  );
}

function DMItem({
  message,
  isMe,
  grouped,
}: {
  message: DirectMessage;
  isMe: boolean;
  grouped: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const sender = isMe ? message.fromUser : message.fromUser;
  return (
    <div
      className={clsx('flex gap-2.5', isMe ? 'justify-end' : 'justify-start', grouped && '-mt-2')}
    >
      {!isMe && (
        <div className="w-8 shrink-0">
          {!grouped && (
            <span className="bg-gradient-brand inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
              {sender.name.charAt(0).toUpperCase()}
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
              {isMe ? 'You' : sender.name}
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
        {isMe && message.readAt && (
          <p className="mt-1 text-right text-[10px] text-slate-500">Seen</p>
        )}
      </div>
    </div>
  );
}

function formatTimeShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
