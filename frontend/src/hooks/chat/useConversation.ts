import { useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { useMessageState } from './useMessageState';
import { useSocketEvents } from './useSocketEvents';
import { useMessageActions } from './useMessageActions';
import { useScrollBehavior } from './useScrollBehavior';

/**
 * Refactored useConversation hook.
 * Now a clean facade that composes smaller, focused hooks.
 * Each concern is properly separated and testable.
 */
export const useConversation = (activeUser: User | null) => {
    const socket = useSocket();
    const currentUser = useAuthStore((state) => state.user);
    const isBlocked = activeUser?.hasBlocked || activeUser?.isBlockedBy;

    // 1. MESSAGE STATE MANAGEMENT (pure state, no side effects)
    const {
        chatHistory,
        isLoadingHistory,
        hasMore,
        isLoadingMore,
        conversationId,
        isRemoteTyping,
        setIsRemoteTyping,
        handleConversationJoined,
        handleHistoryLoaded,
        handleMoreMessagesLoaded,
        handleMessageReceived,
        handleMessageDeleted,
        handleUserTyping,
        handleUserStopTyping,
        handleMessagesRead,
        addOptimisticMessage,
        updateOptimisticMessage,
        removeOptimisticMessage,
        startLoadingMore,
    } = useMessageState(activeUser?.id || null);

    // 2. SOCKET EVENT ORCHESTRATION (pure event handling)
    const {
        markAsRead,
        loadMoreMessages: socketLoadMore,
        emitTyping,
        emitStopTyping,
        activeUserIdRef,
        conversationIdRef,
    } = useSocketEvents({
        socket,
        activeUserId: activeUser?.id || null,
        currentUserId: currentUser?.id || null,
        conversationId,
        onConversationJoined: useCallback(
            (data: { conversationId: string }) => {
                handleConversationJoined(data);
                // Mark as read on join
                if (activeUser?.id) {
                    markAsRead(data.conversationId, activeUser.id);
                }
            },
            [handleConversationJoined, markAsRead, activeUser?.id]
        ),
        onHistoryLoaded: handleHistoryLoaded,
        onMoreMessagesLoaded: handleMoreMessagesLoaded,
        onMessageReceived: useCallback(
            (message) => {
                handleMessageReceived(message);
                // Stop typing indicator
                if (message.authorId === activeUser?.id) {
                    setIsRemoteTyping(false);
                }
                // Mark as read if visible and in current conversation
                if (
                    document.visibilityState === 'visible' &&
                    message.conversationId === conversationId &&
                    activeUser?.id
                ) {
                    markAsRead(message.conversationId, activeUser.id);
                }
            },
            [
                handleMessageReceived,
                activeUser?.id,
                conversationId,
                setIsRemoteTyping,
                markAsRead,
            ]
        ),
        onMessageDeleted: handleMessageDeleted,
        onUserTyping: handleUserTyping,
        onUserStopTyping: handleUserStopTyping,
        onMessagesRead: handleMessagesRead,
    });

    // 3. SCROLL BEHAVIOR (scroll state and unread tracking)
    const {
        containerRef,
        unreadBelowCount,
        handleScroll,
        scrollToBottom,
        scrollToBottomInstant,
    } = useScrollBehavior({
        chatHistory,
        hasMore,
        isLoadingMore,
        currentUserId: currentUser?.id || null,
        activeUserId: activeUser?.id || null,
        loadMoreMessages: useCallback(
            (convId: string, cursor: string) => {
                startLoadingMore();
                socketLoadMore(convId, cursor);
            },
            [startLoadingMore, socketLoadMore]
        ),
        conversationId,
        markAsRead,
    });

    // 4. MESSAGE ACTIONS (send, delete, typing)
    const {
        message,
        setMessage,
        replyTo,
        setReplyTo,
        sendMessage,
        sendMediaMessage,
        deleteMessage,
    } = useMessageActions({
        socket,
        currentUser,
        activeUser,
        conversationId,
        isBlocked: isBlocked || false,
        addOptimisticMessage,
        updateOptimisticMessage,
        removeOptimisticMessage,
        emitTyping,
        emitStopTyping,
    });

    return {
        // Message state
        chatHistory,
        isLoadingHistory,
        isLoadingMore,
        conversationId,
        isRemoteTyping,

        // Message actions
        message,
        setMessage,
        replyTo,
        setReplyTo,
        sendMessage,
        sendMediaMessage,
        deleteMessage,

        // Scroll behavior
        containerRef,
        unreadBelowCount,
        handleScroll,
        scrollToBottom,
        scrollToBottomInstant,

        // Metadata
        isBlocked: isBlocked || false,
    };
};