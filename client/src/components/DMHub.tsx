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

  useEffect(() => {
    if (!open) return;
    if (initialUser) {
      setActiveUser(initialUser);
    } else if (!activeUser && conversations[0]) {
      setActiveUser(conversations[0].otherUser);
    }
  }, [open, initialUser, conversations]);

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
    queryClient.setQueryData<DMConversation[]>(['dm-conversations'], (old) =>
      old ? old.map((c) => c.otherUser.id === u.id ? { ...c, unreadCount: 0 } : c) : old,
    );
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
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] border-l border-white/[0.07] bg-[#080c14]/95 shadow-panel backdrop-blur-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            {/* Sidebar */}
            <div className="flex w-64 shrink-0 flex-col border-r border-white/[0.07]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-white">Messages</h2>
                  <p className="text-[11px] text-slate-500">Direct messages</p>
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

              <div className="flex-1 overflow-y-auto py-1">
                {convLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                  </div>
                )}
                {!convLoading && items.length === 0 && (
                  <div className="px-4 py-10 text-center">
                    <p className="text-[13px] text-slate-500">No conversations yet.</p>
                    <p className="mt-1 text-[11px] text-slate-600">Open a board member to message them.</p>
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
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.18 }}
                      className={clsx(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all duration-100',
                        active
                          ? 'bg-white/[0.07]'
                          : 'hover:bg-white/[0.04]',
                      )}
                    >
                      {/* Avatar with online indicator */}
                      <div className="relative shrink-0">
                        <span className="avatar h-9 w-9 text-[13px]">
                          {c.otherUser.name.charAt(0).toUpperCase()}
                        </span>
                        {c.unreadCount > 0 && !active && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-bold text-white ring-1 ring-[#080c14]">
                            {c.unreadCount > 9 ? '9+' : c.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className={clsx(
                            'truncate text-[13px]',
                            c.unreadCount > 0 && !active ? 'font-semibold text-white' : 'font-medium text-slate-300',
                          )}>
                            {c.otherUser.name}
                          </p>
                          {last && (
                            <span className="shrink-0 text-[10px] text-slate-600">
                              {formatTimeShort(last.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className={clsx(
                          'mt-0.5 truncate text-[11px]',
                          c.unreadCount > 0 && !active ? 'text-slate-400' : 'text-slate-600',
                        )}>
                          {last ? `${lastIsMe ? 'You: ' : ''}${last.content}` : 'Start a conversation'}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Conversation pane */}
            <div className="flex flex-1 flex-col min-w-0">
              <AnimatePresence mode="wait">
                {activeUser ? (
                  <motion.div
                    key={activeUser.id}
                    className="flex flex-1 flex-col min-w-0"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.16 }}
                  >
                    <ConversationPane otherUser={activeUser} onClose={onClose} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="flex flex-1 flex-col items-center justify-center px-8 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.07]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-slate-500">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-[14px] font-medium text-slate-400">Select a conversation</p>
                    <p className="mt-1 text-[12px] text-slate-600">Or message a board member to start one.</p>
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

function ConversationPane({ otherUser, onClose: _onClose }: { otherUser: User; onClose: () => void }) {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dm', otherUser.id],
    queryFn: () => listMessagesWith(otherUser.id),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendDM(otherUser.id, content),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to send'),
  });

  useEffect(() => {
    queryClient.setQueryData<DMConversation[]>(['dm-conversations'], (old) =>
      old ? old.map((c) => c.otherUser.id === otherUser.id ? { ...c, unreadCount: 0 } : c) : old,
    );
  }, [otherUser.id, queryClient]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [otherUser.id]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    sendMutation.mutate(v);
    setDraft('');
  }

  return (
    <>
      {/* Conversation header */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4">
        <span className="avatar h-9 w-9 text-[13px]">
          {otherUser.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-white">{otherUser.name}</p>
          <p className="text-[11px] text-slate-500">{otherUser.email}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 px-5 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <span className="avatar mb-4 h-16 w-16 text-2xl">
              {otherUser.name.charAt(0).toUpperCase()}
            </span>
            <p className="text-[14px] font-semibold text-slate-300">{otherUser.name}</p>
            <p className="mt-1 text-[12px] text-slate-600">Send the first message to start your conversation.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = !!(
              prev &&
              prev.fromUserId === m.fromUserId &&
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
                <DMBubble message={m} isMe={m.fromUserId === me?.id} grouped={grouped} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-white/[0.07] bg-[#080c14]/80 p-4">
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
            placeholder={`Message ${otherUser.name}…`}
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
    </>
  );
}

function DMBubble({ message, isMe, grouped }: { message: DirectMessage; isMe: boolean; grouped: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sender = message.fromUser;

  return (
    <div className={clsx('flex gap-2.5', isMe ? 'flex-row-reverse' : 'flex-row', grouped ? 'mt-0.5' : 'mt-3')}>
      <div className="w-7 shrink-0 self-end">
        {!grouped && (
          <span className="avatar h-7 w-7 text-[11px]">
            {sender.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className={clsx('max-w-[80%] flex flex-col', isMe ? 'items-end' : 'items-start')}>
        {!grouped && (
          <div className={clsx('mb-1 flex items-baseline gap-1.5 text-[11px]', isMe ? 'flex-row-reverse' : 'flex-row')}>
            <span className="font-semibold text-slate-300">{isMe ? 'You' : sender.name}</span>
            <span className="text-slate-600">{time}</span>
          </div>
        )}
        <div className={clsx(
          'rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
          isMe
            ? 'rounded-br-sm bg-violet-600 text-white'
            : 'rounded-bl-sm border border-white/[0.08] bg-white/[0.05] text-slate-200',
        )}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {isMe && message.readAt && (
          <p className="mt-1 text-[10px] text-slate-600">Seen</p>
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
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTime(iso: string) {
  return formatTimeShort(iso);
}
