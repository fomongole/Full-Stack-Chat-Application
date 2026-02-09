import { useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { useMessageState } from './useMessageState';
import { useSocketEmitters } from './useSocketEmitters'; // New import
import { useSocketListeners } from './useSocketListeners'; // New import
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
    const activeUserId = activeUser?.id ?? null;

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

    // Get socket emitters first to avoid circular dependencies
    const {
        markAsRead,
        loadMoreMessages: socketLoadMore,
        emitTyping,
        emitStopTyping,
    } = useSocketEmitters({ socket });

    // Define stable callbacks that can depend on emitters
    // const onConversationJoined = useCallback(
    //     (data: { conversationId: string }) => {
    //         handleConversationJoined(data);
    //         // Mark as read on join
    //         if (activeUserId) {
    //             markAsRead(data.conversationId, activeUserId);
    //         }
    //     },
    //     [handleConversationJoined, markAsRead, activeUserId]
    // );

    // Remove useCallback and the dependency array entirely
    const onConversationJoined = (data: { conversationId: string }) => {
        handleConversationJoined(data);
        if (activeUser?.id) {
            markAsRead(data.conversationId, activeUser.id);
        }
    };

    const onMessageReceived = useCallback(
        (message) => {
            handleMessageReceived(message);
            // Stop typing indicator
            if (message.authorId === activeUserId) {
                setIsRemoteTyping(false);
            }
            // Mark as read if visible and in current conversation
            if (
                document.visibilityState === 'visible' &&
                message.conversationId === conversationId &&
                activeUserId
            ) {
                markAsRead(message.conversationId, activeUserId);
            }
        },
        [
            handleMessageReceived,
            activeUserId,
            conversationId,
            setIsRemoteTyping,
            markAsRead,
        ]
    );

    // 2. SOCKET EVENT ORCHESTRATION (split into emitters and listeners)
    useSocketListeners({
        socket,
        activeUserId: activeUser?.id || null,
        onConversationJoined,
        onHistoryLoaded: handleHistoryLoaded,
        onMoreMessagesLoaded: handleMoreMessagesLoaded,
        onMessageReceived,
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