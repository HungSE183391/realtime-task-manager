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
import VoiceRoomPanel from '../components/VoiceRoomPanel';
import VoiceAudioMounter from '../components/VoiceAudioMounter';

import { getBoard, updateBoard } from '../api/boards';
import { updateColumn } from '../api/columns';
import { updateTask } from '../api/tasks';
import { useBoardSocket } from '../hooks/useBoardSocket';
import { useVoiceRoom } from '../hooks/useVoiceRoom';
import { useAuthStore } from '../store/authStore';
import type { BoardDetail, Column as ColumnType, Message, Role, Task } from '../types';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
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
  const voice = useVoiceRoom(id);

  const board = data?.board;
  const role = (data?.role ?? 'MEMBER') as Role;
  const isOwner = role === 'OWNER';
  const voiceCount = voice.roomParticipants.length;

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
    mutationFn: ({ taskId, columnId, beforeId, afterId }: { taskId: string; columnId: string; beforeId: string | null; afterId: string | null }) =>
      updateTask(taskId, { columnId, beforeId, afterId }),
    onError: (err: any, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['board', id], ctx.previous);
      toast.error(err?.response?.data?.error || 'Failed to move task');
    },
  });

  const moveColumnMutation = useMutation({
    mutationFn: ({ columnId, beforeId, afterId }: { columnId: string; beforeId: string | null; afterId: string | null }) =>
      updateColumn(columnId, { beforeId, afterId }),
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

      moveColumnMutation.mutate({ columnId: activeColId, beforeId, afterId }, {
        onError: () => { if (previous) queryClient.setQueryData(['board', id], previous); },
      });
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
        (afterId !== null && fromColumn.tasks.findIndex((t) => t.id === activeId) === fromColumn.tasks.findIndex((t) => t.id === afterId) - 1))
    ) return;

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
          const afterPos = afterId ? without.find((t) => t.id === afterId)?.position ?? beforePos + 2 : beforePos + 2;
          const synthPos = (beforePos + afterPos) / 2;
          const moved = { ...draggedFull, columnId: toColumnId, position: synthPos };
          return { ...c, tasks: [...without, moved].sort((a, b) => a.position - b.position) };
        }
        return c;
      });
      return { ...old, board: { ...old.board, columns } };
    });

    moveMutation.mutate({ taskId: activeId, columnId: toColumnId, beforeId, afterId }, {
      onError: () => { if (previous) queryClient.setQueryData(['board', id], previous); },
    });
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
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
            <p className="text-[13px] text-slate-500">Loading board…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-3 text-[14px] text-red-400">Failed to load board.</p>
            <Link to="/" className="btn-secondary text-[13px]">
              ← Back to boards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const columnIds = board.columns.map((c) => `col:${c.id}`);
  const totalTasks = board.columns.reduce((sum, c) => sum + c.tasks.length, 0);
  const completedTasks = board.columns.reduce((sum, c) => sum + c.tasks.filter((t) => t.completed).length, 0);

  return (
    <div className="flex h-screen flex-col bg-[#080c14]">
      <Header />

      {/* Board sub-header */}
      <motion.div
        className="border-b border-white/[0.06] bg-[#080c14]/80 backdrop-blur-xl"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          {/* Left: breadcrumb + title */}
          <div className="min-w-0 flex-1">
            <Link
              to="/"
              className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 transition-colors hover:text-violet-400"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M9.78 11.78a.75.75 0 01-1.06 0L4.47 7.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 7l3.72 3.72a.75.75 0 010 1.06z" />
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
                  if (e.key === 'Escape') { setTitleDraft(board.title); setEditingTitle(false); }
                }}
                maxLength={120}
                className="block w-full rounded-lg border border-violet-400/40 bg-white/[0.04] px-2 py-1 text-[18px] font-bold text-white outline-none ring-2 ring-violet-400/20"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1
                  onClick={startEditTitle}
                  title={isOwner ? 'Click to rename' : board.title}
                  className={`truncate text-[18px] font-bold tracking-tight text-white ${isOwner ? 'cursor-text rounded-md transition-colors hover:bg-white/[0.05] hover:px-1.5' : ''}`}
                >
                  {board.title}
                </h1>
                {totalTasks > 0 && (
                  <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-500">
                    {completedTasks}/{totalTasks}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: member avatars + actions */}
          <div className="flex items-center gap-2">
            {/* Member avatars */}
            <div className="flex -space-x-2 mr-1">
              {board.members.slice(0, 4).map((m) => (
                <motion.span
                  key={m.id}
                  title={`${m.user.name} · ${m.role}`}
                  className="avatar h-7 w-7 text-[11px] ring-2 ring-[#080c14]"
                  whileHover={{ y: -2, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  {m.user.name.charAt(0).toUpperCase()}
                </motion.span>
              ))}
              {board.members.length > 4 && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-slate-400 ring-2 ring-[#080c14]">
                  +{board.members.length - 4}
                </span>
              )}
            </div>

            {/* Voice button */}
            <motion.button
              onClick={() => setVoiceOpen(true)}
              className={`btn-secondary relative text-[12px] py-1.5 px-3 ${voice.joined ? 'border-emerald-400/30 text-emerald-300' : ''}`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
              </svg>
              <span className="hidden sm:block">Voice</span>
              <AnimatePresence>
                {voiceCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white ring-1 ring-[#080c14]"
                  >
                    {voiceCount}
                  </motion.span>
                )}
              </AnimatePresence>
              {voice.joined && (
                <motion.span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#080c14]"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
              )}
            </motion.button>

            {/* Chat button */}
            <motion.button
              onClick={() => setChatOpen(true)}
              className="btn-secondary relative text-[12px] py-1.5 px-3"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" />
              </svg>
              <span className="hidden sm:block">Chat</span>
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-1 ring-[#080c14]"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Members button */}
            <motion.button
              onClick={() => setInviteOpen(true)}
              className="btn-secondary text-[12px] py-1.5 px-3"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span className="hidden sm:block">Members</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setActiveTask(null); setActiveColumn(null); }}
      >
        <main className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full items-start gap-3 p-5">
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              {board.columns.map((c) => (
                <Column key={c.id} column={c} onTaskClick={(t) => setSelectedTask(t)} />
              ))}
            </SortableContext>
            <AddColumnInline boardId={board.id} />
          </div>
        </main>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeTask ? (
            <div className="rotate-1 scale-[1.03] opacity-95 w-[272px]">
              <TaskCard task={activeTask} onClick={() => undefined} />
            </div>
          ) : activeColumn ? (
            <div className="w-[272px] rotate-1 rounded-xl border border-violet-400/30 bg-[#0a0f1a]/90 px-3 py-2.5 opacity-90 shadow-glow-lg backdrop-blur-xl">
              <p className="text-[13px] font-semibold text-slate-200">{activeColumn.title}</p>
              <p className="text-[11px] text-slate-600">{activeColumn.tasks.length} tasks</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Panels & Modals */}
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
      <VoiceRoomPanel open={voiceOpen} onClose={() => setVoiceOpen(false)} voice={voice} />
      <VoiceAudioMounter voice={voice} />
    </div>
  );
}
