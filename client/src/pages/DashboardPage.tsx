import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AddBoardModal from '../components/modals/AddBoardModal';
import { deleteBoard, listBoards } from '../api/boards';
import type { BoardSummary } from '../types';

export default function DashboardPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: boards, isLoading, error } = useQuery({
    queryKey: ['boards'],
    queryFn: listBoards,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBoard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Board deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to delete board');
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
              Workspace
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Your boards
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Plan, track, and collaborate in real time.
            </p>
          </div>
          <motion.button
            onClick={() => setOpen(true)}
            className="btn-primary"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="-ml-1 mr-1.5 h-4 w-4">
              <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
            </svg>
            New board
          </motion.button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-36 animate-pulse" />
            ))}
          </div>
        )}
        {error && (
          <div className="card p-6 text-center text-red-300">Failed to load boards.</div>
        )}

        {boards && boards.length === 0 && (
          <div className="card animate-fade-in p-12 text-center">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white">
                <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">No boards yet</h2>
            <p className="mt-1 text-sm text-slate-400">Create your first board to get started.</p>
            <button onClick={() => setOpen(true)} className="btn-primary mt-5">
              Create your first board
            </button>
          </div>
        )}

        {boards && boards.length > 0 && (
          <motion.ul
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
              hidden: {},
            }}
          >
            <AnimatePresence>
              {boards.map((b) => (
                <BoardCard
                  key={b.id}
                  board={b}
                  onDelete={() => {
                    if (confirm(`Delete board "${b.title}"? This cannot be undone.`)) {
                      deleteMutation.mutate(b.id);
                    }
                  }}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </main>

      <AddBoardModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function BoardCard({
  board,
  onDelete,
}: {
  board: BoardSummary;
  onDelete: () => void;
}) {
  const navigate = useNavigate();

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    navigate(`/boards/${board.id}`);
  }

  return (
    <motion.li
      layout
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.97 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
      className="card card-hover group relative cursor-pointer overflow-hidden p-5"
      onClick={handleCardClick}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent opacity-0 transition group-hover:opacity-100"
      />
      <div className="mb-3 flex items-start justify-between gap-2">
        <Link
          to={`/boards/${board.id}`}
          className="text-lg font-bold tracking-tight text-white transition hover:text-brand-300"
        >
          {board.title}
        </Link>
        <span
          className={
            board.role === 'OWNER'
              ? 'inline-flex items-center rounded-full border border-brand-400/30 bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-200'
              : 'inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300'
          }
        >
          {board.role}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1V4z" />
          </svg>
          {board._count?.columns ?? 0} columns
        </span>
        <span className="text-slate-600">•</span>
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          {board._count?.members ?? 0} members
        </span>
      </div>
      {board.role === 'OWNER' && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onDelete}
            className="text-xs font-medium text-red-400 transition hover:text-red-300"
          >
            Delete
          </button>
        </div>
      )}
    </motion.li>
  );
}
