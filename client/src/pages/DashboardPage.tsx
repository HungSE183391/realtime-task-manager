import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AddBoardModal from '../components/modals/AddBoardModal';
import { deleteBoard, listBoards } from '../api/boards';
import { useAuthStore } from '../store/authStore';
import type { BoardSummary } from '../types';

export default function DashboardPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

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
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {/* Page header */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-violet-400">
              Workspace
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {user?.name ? `${user.name.split(' ')[0]}'s boards` : 'Your boards'}
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Plan, track, and collaborate in real time.
            </p>
          </div>
          <motion.button
            onClick={() => setOpen(true)}
            className="btn-primary text-[13px]"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
            </svg>
            New board
          </motion.button>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[100px] rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card p-6 text-center text-[13px] text-red-400">
            Failed to load boards. Please try again.
          </div>
        )}

        {/* Empty state */}
        {boards && boards.length === 0 && (
          <motion.div
            className="card animate-fade-in flex flex-col items-center p-16 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-400/20">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-violet-400">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <h2 className="text-[17px] font-semibold text-white">No boards yet</h2>
            <p className="mt-1 text-[13px] text-slate-500">Create your first board to get started.</p>
            <button onClick={() => setOpen(true)} className="btn-primary mt-5 text-[13px]">
              Create your first board
            </button>
          </motion.div>
        )}

        {/* Board grid */}
        {boards && boards.length > 0 && (
          <motion.ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
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

function BoardCard({ board, onDelete }: { board: BoardSummary; onDelete: () => void }) {
  const navigate = useNavigate();

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    navigate(`/boards/${board.id}`);
  }

  const initials = board.title.charAt(0).toUpperCase();
  const colors = ['from-violet-600 to-indigo-600', 'from-cyan-600 to-blue-600', 'from-fuchsia-600 to-violet-600', 'from-emerald-600 to-cyan-600'];
  const colorClass = colors[board.title.charCodeAt(0) % colors.length];

  return (
    <motion.li
      layout
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.97 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="card-interactive group relative cursor-pointer overflow-hidden"
      onClick={handleCardClick}
    >
      {/* Top accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${colorClass} opacity-70`} />

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${colorClass} text-sm font-semibold text-white shadow-sm`}>
              {initials}
            </div>
            <Link
              to={`/boards/${board.id}`}
              className="text-[15px] font-semibold tracking-tight text-white transition-colors hover:text-violet-300 line-clamp-1"
            >
              {board.title}
            </Link>
          </div>
          <span className={board.role === 'OWNER' ? 'badge-owner shrink-0' : 'badge-member shrink-0'}>
            {board.role}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-[12px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-slate-600">
                <path d="M2 3a1 1 0 011-1h2a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm5 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1H8a1 1 0 01-1-1V3z" />
              </svg>
              {board._count?.columns ?? 0} columns
            </span>
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-slate-600">
                <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3z" />
              </svg>
              {board._count?.members ?? 0} members
            </span>
          </div>

          {board.role === 'OWNER' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-[11px] font-medium text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.li>
  );
}
