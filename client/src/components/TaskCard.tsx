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
        'group relative cursor-grab select-none rounded-xl border bg-[#0d1117]/80 p-3 shadow-sm backdrop-blur-sm transition-all duration-150 active:cursor-grabbing',
        isDragging
          ? 'border-violet-400/50 opacity-40 shadow-glow rotate-1 scale-[1.02]'
          : task.completed
            ? 'border-white/[0.05] opacity-50 hover:opacity-70 hover:border-white/[0.09]'
            : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-[#111827]/80 hover:-translate-y-px hover:shadow-md',
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Completion toggle */}
        <motion.button
          type="button"
          onClick={onToggleComplete}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          whileTap={{ scale: 0.82 }}
          className={clsx(
            'mt-[2px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition-all duration-150',
            task.completed
              ? 'border-emerald-400 bg-emerald-400 text-[#0d1117]'
              : 'border-white/20 bg-transparent text-transparent hover:border-emerald-400/70',
          )}
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-2 w-2">
            <path
              d="M2 6.5L4.5 9L10 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>

        {/* Title */}
        <p
          className={clsx(
            'flex-1 text-[13px] font-medium leading-snug',
            task.completed ? 'text-slate-600 line-through' : 'text-slate-200',
          )}
        >
          {task.title}
        </p>
      </div>

      {/* Description preview */}
      {task.description && (
        <p
          className={clsx(
            'mt-1.5 line-clamp-2 pl-[23px] text-[12px] leading-relaxed',
            task.completed ? 'text-slate-700' : 'text-slate-500',
          )}
        >
          {task.description}
        </p>
      )}

      {/* Meta row */}
      {(task.assignedTo || due || (task._count?.comments ?? 0) > 0 || (task._count?.attachments ?? 0) > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 pl-[23px]">
          <div className="flex items-center gap-2">
            {task.assignedTo && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="avatar h-4 w-4 text-[9px]">
                  {task.assignedTo.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:block">{task.assignedTo.name.split(' ')[0]}</span>
              </span>
            )}
            {(task._count?.comments ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-slate-600" title="Comments">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M14 4v8a1.5 1.5 0 01-1.5 1.5H5l-3 2.5V4A1.5 1.5 0 013.5 2.5h9A1.5 1.5 0 0114 4z" />
                </svg>
                {task._count?.comments}
              </span>
            )}
            {(task._count?.attachments ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-slate-600" title="Attachments">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M9.5 2.5a3 3 0 014.243 4.243L6.5 14a4.5 4.5 0 11-6.364-6.364L7.293 0.5" />
                </svg>
                {task._count?.attachments}
              </span>
            )}
          </div>

          {due && (
            <span
              className={clsx(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                task.completed
                  ? 'text-slate-600 line-through'
                  : overdue
                    ? 'bg-red-500/10 text-red-400 ring-1 ring-red-400/25'
                    : 'bg-amber-500/8 text-amber-400 ring-1 ring-amber-400/20',
              )}
            >
              {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
