import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Header from '../components/Header';
import EditUserModal from '../components/modals/EditUserModal';
import {
  deleteAdminBoard,
  deleteUser,
  fetchAdminStats,
  listAdminBoards,
  listAdminUsers,
  updateUserRole,
} from '../api/admin';
import { useAuthStore } from '../store/authStore';
import type { AdminUser, UserRole } from '../types';

type Tab = 'users' | 'boards';

export default function AdminPage() {
  const me = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');

  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== 'ADMIN') {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="card p-10">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-red-400/30">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-red-300">
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-white">Access denied</h1>
            <p className="mt-2 text-sm text-slate-400">
              You need admin privileges to view this page.
            </p>
            <Link to="/" className="btn-secondary mt-5 inline-flex">
              ← Back to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
            System
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Admin console
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage users, grant permissions, and oversee all boards.
          </p>
        </motion.div>

        <StatsRow />

        <div className="mt-8 mb-4 flex flex-wrap items-center gap-2 border-b border-white/10">
          <TabButton current={tab} value="users" onClick={() => setTab('users')}>
            Users
          </TabButton>
          <TabButton current={tab} value="boards" onClick={() => setTab('boards')}>
            Boards
          </TabButton>
          {tab === 'users' && (
            <div className="ml-auto w-full sm:w-72">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name..."
                className="input"
              />
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <UsersTable search={search} meId={me.id} />
            </motion.div>
          ) : (
            <motion.div
              key="boards"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <BoardsTable />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function TabButton({
  current,
  value,
  onClick,
  children,
}: {
  current: Tab;
  value: Tab;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative -mb-px px-4 py-2.5 text-sm font-semibold transition',
        active ? 'text-white' : 'text-slate-400 hover:text-slate-200',
      )}
    >
      {children}
      {active && (
        <motion.span
          layoutId="adminTabUnderline"
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-brand-400 to-accent-400"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  );
}

function StatsRow() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
    staleTime: 30_000,
  });

  const cards = [
    { label: 'Users', value: stats?.users, accent: 'from-purple-500 to-indigo-500' },
    { label: 'Admins', value: stats?.admins, accent: 'from-rose-500 to-pink-500' },
    { label: 'Boards', value: stats?.boards, accent: 'from-cyan-500 to-blue-500' },
    { label: 'Tasks', value: stats?.tasks, accent: 'from-amber-500 to-orange-500' },
    { label: 'Comments', value: stats?.comments, accent: 'from-emerald-500 to-teal-500' },
    {
      label: 'Attachments',
      value: stats?.attachments,
      accent: 'from-fuchsia-500 to-violet-500',
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.05 } },
        hidden: {},
      }}
    >
      {cards.map((c) => (
        <motion.div
          key={c.label}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="card relative overflow-hidden p-4"
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${c.accent} opacity-20 blur-xl`}
          />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {c.label}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-white tabular-nums">
            {c.value ?? '—'}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}

function UsersTable({ search, meId }: { search: string; meId: string }) {
  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => listAdminUsers(search.trim() || undefined),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: (user) => {
      toast.success(`${user.name} is now ${user.role}`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Failed to update role'),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-boards'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Failed to delete user'),
  });

  const users = data?.users ?? [];

  return (
    <div className="card overflow-hidden">
      {isLoading && <div className="p-8 text-center text-sm text-slate-400">Loading users...</div>}
      {error && <div className="p-8 text-center text-sm text-red-300">Failed to load users.</div>}
      {!isLoading && users.length === 0 && (
        <div className="p-8 text-center text-sm text-slate-500">No users found.</div>
      )}
      {users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isMe={u.id === meId}
                    onEdit={() => setEditingUser(u)}
                    onPromote={() => roleMutation.mutate({ userId: u.id, role: 'ADMIN' })}
                    onDemote={() => roleMutation.mutate({ userId: u.id, role: 'USER' })}
                    onDelete={() => {
                      if (confirm(`Delete user ${u.email}? This will also delete the boards they own.`)) {
                        deleteMutation.mutate(u.id);
                      }
                    }}
                    busy={roleMutation.isPending || deleteMutation.isPending}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <EditUserModal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
      />
    </div>
  );
}

function UserRow({
  user: u,
  isMe,
  onEdit,
  onPromote,
  onDemote,
  onDelete,
  busy,
}: {
  user: AdminUser;
  isMe: boolean;
  onEdit: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const isAdmin = u.role === 'ADMIN';
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className="border-b border-white/5 transition hover:bg-white/[0.025]"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="bg-gradient-brand inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white">
            {u.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-100">
              {u.name}
              {isMe && (
                <span className="ml-2 inline-flex items-center rounded-full border border-brand-400/30 bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-200">
                  You
                </span>
              )}
            </p>
            <p className="truncate text-xs text-slate-400">{u.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            isAdmin
              ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30'
              : 'bg-white/5 text-slate-300 ring-1 ring-white/10',
          )}
        >
          {isAdmin && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
              <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.4l-4.8 2.5.9-5.4L2.2 7.7l5.4-.8L10 2z" />
            </svg>
          )}
          {u.role}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span title="Boards owned">
            <span className="font-bold text-slate-200">{u._count.ownedBoards}</span> owned
          </span>
          <span className="text-slate-600">·</span>
          <span title="Board memberships">
            <span className="font-bold text-slate-200">{u._count.memberships}</span> joined
          </span>
          <span className="text-slate-600">·</span>
          <span title="Assigned tasks">
            <span className="font-bold text-slate-200">{u._count.assignedTasks}</span> tasks
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {new Date(u.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <motion.button
            onClick={onEdit}
            disabled={busy}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-brand-400/40 hover:text-brand-100 disabled:opacity-50"
            title="Edit user details"
          >
            Edit
          </motion.button>
          {!isMe && (
            <>
              {isAdmin ? (
                <motion.button
                  onClick={onDemote}
                  disabled={busy}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-50"
                >
                  Demote
                </motion.button>
              ) : (
                <motion.button
                  onClick={onPromote}
                  disabled={busy}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-md border border-brand-400/30 bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-100 transition hover:border-brand-400/60 hover:bg-brand-500/20 disabled:opacity-50"
                >
                  Make admin
                </motion.button>
              )}
              <motion.button
                onClick={onDelete}
                disabled={busy}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
              >
                Delete
              </motion.button>
            </>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

function BoardsTable() {
  const qc = useQueryClient();
  const { data: boards = [], isLoading, error } = useQuery({
    queryKey: ['admin-boards'],
    queryFn: listAdminBoards,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminBoard(id),
    onSuccess: () => {
      toast.success('Board deleted');
      qc.invalidateQueries({ queryKey: ['admin-boards'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Failed to delete board'),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof boards>();
    for (const b of boards) {
      const key = b.owner.email;
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [boards]);

  return (
    <div className="card overflow-hidden">
      {isLoading && <div className="p-8 text-center text-sm text-slate-400">Loading boards...</div>}
      {error && <div className="p-8 text-center text-sm text-red-300">Failed to load boards.</div>}
      {!isLoading && boards.length === 0 && (
        <div className="p-8 text-center text-sm text-slate-500">No boards yet.</div>
      )}
      {boards.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Board</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Stats</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {grouped.flatMap(([_owner, list]) =>
                  list.map((b) => (
                    <motion.tr
                      key={b.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                      className="border-b border-white/5 transition hover:bg-white/[0.025]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/boards/${b.id}`}
                          className="font-semibold text-slate-100 hover:text-brand-300"
                        >
                          {b.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-gradient-brand inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white">
                            {b.owner.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-300">{b.owner.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        <span className="font-bold text-slate-200">{b._count.columns}</span>{' '}
                        columns ·{' '}
                        <span className="font-bold text-slate-200">{b._count.members}</span>{' '}
                        members
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <motion.button
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete board "${b.title}" owned by ${b.owner.email}? This cannot be undone.`,
                                )
                              ) {
                                deleteMutation.mutate(b.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                          >
                            Delete
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  )),
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
