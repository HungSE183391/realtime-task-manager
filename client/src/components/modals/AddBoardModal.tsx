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
    <Modal open={open} onClose={onClose} title="Create new board">
      <form onSubmit={onSubmit}>
        <label className="label">Board title</label>
        <input
          autoFocus
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Marketing roadmap"
          required
          maxLength={120}
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create board'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
