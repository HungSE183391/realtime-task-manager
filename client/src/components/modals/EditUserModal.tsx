import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { updateUser, type UpdateUserPayload } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';
import type { AdminUser } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  user: AdminUser | null;
}

export default function EditUserModal({ open, onClose, user }: Props) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPassword('');
      setConfirmPassword('');
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser(user!.id, payload),
    onSuccess: (updated) => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      // If admin edited their own profile (e.g. own email), keep auth store in sync.
      if (me && updated.id === me.id) {
        setUser({
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          createdAt: updated.createdAt,
        });
        qc.invalidateQueries({ queryKey: ['me'] });
      }
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Failed to update user'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const payload: UpdateUserPayload = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName && trimmedName !== user.name) payload.name = trimmedName;
    if (trimmedEmail && trimmedEmail !== user.email) payload.email = trimmedEmail;
    if (password) {
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      payload.password = password;
    }

    if (Object.keys(payload).length === 0) {
      toast('Nothing changed', { icon: 'ℹ️' });
      return;
    }

    mutation.mutate(payload);
  }

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Edit user: ${user.name}`} maxWidth="max-w-md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            maxLength={80}
            required
          />
        </div>

        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
        </div>

        <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-200">
            Reset password (optional)
          </p>
          <div className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (leave blank to keep current)"
              className="input"
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
            />
            {password && (
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="input"
                autoComplete="new-password"
              />
            )}
          </div>
          <p className="mt-2 text-[11px] text-amber-200/70">
            The user will need to log in again with the new password.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
