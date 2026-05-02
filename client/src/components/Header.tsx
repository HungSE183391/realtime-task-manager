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

  useDMSocket();

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
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#080c14]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4 px-5 py-2.5">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
            aria-label="Realtime Task Manager"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 shadow-sm ring-1 ring-white/10">
              <img src="/logo.png" alt="RTM" className="h-6 w-auto" />
            </div>
            <span className="hidden text-[13px] font-semibold tracking-tight text-slate-200 sm:block">
              TaskFlow
            </span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="badge-admin mr-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition hover:bg-rose-500/20"
                title="Admin console"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M8 1l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.4l-3.6 1.6.7-4-2.9-2.8 4-.6L8 1z" />
                </svg>
                Admin
              </Link>
            )}

            {user && (
              <>
                {/* DM button */}
                <motion.button
                  type="button"
                  onClick={open}
                  className="btn-icon relative"
                  aria-label="Direct messages"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                    <path
                      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                      stroke="currentColor"
                      strokeWidth="1.6"
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
                        className="absolute -right-0.5 -top-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-violet-500 px-0.5 text-[9px] font-bold text-white ring-1 ring-[#080c14]"
                      >
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* User info */}
                <div className="mx-1 hidden items-center gap-2 sm:flex">
                  <div className="avatar h-7 w-7 text-[11px]">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[13px] font-medium text-slate-200">{user.name}</span>
                    <span className="text-[11px] text-slate-500">{user.email}</span>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleLogout}
              className="btn-ghost ml-1 text-[13px] text-slate-400"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {user && <DMHub open={isOpen} onClose={close} initialUser={initialUser} />}
    </>
  );
}
