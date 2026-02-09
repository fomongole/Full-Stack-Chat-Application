'use client';
import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/types';

/**
 * Pure message state management hook.
 * Fixed: Removed cascading render loops and simplified state resets.
 */
export const useMessageState = (activeUserId: string | null) => {
    // Note: We rely on the parent component (ChatPage) to use key={activeUserId}
    // to reset this hook's state when the user changes.
    const [chatHistory, setChatHistory] = useState<(Message & { isLocal?: boolean })[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isRemoteTyping, setIsRemoteTyping] = useState(false);

    // Initial load handler
    const handleHistoryLoaded = useCallback(
        (data: { messages: Message[]; hasMore: boolean }) => {
            setChatHistory(data.messages);
            setHasMore(data.hasMore);
            setIsLoadingHistory(false);
            setIsLoadingMore(false);
        },
        []
    );

    // Pagination handler (Prepends messages)
    const handleMoreMessagesLoaded = useCallback(
        (data: { messages: Message[]; hasMore: boolean }) => {
            if (data.messages.length > 0) {
                setChatHistory((prev) => [...data.messages, ...prev]);
            }
            setHasMore(data.hasMore);
            setIsLoadingMore(false);
        },
        []
    );

    // Real-time message handler
    const handleMessageReceived = useCallback((newMessage: Message) => {
        setChatHistory((prev) => {
            // 1. Check if we already have this ID (deduplication)
            if (prev.some((m) => m.id === newMessage.id)) {
                return prev;
            }

            // 2. Remove optimistic/temporary version if exists
            // (Matches by local ID or attachment URL)
            const filtered = prev.filter(
                (m) =>
                    !m.isLocal ||
                    (m.isLocal &&
                        m.attachmentUrl !== newMessage.attachmentUrl &&
                        m.id !== newMessage.id)
            );

            return [...filtered, newMessage];
        });
    }, []);

    const handleMessageDeleted = useCallback((deletedMsg: Message) => {
        setChatHistory((prev) =>
            prev.map((msg) => (msg.id === deletedMsg.id ? deletedMsg : msg))
        );
    }, []);

    const handleUserTyping = useCallback(
        (data: { userId: string }) => {
            if (data.userId === activeUserId) {
                setIsRemoteTyping(true);
            }
        },
        [activeUserId]
    );

    const handleUserStopTyping = useCallback(
        (data: { userId: string }) => {
            if (data.userId === activeUserId) {
                setIsRemoteTyping(false);
            }
        },
        [activeUserId]
    );

    const handleMessagesRead = useCallback(
        (data: { conversationId: string; readerId: string }) => {
            setChatHistory((prev) => prev.map((msg) => ({ ...msg, isRead: true })));
        },
        []
    );

    const addOptimisticMessage = useCallback((message: Message & { isLocal?: boolean }) => {
        setChatHistory((prev) => [...prev, message]);
    }, []);

    const updateOptimisticMessage = useCallback(
        (tempId: string, updates: Partial<Message>) => {
            setChatHistory((prev) =>
                prev.map((msg) => (msg.id === tempId ? { ...msg, ...updates } : msg))
            );
        },
        []
    );

    const removeOptimisticMessage = useCallback((tempId: string) => {
        setChatHistory((prev) => prev.filter((m) => m.id !== tempId));
    }, []);

    const startLoadingMore = useCallback(() => {
        setIsLoadingMore(true);
    }, []);

    const handleConversationJoined = useCallback((data: { conversationId: string }) => {
        setConversationId(data.conversationId);
    }, []);

    return {
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
    };
};