import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useDMHubStore } from '../store/dmHubStore';
import { disconnectSocket } from '../lib/socket';
import { useDMSocket } from '../hooks/useDMSocket';
import { listConversations } from '../api/dm';
import DMHub from './DMHub';

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isOpen, initialUser, open, close } = useDMHubStore();

  // Always listen for DMs while user is authenticated.
  useDMSocket();

  // Keep an unread badge fresh: this populates the cache used by the badge.
  const { data: conversations = [] } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: listConversations,
    enabled: !!user,
    staleTime: 30_000,
  });

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  function handleLogout() {
    disconnectSocket();
    logout();
    navigate('/login');
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-blue-400/10 bg-gradient-to-r from-[#070f2b] via-[#0c1a4a] to-[#070f2b] shadow-lg shadow-blue-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4 px-6 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 transition hover:opacity-90"
            aria-label="Realtime Task Manager"
          >
            <motion.img
              src="/logo.png"
              alt="Realtime Task Manager"
              className="h-10 w-auto rounded-md bg-white/95 px-1.5 py-0.5 shadow-md ring-1 ring-white/10"
              whileHover={{ rotate: -3, scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            />
          </Link>
          <div className="flex items-center gap-3">
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="hidden items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/20 sm:inline-flex"
                title="Admin console"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.4l-4.8 2.5.9-5.4L2.2 7.7l5.4-.8L10 2z" />
                </svg>
                Admin
              </Link>
            )}
            {user && (
              <>
                <motion.button
                  type="button"
                  onClick={open}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/5 hover:text-white"
                  aria-label="Direct messages"
                  title="Direct messages"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.92 }}
                  animate={unreadTotal > 0 ? { rotate: [0, -8, 8, -6, 6, 0] } : {}}
                  transition={{ duration: 0.6, repeat: unreadTotal > 0 ? Infinity : 0, repeatDelay: 4 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path
                      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <AnimatePresence>
                    {unreadTotal > 0 && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                        className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-slate-950"
                      >
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="bg-gradient-brand inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium text-slate-100">{user.name}</span>
                    <span className="text-xs text-slate-500">{user.email}</span>
                  </div>
                </div>
              </>
            )}
            <motion.button
              onClick={handleLogout}
              className="btn-secondary"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              Logout
            </motion.button>
          </div>
        </div>
      </header>

      {user && <DMHub open={isOpen} onClose={close} initialUser={initialUser} />}
    </>
  );
}
