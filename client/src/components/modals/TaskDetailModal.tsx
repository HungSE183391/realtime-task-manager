import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setAssignedToId(task.assignedToId ?? '');
      setDueDate(toLocalInputValue(task.dueDate));
      setColumnId(task.columnId);
      setCompleted(task.completed);
      setActiveTab('details');
    }
  }, [task]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
      if (columnId && columnId !== task.columnId) payload.columnId = columnId;
      return updateTask(task.id, payload);
    },
    onSuccess: () => { toast.success('Task updated'); onClose(); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!task) throw new Error('No task');
      return deleteTask(task.id);
    },
    onSuccess: () => { toast.success('Task deleted'); onClose(); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to delete'),
  });

  if (!task) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[#080c14]/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          {/* Modal panel */}
          <motion.div
            className="glass-strong relative flex w-full max-w-2xl flex-col shadow-panel max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.93, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
              <div className="min-w-0 flex-1">
                {/* Completion toggle inline */}
                <button
                  type="button"
                  onClick={() => setCompleted((v) => !v)}
                  className={`mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                    completed
                      ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-400/25'
                      : 'bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.07] hover:bg-white/[0.07] hover:text-slate-300'
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all ${
                    completed ? 'border-emerald-400 bg-emerald-400 text-[#080c14]' : 'border-slate-600'
                  }`}>
                    {completed && (
                      <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5">
                        <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {completed ? 'Completed' : 'Mark as complete'}
                </button>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-[18px] font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                  placeholder="Task title…"
                  required
                  maxLength={200}
                />
              </div>
              <motion.button
                onClick={onClose}
                className="btn-icon h-7 w-7 shrink-0"
                aria-label="Close"
                whileHover={{ rotate: 90 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </motion.button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.07]">
              {(['details', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 text-[13px] font-medium capitalize transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-violet-400 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'details' ? (
                  <motion.form
                    key="details"
                    onSubmit={(e: FormEvent) => { e.preventDefault(); if (!title.trim()) return; saveMutation.mutate(); }}
                    className="space-y-5 p-5"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Status / Column */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label">Status</label>
                        <select
                          value={columnId}
                          onChange={(e) => setColumnId(e.target.value)}
                          className="input text-[13px]"
                        >
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label">Assignee</label>
                        <select
                          value={assignedToId}
                          onChange={(e) => setAssignedToId(e.target.value)}
                          className="input text-[13px]"
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Due date */}
                    <div>
                      <label className="label">Due date</label>
                      <input
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="input text-[13px]"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="label">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="input min-h-[100px] resize-y text-[13px]"
                        placeholder="Add a description…"
                        maxLength={5000}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between border-t border-white/[0.07] pt-4">
                      <button
                        type="button"
                        onClick={() => { if (confirm('Delete this task?')) deleteMutation.mutate(); }}
                        className="btn-danger text-[13px]"
                        disabled={deleteMutation.isPending}
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M6.5 1.75a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3zM2 4.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H13l-.5 7.5A2 2 0 0110.5 14.5h-5A2 2 0 013.5 12.5L3 5H2.75A.75.75 0 012 4.25z" />
                        </svg>
                        Delete task
                      </button>
                      <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary text-[13px]">
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-primary text-[13px]"
                          disabled={saveMutation.isPending}
                        >
                          {saveMutation.isPending ? (
                            <span className="flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Saving…
                            </span>
                          ) : 'Save changes'}
                        </button>
                      </div>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div
                    key="activity"
                    className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <TaskComments taskId={task.id} />
                    <TaskAttachments taskId={task.id} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
