import { useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseSocketEmittersProps {
    socket: Socket | null;
}

/**
 * Hook for socket emitter functions only.
 * Separated from listeners to avoid circular dependencies.
 * Each emitter is stable and memoized.
 */
export const useSocketEmitters = ({ socket }: UseSocketEmittersProps) => {
    const markAsRead = useCallback(
        (conversationId: string, recipientId: string) => {
            socket?.emit('mark_as_read', { conversationId, recipientId });
        },
        [socket]
    );

    const loadMoreMessages = useCallback(
        (conversationId: string, cursor: string) => {
            socket?.emit('load_more_messages', { conversationId, cursor });
        },
        [socket]
    );

    const emitTyping = useCallback(
        (conversationId: string, recipientId: string) => {
            socket?.emit('typing', { conversationId, recipientId });
        },
        [socket]
    );

    const emitStopTyping = useCallback(
        (conversationId: string, recipientId: string) => {
            socket?.emit('stop_typing', { conversationId, recipientId });
        },
        [socket]
    );

    return {
        markAsRead,
        loadMoreMessages,
        emitTyping,
        emitStopTyping,
    };
};