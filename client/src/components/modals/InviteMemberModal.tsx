import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { inviteMember, removeMember } from '../../api/boards';
import type { BoardDetail, Role } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useDMHubStore } from '../../store/dmHubStore';

interface Props {
  open: boolean;
  onClose: () => void;
  board: BoardDetail;
  role: Role;
}

export default function InviteMemberModal({ open, onClose, board, role }: Props) {
  const [email, setEmail] = useState('');
  const isOwner = role === 'OWNER';
  const me = useAuthStore((s) => s.user);
  const openDMWith = useDMHubStore((s) => s.openWith);

  const inviteMutation = useMutation({
    mutationFn: (e: string) => inviteMember(board.id, e),
    onSuccess: () => {
      toast.success('Member invited');
      setEmail('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to invite'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(board.id, userId),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to remove'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v) return;
    inviteMutation.mutate(v);
  }

  return (
    <Modal open={open} onClose={onClose} title="Members">
      {isOwner && (
        <form onSubmit={onSubmit} className="mb-5 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Invite by email..."
            className="input"
            required
          />
          <button type="submit" className="btn-primary shrink-0" disabled={inviteMutation.isPending}>
            Invite
          </button>
        </form>
      )}

      <ul className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10 bg-slate-950/40">
        {board.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-white">
                {m.user.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{m.user.name}</p>
                <p className="truncate text-xs text-slate-400">{m.user.email}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={
                  m.role === 'OWNER'
                    ? 'inline-flex items-center rounded-full border border-brand-400/30 bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-200'
                    : 'inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300'
                }
              >
                {m.role}
              </span>
              {me && m.userId !== me.id && (
                <button
                  type="button"
                  onClick={() => {
                    openDMWith(m.user);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-slate-200 transition hover:border-brand-400/40 hover:bg-brand-500/15 hover:text-brand-100"
                  title={`Message ${m.user.name}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Message
                </button>
              )}
              {isOwner && m.role !== 'OWNER' && (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${m.user.name} from this board?`)) {
                      removeMutation.mutate(m.userId);
                    }
                  }}
                  className="text-xs font-medium text-red-400 transition hover:text-red-300"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="btn-secondary">
          Close
        </button>
      </div>
    </Modal>
  );
}
