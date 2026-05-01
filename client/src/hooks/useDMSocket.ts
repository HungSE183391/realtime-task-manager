import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../lib/socket';
import type { DirectMessage, DMConversation } from '../types';

/**
 * Globally listens for incoming/outgoing DM events for the current user, and
 * keeps both the conversation list cache and per-conversation message caches
 * in sync. Mount this once near the top of the authenticated tree (e.g. in
 * the Header), as the Socket.IO server auto-joins the user's personal room
 * `user:<userId>` on connect.
 */
export function useDMSocket() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!token || !me) return;
    const socket = getSocket(token);

    const onDMCreated = ({ message }: { message: DirectMessage }) => {
      const otherId = message.fromUserId === me ? message.toUserId : message.fromUserId;
      const otherUser = message.fromUserId === me ? message.toUser : message.fromUser;

      // Update messages cache for the conversation with `otherId`.
      queryClient.setQueryData<DirectMessage[]>(['dm', otherId], (old) => {
        if (!old) return [message];
        if (old.some((m) => m.id === message.id)) return old;
        return [...old, message];
      });

      // Update the conversations summary list.
      queryClient.setQueryData<DMConversation[]>(['dm-conversations'], (old) => {
        const list = old ? [...old] : [];
        const idx = list.findIndex((c) => c.otherUser.id === otherId);
        const isIncoming = message.toUserId === me;
        if (idx >= 0) {
          const prev = list[idx];
          list[idx] = {
            ...prev,
            otherUser,
            latestMessage: message,
            unreadCount: isIncoming ? prev.unreadCount + 1 : prev.unreadCount,
          };
        } else {
          list.push({
            otherUser,
            latestMessage: message,
            unreadCount: isIncoming ? 1 : 0,
          });
        }
        // Newest activity first.
        list.sort(
          (a, b) =>
            new Date(b.latestMessage.createdAt).getTime() -
            new Date(a.latestMessage.createdAt).getTime(),
        );
        return list;
      });
    };

    // The other side has read our messages -> mark all our sent ones as read.
    const onDMRead = ({ byUserId }: { byUserId: string }) => {
      queryClient.setQueryData<DirectMessage[]>(['dm', byUserId], (old) => {
        if (!old) return old;
        const now = new Date().toISOString();
        return old.map((m) =>
          m.toUserId === byUserId && !m.readAt ? { ...m, readAt: now } : m,
        );
      });
    };

    socket.on('dm:created', onDMCreated);
    socket.on('dm:read', onDMRead);

    return () => {
      socket.off('dm:created', onDMCreated);
      socket.off('dm:read', onDMRead);
    };
  }, [token, me, queryClient]);
}
