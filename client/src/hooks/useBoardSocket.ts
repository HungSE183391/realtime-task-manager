import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';
import type {
  Attachment,
  BoardDetail,
  BoardSummary,
  Column,
  Comment,
  Task,
  BoardMember,
  Message,
} from '../types';

/**
 * Joins the Socket.IO room for `boardId` and patches the React Query cache
 * (key: ['board', boardId]) when realtime events arrive.
 */
export function useBoardSocket(boardId: string | undefined) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  useEffect(() => {
    if (!boardId || !token) return;
    const socket = getSocket(token);

    const queryKey = ['board', boardId] as const;

    const join = () => {
      socket.emit('join_board', boardId, (ok: boolean, err?: string) => {
        if (!ok) console.warn('[socket] join_board failed:', err);
      });
    };
    if (socket.connected) join();
    else socket.once('connect', join);

    const updateBoard = (mutator: (b: BoardDetail) => BoardDetail) => {
      queryClient.setQueryData<{ board: BoardDetail; role: string }>(queryKey, (old) =>
        old ? { ...old, board: mutator(old.board) } : old,
      );
    };

    const onColumnCreated = ({ column }: { column: Column }) => {
      updateBoard((b) => {
        if (b.columns.some((c) => c.id === column.id)) return b;
        return {
          ...b,
          columns: [...b.columns, { ...column, tasks: column.tasks ?? [] }].sort(
            (a, c) => a.position - c.position,
          ),
        };
      });
    };

    const onColumnUpdated = ({ column }: { column: Column }) => {
      updateBoard((b) => ({
        ...b,
        columns: b.columns
          .map((c) => (c.id === column.id ? { ...c, ...column, tasks: c.tasks } : c))
          .sort((a, c) => a.position - c.position),
      }));
    };

    const onColumnDeleted = ({ columnId }: { columnId: string }) => {
      updateBoard((b) => ({ ...b, columns: b.columns.filter((c) => c.id !== columnId) }));
    };

    const onTaskCreated = ({ task }: { task: Task }) => {
      updateBoard((b) => ({
        ...b,
        columns: b.columns.map((c) =>
          c.id === task.columnId
            ? c.tasks.some((t) => t.id === task.id)
              ? c
              : { ...c, tasks: [...c.tasks, task].sort((a, x) => a.position - x.position) }
            : c,
        ),
      }));
    };

    const onTaskUpdated = ({ task }: { task: Task }) => {
      updateBoard((b) => ({
        ...b,
        columns: b.columns.map((c) =>
          c.id === task.columnId
            ? {
                ...c,
                tasks: c.tasks
                  .map((t) => (t.id === task.id ? task : t))
                  .sort((a, x) => a.position - x.position),
              }
            : c,
        ),
      }));
    };

    const onTaskMoved = ({
      task,
      fromColumnId,
      toColumnId,
    }: {
      task: Task;
      fromColumnId: string;
      toColumnId: string;
    }) => {
      updateBoard((b) => ({
        ...b,
        columns: b.columns.map((c) => {
          if (c.id === fromColumnId && fromColumnId !== toColumnId) {
            return { ...c, tasks: c.tasks.filter((t) => t.id !== task.id) };
          }
          if (c.id === toColumnId) {
            const without = c.tasks.filter((t) => t.id !== task.id);
            return {
              ...c,
              tasks: [...without, task].sort((a, x) => a.position - x.position),
            };
          }
          return c;
        }),
      }));
    };

    const onTaskDeleted = ({ taskId }: { taskId: string }) => {
      updateBoard((b) => ({
        ...b,
        columns: b.columns.map((c) => ({
          ...c,
          tasks: c.tasks.filter((t) => t.id !== taskId),
        })),
      }));
    };

    const onMemberJoined = ({ member }: { member: BoardMember }) => {
      updateBoard((b) =>
        b.members.some((m) => m.userId === member.userId)
          ? b
          : { ...b, members: [...b.members, member] },
      );
    };

    const onMemberLeft = ({ userId }: { userId: string }) => {
      updateBoard((b) => ({ ...b, members: b.members.filter((m) => m.userId !== userId) }));
    };

    const onBoardUpdated = ({ board }: { board: Pick<BoardDetail, 'id' | 'title'> }) => {
      updateBoard((b) => ({ ...b, title: board.title }));
      queryClient.setQueryData<BoardSummary[]>(['boards'], (old) =>
        old ? old.map((b) => (b.id === board.id ? { ...b, title: board.title } : b)) : old,
      );
    };

    const onBoardDeleted = () => {
      queryClient.removeQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast('This board was deleted', { icon: 'ℹ️' });
      navigate('/', { replace: true });
    };

    const onMessageCreated = ({ message }: { message: Message }) => {
      queryClient.setQueryData<Message[]>(['messages', boardId], (old) => {
        if (!old) return [message];
        if (old.some((m) => m.id === message.id)) return old;
        return [...old, message];
      });
    };

    const bumpTaskCount = (
      taskId: string,
      key: 'comments' | 'attachments',
      delta: number,
    ) => {
      updateBoard((b) => ({
        ...b,
        columns: b.columns.map((c) => ({
          ...c,
          tasks: c.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const cur = t._count ?? { comments: 0, attachments: 0 };
            return {
              ...t,
              _count: { ...cur, [key]: Math.max(0, (cur[key] ?? 0) + delta) },
            };
          }),
        })),
      }));
    };

    const onCommentCreated = ({
      comment,
      taskId,
    }: {
      comment: Comment;
      taskId: string;
    }) => {
      queryClient.setQueryData<Comment[]>(['comments', taskId], (old) => {
        if (!old) return [comment];
        if (old.some((c) => c.id === comment.id)) return old;
        return [...old, comment];
      });
      bumpTaskCount(taskId, 'comments', +1);
    };

    const onCommentDeleted = ({
      commentId,
      taskId,
    }: {
      commentId: string;
      taskId: string;
    }) => {
      queryClient.setQueryData<Comment[]>(['comments', taskId], (old) =>
        old ? old.filter((c) => c.id !== commentId) : old,
      );
      bumpTaskCount(taskId, 'comments', -1);
    };

    const onAttachmentCreated = ({
      attachment,
      taskId,
    }: {
      attachment: Attachment;
      taskId: string;
    }) => {
      queryClient.setQueryData<Attachment[]>(['attachments', taskId], (old) => {
        if (!old) return [attachment];
        if (old.some((a) => a.id === attachment.id)) return old;
        return [attachment, ...old];
      });
      bumpTaskCount(taskId, 'attachments', +1);
    };

    const onAttachmentDeleted = ({
      attachmentId,
      taskId,
    }: {
      attachmentId: string;
      taskId: string;
    }) => {
      queryClient.setQueryData<Attachment[]>(['attachments', taskId], (old) =>
        old ? old.filter((a) => a.id !== attachmentId) : old,
      );
      bumpTaskCount(taskId, 'attachments', -1);
    };

    socket.on('column:created', onColumnCreated);
    socket.on('column:updated', onColumnUpdated);
    socket.on('column:deleted', onColumnDeleted);
    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:moved', onTaskMoved);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('member:joined', onMemberJoined);
    socket.on('member:left', onMemberLeft);
    socket.on('board:updated', onBoardUpdated);
    socket.on('board:deleted', onBoardDeleted);
    socket.on('message:created', onMessageCreated);
    socket.on('comment:created', onCommentCreated);
    socket.on('comment:deleted', onCommentDeleted);
    socket.on('attachment:created', onAttachmentCreated);
    socket.on('attachment:deleted', onAttachmentDeleted);

    return () => {
      socket.emit('leave_board', boardId);
      socket.off('column:created', onColumnCreated);
      socket.off('column:updated', onColumnUpdated);
      socket.off('column:deleted', onColumnDeleted);
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:moved', onTaskMoved);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('member:joined', onMemberJoined);
      socket.off('member:left', onMemberLeft);
      socket.off('board:updated', onBoardUpdated);
      socket.off('board:deleted', onBoardDeleted);
      socket.off('message:created', onMessageCreated);
      socket.off('comment:created', onCommentCreated);
      socket.off('comment:deleted', onCommentDeleted);
      socket.off('attachment:created', onAttachmentCreated);
      socket.off('attachment:deleted', onAttachmentDeleted);
    };
  }, [boardId, token, queryClient, navigate]);
}
