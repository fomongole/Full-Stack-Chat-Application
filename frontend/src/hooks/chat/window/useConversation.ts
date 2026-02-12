import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { Message, User } from '@/types';
import { toast } from 'sonner';
import { useMessageState } from './useMessageState';
import { useSocketEmitters } from './useSocketEmitters';
import { useSocketListeners } from './useSocketListeners';
import { useMessageActions } from './useMessageActions';
import { useScrollBehavior } from './useScrollBehavior';

/**
 * Refactored useConversation hook.
 * Now a clean facade that composes smaller, focused hooks.
 * Each concern is properly separated and testable.
 * * Enforces Block Logic & Error Handling.
 */
export const useConversation = (activeUser: User | null) => {
    const socket = useSocket();
    const currentUser = useAuthStore((state) => state.user);

    // STRICT BLOCK CHECK
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
    const activeUserIdRef = useRef(activeUserId);
    const conversationIdRef = useRef(conversationId);
    const isBlockedRef = useRef(isBlocked);

    useEffect(() => {
        activeUserIdRef.current = activeUserId;
        isBlockedRef.current = isBlocked;
    }, [activeUserId, isBlocked]);

    useEffect(() => {
        conversationIdRef.current = conversationId;
    }, [conversationId]);

    // --- STABLE CALLBACKS WITH LOGIC GATES ---

    const onConversationJoined = useCallback(
        (data: { conversationId: string }) => {
            handleConversationJoined(data);
            // Don't send read receipts if blocked (Blackout logic)
            if (activeUserIdRef.current && !isBlockedRef.current) {
                markAsRead(data.conversationId, activeUserIdRef.current);
            }
        },
        [handleConversationJoined, markAsRead]
    );

    const onMessageReceived = useCallback(
        (message: Message) => {
            handleMessageReceived(message);

            // Stop typing indicator
            if (message.authorId === activeUserIdRef.current) {
                setIsRemoteTyping(false);
            }

            // Read Receipts: Only if visible and NOT blocked
            if (
                document.visibilityState === 'visible' &&
                message.conversationId === conversationIdRef.current &&
                activeUserIdRef.current &&
                !isBlockedRef.current
            ) {
                markAsRead(message.conversationId, activeUserIdRef.current);
            }
        },
        [handleMessageReceived, setIsRemoteTyping, markAsRead]
    );

    // Filter Typing Events based on Block Status
    const onUserTypingWrapper = useCallback((data: { userId: string }) => {
        if (isBlockedRef.current) return;
        handleUserTyping(data);
    }, [handleUserTyping]);

    // Error Handlers
    const handleSocketError = useCallback((data: { message: string }) => {
        toast.error(data.message || 'An unexpected error occurred');
    }, []);

    // 2. SOCKET EVENT ORCHESTRATION
    useSocketListeners({
        socket,
        activeUserId: activeUser?.id || null,
        onConversationJoined,
        onHistoryLoaded: handleHistoryLoaded,
        onMoreMessagesLoaded: handleMoreMessagesLoaded,
        onMessageReceived,
        onMessageDeleted: handleMessageDeleted,
        onUserTyping: onUserTypingWrapper,
        onUserStopTyping: handleUserStopTyping,
        onMessagesRead: handleMessagesRead,
        onMessageError: handleSocketError,
        onSocketError: handleSocketError,
    });

    // 3. SCROLL BEHAVIOR
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

    // 4. MESSAGE ACTIONS
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
        chatHistory,
        isLoadingHistory,
        isLoadingMore,
        conversationId,
        isRemoteTyping: isBlocked ? false : isRemoteTyping,
        message,
        setMessage,
        replyTo,
        setReplyTo,
        sendMessage,
        sendMediaMessage,
        deleteMessage,
        containerRef,
        unreadBelowCount,
        handleScroll,
        scrollToBottom,
        scrollToBottomInstant,
        isBlocked: isBlocked || false,
    };
};