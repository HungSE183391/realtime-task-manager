import { FormEvent, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import TaskCard from './TaskCard';
import { createTask } from '../api/tasks';
import { deleteColumn, updateColumn } from '../api/columns';
import type { Column as ColumnType, Task } from '../types';

interface Props {
  column: ColumnType;
  onTaskClick: (task: Task) => void;
}

export default function Column({ column, onTaskClick }: Props) {
  const [adding, setAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const sortable = useSortable({
    id: `col:${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  const createTaskMutation = useMutation({
    mutationFn: (title: string) => createTask(column.id, { title }),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to add task'),
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => updateColumn(column.id, { title }),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to rename'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteColumn(column.id),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to delete'),
  });

  function onAddTaskSubmit(e: FormEvent) {
    e.preventDefault();
    const t = taskTitle.trim();
    if (!t) return;
    createTaskMutation.mutate(t);
    setTaskTitle('');
    setAdding(false);
  }

  function onTitleBlur() {
    setEditingTitle(false);
    const t = titleDraft.trim();
    if (!t || t === column.title) {
      setTitleDraft(column.title);
      return;
    }
    renameMutation.mutate(t);
  }

  function onDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete column "${column.title}" and all its tasks?`)) return;
    deleteMutation.mutate();
  }

  const taskIds = column.tasks.map((t) => t.id);
  const completedCount = column.tasks.filter((t) => t.completed).length;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      className="flex h-full max-h-full w-[272px] shrink-0 flex-col rounded-xl border border-white/[0.07] bg-[#0a0f1a]/70 backdrop-blur-xl shadow-xl shadow-black/20"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          {...sortable.listeners}
          type="button"
          aria-label="Drag column"
          className="cursor-grab text-slate-700 transition-colors hover:text-slate-500 active:cursor-grabbing"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <circle cx="5" cy="4" r="1.2" /><circle cx="5" cy="8" r="1.2" /><circle cx="5" cy="12" r="1.2" />
            <circle cx="11" cy="4" r="1.2" /><circle cx="11" cy="8" r="1.2" /><circle cx="11" cy="12" r="1.2" />
          </svg>
        </button>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={onTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setTitleDraft(column.title); setEditingTitle(false); }
            }}
            className="input h-7 flex-1 py-0.5 text-[13px] font-semibold"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="flex-1 truncate text-left text-[13px] font-semibold text-slate-200 transition-colors hover:text-white"
            title="Click to rename"
          >
            {column.title}
          </button>
        )}

        {/* Task count badge */}
        <span className="ml-auto shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
          {completedCount}/{column.tasks.length}
        </span>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-icon h-6 w-6 text-slate-600 hover:text-slate-400"
            title="Column options"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-white/[0.08] bg-[#0d1117] py-1 shadow-panel"
                >
                  <button
                    onClick={() => { setMenuOpen(false); setEditingTitle(true); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M12.586 2.586a2 2 0 112.828 2.828l-8.486 8.486a2 2 0 01-.828.503l-3 .75a.5.5 0 01-.614-.614l.75-3a2 2 0 01.503-.828l8.847-8.125z" /></svg>
                    Rename
                  </button>
                  <div className="my-1 border-t border-white/[0.06]" />
                  <button
                    onClick={onDelete}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M6.5 1h3a.5.5 0 01.5.5v1H6v-1a.5.5 0 01.5-.5zM11 2.5v-1A1.5 1.5 0 009.5 0h-3A1.5 1.5 0 005 1.5v1H2.506a.58.58 0 00-.01 1.16l.256 9.996a2 2 0 001.99 1.844h6.516a2 2 0 001.99-1.844l.255-9.996a.582.582 0 00-.01-1.16H11z" /></svg>
                    Delete
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Progress bar */}
      {column.tasks.length > 0 && (
        <div className="mx-3 mb-2 h-[2px] rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
            style={{ width: `${(completedCount / column.tasks.length) * 100}%` }}
          />
        </div>
      )}

      {/* Task list drop zone */}
      <div
        ref={setDroppableRef}
        className={clsx(
          'flex-1 space-y-2 overflow-y-auto px-2 py-1 transition-colors duration-150',
          isOver && 'rounded-lg bg-violet-500/[0.06] ring-1 ring-inset ring-violet-400/20',
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {column.tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              >
                <TaskCard task={task} onClick={() => onTaskClick(task)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>

        {column.tasks.length === 0 && !adding && (
          <div className="flex h-16 items-center justify-center">
            <p className="text-[12px] text-slate-700">Drop tasks here</p>
          </div>
        )}
      </div>

      {/* Add task area */}
      <div className="p-2 pt-1">
        <AnimatePresence mode="wait" initial={false}>
          {adding ? (
            <motion.form
              key="form"
              onSubmit={onAddTaskSubmit}
              className="space-y-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
            >
              <textarea
                autoFocus
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onAddTaskSubmit(e as unknown as FormEvent);
                  }
                  if (e.key === 'Escape') { setAdding(false); setTaskTitle(''); }
                }}
                placeholder="Task title…"
                className="input min-h-[60px] text-[13px]"
                maxLength={200}
              />
              <div className="flex items-center gap-2">
                <button type="submit" className="btn-primary text-[12px] py-1.5">
                  Add task
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setTaskTitle(''); }}
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
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-slate-600 transition-all duration-150 hover:bg-white/[0.04] hover:text-slate-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8 3a1 1 0 011 1v3h3a1 1 0 110 2H9v3a1 1 0 11-2 0V9H4a1 1 0 110-2h3V4a1 1 0 011-1z" />
              </svg>
              Add a task
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
