import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Message } from '@/types';

interface UseSocketEventsProps {
    socket: Socket | null;
    activeUserId: string | null;
    currentUserId: string | null;
    conversationId: string | null;
    onConversationJoined: (data: { conversationId: string }) => void;
    onHistoryLoaded: (data: { messages: Message[]; hasMore: boolean }) => void;
    onMoreMessagesLoaded: (data: { messages: Message[]; hasMore: boolean }) => void;
    onMessageReceived: (message: Message) => void;
    onMessageDeleted: (message: Message) => void;
    onUserTyping: (data: { userId: string }) => void;
    onUserStopTyping: (data: { userId: string }) => void;
    onMessagesRead: (data: { conversationId: string; readerId: string }) => void;
}

/**
 * Pure socket event orchestration hook.
 * Responsible ONLY for socket lifecycle and event delegation.
 */
export const useSocketEvents = ({
                                    socket,
                                    activeUserId,
                                    currentUserId,
                                    conversationId,
                                    onConversationJoined,
                                    onHistoryLoaded,
                                    onMoreMessagesLoaded,
                                    onMessageReceived,
                                    onMessageDeleted,
                                    onUserTyping,
                                    onUserStopTyping,
                                    onMessagesRead,
                                }: UseSocketEventsProps) => {
    const activeUserIdRef = useRef(activeUserId);
    const conversationIdRef = useRef(conversationId);

    // Keep refs in sync
    useEffect(() => {
        activeUserIdRef.current = activeUserId;
    }, [activeUserId]);

    useEffect(() => {
        conversationIdRef.current = conversationId;
    }, [conversationId]);

    useEffect(() => {
        if (!socket || !activeUserId) return;

        // Join conversation
        socket.emit('join_conversation', { recipientId: activeUserId });

        // Attach event listeners
        socket.on('conversation_joined', onConversationJoined);
        socket.on('load_history', onHistoryLoaded);
        socket.on('more_messages_loaded', onMoreMessagesLoaded);
        socket.on('receive_message', onMessageReceived);
        socket.on('message_deleted', onMessageDeleted);
        socket.on('user_typing', onUserTyping);
        socket.on('user_stop_typing', onUserStopTyping);
        socket.on('messages_read', onMessagesRead);

        return () => {
            socket.off('conversation_joined', onConversationJoined);
            socket.off('load_history', onHistoryLoaded);
            socket.off('more_messages_loaded', onMoreMessagesLoaded);
            socket.off('receive_message', onMessageReceived);
            socket.off('message_deleted', onMessageDeleted);
            socket.off('user_typing', onUserTyping);
            socket.off('user_stop_typing', onUserStopTyping);
            socket.off('messages_read', onMessagesRead);
        };
    }, [
        socket,
        activeUserId,
        onConversationJoined,
        onHistoryLoaded,
        onMoreMessagesLoaded,
        onMessageReceived,
        onMessageDeleted,
        onUserTyping,
        onUserStopTyping,
        onMessagesRead,
    ]);

    // Socket action emitters
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
        activeUserIdRef,
        conversationIdRef,
    };
};