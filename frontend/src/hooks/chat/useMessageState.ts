import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/types';

/**
 * Pure message state management hook.
 * No socket logic, no scroll logic - just state.
 */
export const useMessageState = (activeUserId: string | null) => {
    const [chatHistory, setChatHistory] = useState<(Message & { isLocal?: boolean })[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isRemoteTyping, setIsRemoteTyping] = useState(false);

    // Reset state when active user changes
    useEffect(() => {
        if (activeUserId) {
            setChatHistory([]);
            setIsLoadingHistory(true);
            setHasMore(false);
            setIsLoadingMore(false);
            setIsRemoteTyping(false);
        }
    }, [activeUserId]);

    // State update handlers
    const handleConversationJoined = useCallback((data: { conversationId: string }) => {
        setConversationId(data.conversationId);
    }, []);

    const handleHistoryLoaded = useCallback(
        (data: { messages: Message[]; hasMore: boolean }) => {
            setChatHistory(data.messages);
            setHasMore(data.hasMore);
            setIsLoadingHistory(false);
        },
        []
    );

    const handleMoreMessagesLoaded = useCallback(
        (data: { messages: Message[]; hasMore: boolean }) => {
            setChatHistory((prev) => [...data.messages, ...prev]);
            setHasMore(data.hasMore);
            setIsLoadingMore(false);
        },
        []
    );

    const handleMessageReceived = useCallback((newMessage: Message) => {
        setChatHistory((prev) => {
            // Remove optimistic message if exists
            const filtered = prev.filter(
                (m) =>
                    !m.isLocal ||
                    (m.isLocal &&
                        m.attachmentUrl !== newMessage.attachmentUrl &&
                        m.id !== newMessage.id)
            );
            // Prevent duplicates
            if (filtered.some((m) => m.id === newMessage.id)) return filtered;
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