import { FormEvent, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
    if (!confirm(`Delete column "${column.title}" and all its tasks?`)) return;
    deleteMutation.mutate();
  }

  const taskIds = column.tasks.map((t) => t.id);
  const completedCount = column.tasks.filter((t) => t.completed).length;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      className="glass flex h-full max-h-full w-72 shrink-0 flex-col p-2 shadow-lg shadow-black/30"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-2 pt-1">
        <button
          {...sortable.listeners}
          type="button"
          aria-label="Drag column"
          title="Drag to reorder column"
          className="cursor-grab text-slate-500 transition hover:text-brand-300 active:cursor-grabbing"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M7 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM13 4a1 1 0 100 2 1 1 0 000-2zM13 9a1 1 0 100 2 1 1 0 000-2zM13 14a1 1 0 100 2 1 1 0 000-2z" />
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
              if (e.key === 'Escape') {
                setTitleDraft(column.title);
                setEditingTitle(false);
              }
            }}
            className="input h-8 py-1"
          />
        ) : (
          <h3
            onClick={() => setEditingTitle(true)}
            className="flex-1 cursor-text truncate text-sm font-bold tracking-tight text-slate-100"
            title="Click to rename"
          >
            {column.title}{' '}
            <span className="ml-1 text-xs font-normal text-slate-500">
              {completedCount}/{column.tasks.length}
            </span>
          </h3>
        )}
        <button
          onClick={onDelete}
          className="text-slate-500 transition hover:scale-110 hover:text-red-400"
          title="Delete column"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
          </svg>
        </button>
      </div>

      <div
        ref={setDroppableRef}
        className={clsx(
          'flex-1 space-y-2 overflow-y-auto rounded-lg p-1 transition',
          isOver && 'bg-brand-500/10 ring-2 ring-brand-400/50',
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {column.tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <TaskCard task={task} onClick={() => onTaskClick(task)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>

        {column.tasks.length === 0 && !adding && (
          <p className="px-2 py-6 text-center text-xs text-slate-500">No tasks yet</p>
        )}
      </div>

      <div className="mt-2">
        <AnimatePresence mode="wait" initial={false}>
          {adding ? (
            <motion.form
              key="form"
              onSubmit={onAddTaskSubmit}
              className="space-y-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
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
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setTaskTitle('');
                  }
                }}
                placeholder="Task title..."
                className="input min-h-[60px] resize-none"
                maxLength={200}
              />
              <div className="flex items-center gap-2">
                <button type="submit" className="btn-primary text-xs">
                  Add task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setTaskTitle('');
                  }}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.button
              key="trigger"
              onClick={() => setAdding(true)}
              className="w-full rounded-lg px-2 py-2 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ x: 2 }}
            >
              + Add a task
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
