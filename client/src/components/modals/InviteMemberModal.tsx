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
    <Modal open={open} onClose={onClose} title="Board members">
      {/* Invite form */}
      {isOwner && (
        <div className="mb-5">
          <label className="label">Invite by email</label>
          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="input text-[13px]"
              required
            />
            <button
              type="submit"
              className="btn-primary shrink-0 text-[13px]"
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Inviting…' : 'Invite'}
            </button>
          </form>
        </div>
      )}

      {/* Members list */}
      <div>
        <p className="label mb-3">Members · {board.members.length}</p>
        <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {board.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="avatar h-8 w-8 text-[12px] shrink-0">
                  {m.user.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-200">{m.user.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{m.user.email}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={m.role === 'OWNER' ? 'badge-owner' : 'badge-member'}>
                  {m.role}
                </span>

                {me && m.userId !== me.id && (
                  <button
                    type="button"
                    onClick={() => { openDMWith(m.user); onClose(); }}
                    className="btn-icon h-7 w-7 text-slate-500 hover:text-violet-400"
                    title={`Message ${m.user.name}`}
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                      <path d="M14 3v8a1.5 1.5 0 01-1.5 1.5H4.5L2 15V3A1.5 1.5 0 013.5 1.5h9A1.5 1.5 0 0114 3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}

                {isOwner && m.role !== 'OWNER' && (
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${m.user.name} from this board?`)) {
                        removeMutation.mutate(m.userId);
                      }
                    }}
                    className="btn-icon h-7 w-7 text-slate-600 hover:text-red-400"
                    title="Remove member"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M6.5 1.75a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3zM2 4.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H13l-.5 7.5A2 2 0 0110.5 14.5h-5A2 2 0 013.5 12.5L3 5H2.75A.75.75 0 012 4.25z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="btn-secondary text-[13px]">
          Close
        </button>
      </div>
    </Modal>
  );
}
