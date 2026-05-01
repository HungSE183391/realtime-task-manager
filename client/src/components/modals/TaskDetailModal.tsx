import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from './Modal';
import TaskComments from '../TaskComments';
import TaskAttachments from '../TaskAttachments';
import { deleteTask, updateTask } from '../../api/tasks';
import type { BoardMember, Column, Task } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  members: BoardMember[];
  columns: Column[];
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function TaskDetailModal({ open, onClose, task, members, columns }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [columnId, setColumnId] = useState<string>('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setAssignedToId(task.assignedToId ?? '');
      setDueDate(toLocalInputValue(task.dueDate));
      setColumnId(task.columnId);
      setCompleted(task.completed);
    }
  }, [task]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!task) throw new Error('No task');
      const payload: Parameters<typeof updateTask>[1] = {
        title: title.trim(),
        description: description.trim() || null,
        completed,
        assignedToId: assignedToId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      };
      if (columnId && columnId !== task.columnId) {
        payload.columnId = columnId;
      }
      return updateTask(task.id, payload);
    },
    onSuccess: () => {
      toast.success('Task updated');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!task) throw new Error('No task');
      return deleteTask(task.id);
    },
    onSuccess: () => {
      toast.success('Task deleted');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to delete'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    saveMutation.mutate();
  }

  if (!task) return null;

  return (
    <Modal open={open} onClose={onClose} title="Task details" maxWidth="max-w-3xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
            completed
              ? 'border-emerald-400/40 bg-emerald-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-emerald-400 focus:ring-emerald-400 focus:ring-offset-slate-900"
          />
          <span className={`text-sm font-medium ${completed ? 'text-emerald-200' : 'text-slate-200'}`}>
            {completed ? 'Marked as completed' : 'Mark as completed'}
          </span>
        </label>

        <div>
          <label className="label">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="label">Status (column)</label>
          <select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="input"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Move this task to another column. Equivalent to drag-drop.
          </p>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[100px] resize-y"
            placeholder="Add a more detailed description..."
            maxLength={5000}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Assignee</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="input"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name} ({m.user.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Due date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this task?')) deleteMutation.mutate();
            }}
            className="btn-danger"
            disabled={deleteMutation.isPending}
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-white/10 pt-5 md:grid-cols-2">
        <TaskAttachments taskId={task.id} />
        <TaskComments taskId={task.id} />
      </div>
    </Modal>
  );
}
