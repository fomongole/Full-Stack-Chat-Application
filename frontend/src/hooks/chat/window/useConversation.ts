import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { Message, User } from '@/types';
import { useMessageState } from './useMessageState';
import { useSocketEmitters } from './useSocketEmitters';
import { useSocketListeners } from './useSocketListeners';
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

    // --- SYNC REFS FOR EVENT HANDLERS ---
    // We use refs so we can read the LATEST values inside the callback
    // without forcing the callback to be recreated when these values change.
    // This prevents the socket listeners from detaching/reattaching on every render.
    const activeUserIdRef = useRef(activeUserId);
    const conversationIdRef = useRef(conversationId);

    useEffect(() => {
        activeUserIdRef.current = activeUserId;
    }, [activeUserId]);

    useEffect(() => {
        conversationIdRef.current = conversationId;
    }, [conversationId]);

    // Define stable callbacks that can depend on emitters
    // wrapped in useCallback to prevent re-subscription loops in useSocketListeners
    const onConversationJoined = useCallback(
        (data: { conversationId: string }) => {
            handleConversationJoined(data);
            // Access ref to get current activeUserId without breaking stability
            if (activeUserIdRef.current) {
                markAsRead(data.conversationId, activeUserIdRef.current);
            }
        },
        [handleConversationJoined, markAsRead]
    );

    const onMessageReceived = useCallback(
        (message: Message) => {
            handleMessageReceived(message);

            // Access ref to check typing status
            if (message.authorId === activeUserIdRef.current) {
                setIsRemoteTyping(false);
            }

            // Access ref to check visibility/read status
            if (
                document.visibilityState === 'visible' &&
                message.conversationId === conversationIdRef.current &&
                activeUserIdRef.current
            ) {
                markAsRead(message.conversationId, activeUserIdRef.current);
            }
        },
        [handleMessageReceived, setIsRemoteTyping, markAsRead]
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