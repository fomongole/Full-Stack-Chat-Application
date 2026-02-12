import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Message } from '@/types';

interface UseSocketListenersProps {
    socket: Socket | null;
    activeUserId: string | null;
    onConversationJoined: (data: { conversationId: string }) => void;
    onHistoryLoaded: (data: { messages: Message[]; hasMore: boolean }) => void;
    onMoreMessagesLoaded: (data: { messages: Message[]; hasMore: boolean }) => void;
    onMessageReceived: (message: Message) => void;
    onMessageDeleted: (message: Message) => void;
    onUserTyping: (data: { userId: string }) => void;
    onUserStopTyping: (data: { userId: string }) => void;
    onMessagesRead: (data: { conversationId: string; readerId: string }) => void;
    onMessageError: (data: { message: string }) => void;
    onSocketError: (data: { message: string }) => void;
}

/**
 * Pure socket listener orchestration hook.
 * Responsible ONLY for socket lifecycle, joining, and event delegation.
 * * Added Error Listeners for robust feedback.
 */
export const useSocketListeners = ({
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
                                       onMessageError,
                                       onSocketError,
                                   }: UseSocketListenersProps) => {
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

        // Error Events
        socket.on('message_error', onMessageError);
        socket.on('error', onSocketError);

        return () => {
            socket.off('conversation_joined', onConversationJoined);
            socket.off('load_history', onHistoryLoaded);
            socket.off('more_messages_loaded', onMoreMessagesLoaded);
            socket.off('receive_message', onMessageReceived);
            socket.off('message_deleted', onMessageDeleted);
            socket.off('user_typing', onUserTyping);
            socket.off('user_stop_typing', onUserStopTyping);
            socket.off('messages_read', onMessagesRead);
            socket.off('message_error', onMessageError);
            socket.off('error', onSocketError);
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
        onMessageError,
        onSocketError
    ]);
};