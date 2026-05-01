import { MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { updateTask } from '../api/tasks';
import type { Task } from '../types';

interface Props {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && !task.completed && due.getTime() < Date.now();

  const toggleMutation = useMutation({
    mutationFn: (next: boolean) => updateTask(task.id, { completed: next }),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update'),
  });

  function onToggleComplete(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    toggleMutation.mutate(!task.completed);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={clsx(
        'group relative cursor-grab select-none rounded-lg border bg-slate-900/70 p-3 shadow-md shadow-black/30 backdrop-blur-md transition active:cursor-grabbing',
        isDragging
          ? 'border-brand-400/60 opacity-50 shadow-glow-lg'
          : 'border-white/10 hover:-translate-y-0.5 hover:border-brand-400/40 hover:shadow-glow',
        task.completed && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2.5">
        <motion.button
          type="button"
          onClick={onToggleComplete}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={task.completed ? 'Mark as not completed' : 'Mark as completed'}
          title={task.completed ? 'Mark as not completed' : 'Mark as completed'}
          whileTap={{ scale: 0.85 }}
          animate={task.completed ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          className={clsx(
            'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition',
            task.completed
              ? 'border-emerald-400 bg-emerald-400 text-slate-950'
              : 'border-slate-600 bg-transparent text-transparent hover:border-emerald-400 hover:text-emerald-400',
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
            <path
              d="M3 8.5L6.5 12L13 5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
        <p
          className={clsx(
            'flex-1 text-sm font-medium leading-snug',
            task.completed ? 'text-slate-500 line-through' : 'text-slate-100',
          )}
        >
          {task.title}
        </p>
      </div>

      {task.description && (
        <p
          className={clsx(
            'mt-1.5 line-clamp-2 pl-6 text-xs',
            task.completed ? 'text-slate-600' : 'text-slate-400',
          )}
        >
          {task.description}
        </p>
      )}
      {(task.assignedTo || due) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 pl-6 text-xs">
          {task.assignedTo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-white/10">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white">
                {task.assignedTo.name.charAt(0).toUpperCase()}
              </span>
              {task.assignedTo.name}
            </span>
          ) : (
            <span />
          )}
          {due && (
            <span
              className={clsx(
                'rounded-md px-1.5 py-0.5 font-semibold ring-1',
                task.completed
                  ? 'bg-slate-800/50 text-slate-500 line-through ring-slate-700'
                  : overdue
                    ? 'bg-red-500/15 text-red-300 ring-red-400/30'
                    : 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
              )}
            >
              {due.toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {((task._count?.comments ?? 0) > 0 || (task._count?.attachments ?? 0) > 0) && (
        <div className="mt-2 flex items-center gap-3 pl-6 text-[11px] text-slate-400">
          {(task._count?.comments ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1" title="Comments">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" />
              </svg>
              {task._count?.comments}
            </span>
          )}
          {(task._count?.attachments ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1" title="Attachments">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M9.207 14.05a2.5 2.5 0 11-3.535-3.536l5.656-5.656a4 4 0 015.657 5.657L9.293 17.207a5.5 5.5 0 11-7.778-7.778l4.95-4.95a1 1 0 011.414 1.415l-4.95 4.95a3.5 3.5 0 104.95 4.95l7.69-7.692a2 2 0 10-2.827-2.829L7.086 11.93a.5.5 0 00.707.708l5.65-5.65a1 1 0 011.415 1.414l-5.65 5.65z" />
              </svg>
              {task._count?.attachments}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
