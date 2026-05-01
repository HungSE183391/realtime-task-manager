import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import Header from '../components/Header';
import Column from '../components/Column';
import AddColumnInline from '../components/AddColumnInline';
import TaskCard from '../components/TaskCard';
import InviteMemberModal from '../components/modals/InviteMemberModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import ChatPanel from '../components/ChatPanel';

import { getBoard, updateBoard } from '../api/boards';
import { updateColumn } from '../api/columns';
import { updateTask } from '../api/tasks';
import { useBoardSocket } from '../hooks/useBoardSocket';
import { useAuthStore } from '../store/authStore';
import type { BoardDetail, Column as ColumnType, Message, Role, Task } from '../types';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnType | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const seenLastIdRef = useRef<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['board', id],
    queryFn: () => getBoard(id!),
    enabled: !!id,
  });

  useBoardSocket(id);

  const board = data?.board;
  const role = (data?.role ?? 'MEMBER') as Role;
  const isOwner = role === 'OWNER';

  useEffect(() => {
    if (!id) return;
    const queryKey = ['messages', id] as const;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      if (JSON.stringify(event.query.queryKey) !== JSON.stringify(queryKey)) return;
      const msgs = event.query.state.data as Message[] | undefined;
      if (!msgs || msgs.length === 0) return;
      const last = msgs[msgs.length - 1];
      if (last.id === seenLastIdRef.current) return;
      if (chatOpen || last.userId === me?.id) {
        seenLastIdRef.current = last.id;
        return;
      }
      setUnreadCount((c) => c + 1);
    });
    return () => unsubscribe();
  }, [id, chatOpen, me?.id, queryClient]);

  useEffect(() => {
    if (!chatOpen) return;
    setUnreadCount(0);
    const msgs = queryClient.getQueryData<Message[]>(['messages', id]);
    if (msgs && msgs.length > 0) {
      seenLastIdRef.current = msgs[msgs.length - 1].id;
    }
  }, [chatOpen, id, queryClient]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const moveMutation = useMutation({
    mutationFn: ({
      taskId,
      columnId,
      beforeId,
      afterId,
    }: {
      taskId: string;
      columnId: string;
      beforeId: string | null;
      afterId: string | null;
    }) => updateTask(taskId, { columnId, beforeId, afterId }),
    onError: (err: any, _vars, ctx: any) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['board', id], ctx.previous);
      }
      toast.error(err?.response?.data?.error || 'Failed to move task');
    },
  });

  const moveColumnMutation = useMutation({
    mutationFn: ({
      columnId,
      beforeId,
      afterId,
    }: {
      columnId: string;
      beforeId: string | null;
      afterId: string | null;
    }) => updateColumn(columnId, { beforeId, afterId }),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to reorder column'),
  });

  const renameBoardMutation = useMutation({
    mutationFn: (title: string) => updateBoard(id!, title),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to rename board'),
  });

  const taskById = useMemo(() => {
    const map = new Map<string, { task: Task; columnId: string }>();
    if (board) {
      for (const c of board.columns) {
        for (const t of c.tasks) map.set(t.id, { task: t, columnId: c.id });
      }
    }
    return map;
  }, [board]);

  function findColumnByTaskId(taskId: string): ColumnType | undefined {
    return board?.columns.find((c) => c.tasks.some((t) => t.id === taskId));
  }

  function onDragStart(e: DragStartEvent) {
    const type = e.active.data.current?.type;
    if (type === 'column') {
      const colId = e.active.data.current?.columnId as string;
      const col = board?.columns.find((c) => c.id === colId);
      if (col) setActiveColumn(col);
      return;
    }
    const taskId = String(e.active.id);
    const found = taskById.get(taskId);
    if (found) setActiveTask(found.task);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    setActiveColumn(null);
    if (!board) return;

    const activeType = e.active.data.current?.type;

    if (activeType === 'column') {
      const activeColId = e.active.data.current?.columnId as string;
      const overId = e.over ? String(e.over.id) : null;
      if (!overId || !overId.startsWith('col:')) return;
      const overColId = overId.slice('col:'.length);
      if (activeColId === overColId) return;

      const cols = board.columns;
      const others = cols.filter((c) => c.id !== activeColId);
      const overIdx = others.findIndex((c) => c.id === overColId);
      if (overIdx < 0) return;

      const beforeId = overIdx > 0 ? others[overIdx - 1].id : null;
      const afterId = others[overIdx].id;

      const previous = queryClient.getQueryData(['board', id]);
      queryClient.setQueryData<{ board: BoardDetail; role: Role }>(['board', id], (old) => {
        if (!old) return old;
        const moved = old.board.columns.find((c) => c.id === activeColId);
        if (!moved) return old;
        const without = old.board.columns.filter((c) => c.id !== activeColId);
        const insertIdx = without.findIndex((c) => c.id === overColId);
        const reordered = [...without];
        reordered.splice(insertIdx >= 0 ? insertIdx : reordered.length, 0, moved);
        return { ...old, board: { ...old.board, columns: reordered } };
      });

      moveColumnMutation.mutate(
        { columnId: activeColId, beforeId, afterId },
        {
          onError: () => {
            if (previous) queryClient.setQueryData(['board', id], previous);
          },
        },
      );
      return;
    }

    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;

    const fromColumn = findColumnByTaskId(activeId);
    if (!fromColumn) return;

    let toColumnId: string;
    let overTaskId: string | null = null;

    if (overId.startsWith('column:')) {
      toColumnId = overId.slice('column:'.length);
    } else {
      const overInfo = taskById.get(overId);
      if (!overInfo) return;
      toColumnId = overInfo.columnId;
      overTaskId = overId;
    }

    const toColumn = board.columns.find((c) => c.id === toColumnId);
    if (!toColumn) return;

    const targetTasks = toColumn.tasks.filter((t) => t.id !== activeId);
    let insertIndex: number;
    if (overTaskId) {
      const idx = targetTasks.findIndex((t) => t.id === overTaskId);
      insertIndex = idx >= 0 ? idx : targetTasks.length;
    } else {
      insertIndex = targetTasks.length;
    }

    const beforeId = insertIndex > 0 ? targetTasks[insertIndex - 1].id : null;
    const afterId = insertIndex < targetTasks.length ? targetTasks[insertIndex].id : null;

    if (
      fromColumn.id === toColumnId &&
      ((beforeId === null && fromColumn.tasks[0]?.id === activeId) ||
        (afterId !== null &&
          fromColumn.tasks.findIndex((t) => t.id === activeId) ===
            fromColumn.tasks.findIndex((t) => t.id === afterId) - 1))
    ) {
      return;
    }

    const previous = queryClient.getQueryData(['board', id]);
    queryClient.setQueryData<{ board: BoardDetail; role: Role }>(['board', id], (old) => {
      if (!old) return old;
      const draggedFull = taskById.get(activeId)?.task;
      if (!draggedFull) return old;

      const columns = old.board.columns.map((c) => {
        if (c.id === fromColumn.id && fromColumn.id !== toColumnId) {
          return { ...c, tasks: c.tasks.filter((t) => t.id !== activeId) };
        }
        if (c.id === toColumnId) {
          const without = c.tasks.filter((t) => t.id !== activeId);
          const beforePos = beforeId ? without.find((t) => t.id === beforeId)?.position ?? 0 : 0;
          const afterPos = afterId
            ? without.find((t) => t.id === afterId)?.position ?? beforePos + 2
            : beforePos + 2;
          const synthPos = (beforePos + afterPos) / 2;
          const moved = { ...draggedFull, columnId: toColumnId, position: synthPos };
          const next = [...without, moved].sort((a, b) => a.position - b.position);
          return { ...c, tasks: next };
        }
        return c;
      });
      return { ...old, board: { ...old.board, columns } };
    });

    moveMutation.mutate(
      { taskId: activeId, columnId: toColumnId, beforeId, afterId },
      {
        onError: () => {
          if (previous) queryClient.setQueryData(['board', id], previous);
        },
      },
    );
  }

  function startEditTitle() {
    if (!isOwner || !board) return;
    setTitleDraft(board.title);
    setEditingTitle(true);
  }

  function commitTitle() {
    setEditingTitle(false);
    const t = titleDraft.trim();
    if (!board || !t || t === board.title) return;
    queryClient.setQueryData<{ board: BoardDetail; role: Role }>(['board', id], (old) =>
      old ? { ...old, board: { ...old.board, title: t } } : old,
    );
    renameBoardMutation.mutate(t);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="p-8 text-slate-400">Loading board...</div>
      </div>
    );
  }
  if (error || !board) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="p-8">
          <p className="mb-3 text-red-300">Failed to load board.</p>
          <Link to="/" className="text-brand-300 hover:text-brand-200">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const columnIds = board.columns.map((c) => `col:${c.id}`);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <motion.div
        className="border-b border-white/5 bg-slate-950/40 backdrop-blur-xl"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mx-auto flex max-w-full items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0 flex-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-brand-300"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
              </svg>
              Boards
            </Link>
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setTitleDraft(board.title);
                    setEditingTitle(false);
                  }
                }}
                maxLength={120}
                className="mt-0.5 w-full rounded-md border border-brand-400/40 bg-slate-950/40 px-2 py-1 text-2xl font-extrabold tracking-tight text-white outline-none ring-2 ring-brand-400/30"
              />
            ) : (
              <h1
                onClick={startEditTitle}
                title={isOwner ? 'Click to rename board' : board.title}
                className={
                  'truncate text-2xl font-extrabold tracking-tight text-white' +
                  (isOwner ? ' cursor-text rounded-md transition hover:bg-white/5 hover:px-2' : '')
                }
              >
                {board.title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {board.members.slice(0, 5).map((m) => (
                <motion.span
                  key={m.id}
                  title={`${m.user.name} (${m.role})`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white ring-2 ring-slate-950"
                  whileHover={{ y: -3, scale: 1.08 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  {m.user.name.charAt(0).toUpperCase()}
                </motion.span>
              ))}
              {board.members.length > 5 && (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-200 ring-2 ring-slate-950">
                  +{board.members.length - 5}
                </span>
              )}
            </div>
            <motion.button
              onClick={() => setChatOpen(true)}
              className="btn-secondary relative"
              aria-label="Open chat"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="-ml-0.5 mr-1.5 h-4 w-4">
                <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" />
              </svg>
              Chat
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md shadow-red-900/50"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              onClick={() => setInviteOpen(true)}
              className="btn-secondary"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="-ml-0.5 mr-1.5 h-4 w-4">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              Members
            </motion.button>
          </div>
        </div>
      </motion.div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveTask(null);
          setActiveColumn(null);
        }}
      >
        <main className="flex-1 overflow-x-auto">
          <div className="flex h-full items-start gap-4 p-6">
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              {board.columns.map((c) => (
                <Column key={c.id} column={c} onTaskClick={(t) => setSelectedTask(t)} />
              ))}
            </SortableContext>
            <AddColumnInline boardId={board.id} />
          </div>
        </main>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 opacity-95">
              <TaskCard task={activeTask} onClick={() => undefined} />
            </div>
          ) : activeColumn ? (
            <div className="glass w-72 rotate-1 p-2 opacity-90 shadow-2xl shadow-black/60">
              <div className="px-2 py-1 text-sm font-bold text-slate-100">
                {activeColumn.title}{' '}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  {activeColumn.tasks.length} tasks
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        board={board}
        role={role}
      />
      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        members={board.members}
        columns={board.columns}
      />
      <ChatPanel boardId={board.id} open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
