import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="h-fit w-72 shrink-0 rounded-xl border border-dashed border-white/15 bg-white/5 p-3 text-left text-sm font-medium text-slate-400 backdrop-blur-md transition hover:border-brand-400/50 hover:bg-white/10 hover:text-white"
      >
        + Add a column
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass w-72 shrink-0 p-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setAdding(false);
            setTitle('');
          }
        }}
        placeholder="Column title..."
        className="input mb-2"
        maxLength={120}
      />
      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary text-xs">
          Add column
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setTitle('');
          }}
          className="btn-ghost text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
