import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { createColumn } from '../api/boards';

interface Props {
  boardId: string;
}

export default function AddColumnInline({ boardId }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const mutation = useMutation({
    mutationFn: (t: string) => createColumn(boardId, t),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to add column'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    mutation.mutate(t);
    setTitle('');
    setAdding(false);
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {adding ? (
        <motion.form
          key="form"
          onSubmit={onSubmit}
          className="w-[272px] shrink-0 rounded-xl border border-white/[0.09] bg-[#0a0f1a]/80 p-3 backdrop-blur-xl shadow-xl shadow-black/20"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setAdding(false); setTitle(''); }
            }}
            placeholder="Column title…"
            className="input mb-2.5 text-[13px]"
            maxLength={120}
          />
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary text-[12px] py-1.5">
              Add column
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setTitle(''); }}
              className="btn-ghost text-[12px] py-1.5"
            >
              Cancel
            </button>
          </div>
        </motion.form>
      ) : (
        <motion.button
          key="trigger"
          onClick={() => setAdding(true)}
          className="flex h-fit w-[272px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-3 text-[13px] font-medium text-slate-600 backdrop-blur-md transition-all duration-150 hover:border-violet-400/40 hover:bg-white/[0.05] hover:text-slate-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          whileHover={{ scale: 1.01 }}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M8 3a1 1 0 011 1v3h3a1 1 0 110 2H9v3a1 1 0 11-2 0V9H4a1 1 0 110-2h3V4a1 1 0 011-1z" />
          </svg>
          Add column
        </motion.button>
      )}
    </AnimatePresence>
  );
}
