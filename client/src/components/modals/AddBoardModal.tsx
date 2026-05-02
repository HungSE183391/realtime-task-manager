import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { createBoard } from '../../api/boards';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddBoardModal({ open, onClose }: Props) {
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (t: string) => createBoard(t),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Board created');
      setTitle('');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to create board');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate(title.trim());
  }

  return (
    <Modal open={open} onClose={onClose} title="New board">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Board name</label>
          <input
            autoFocus
            className="input text-[13px]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Marketing roadmap"
            required
            maxLength={120}
          />
          <p className="mt-1.5 text-[11px] text-slate-600">
            You can invite team members after creating the board.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.07] pt-4">
          <button type="button" onClick={onClose} className="btn-secondary text-[13px]">
            Cancel
          </button>
          <button type="submit" className="btn-primary text-[13px]" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating…
              </span>
            ) : 'Create board'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
