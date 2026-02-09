import { useState, useRef, useCallback, useEffect } from 'react';
import { Message } from '@/types';

interface UseScrollBehaviorProps {
    chatHistory: Message[];
    hasMore: boolean;
    isLoadingMore: boolean;
    currentUserId: string | null;
    activeUserId: string | null;
    loadMoreMessages: (conversationId: string, cursor: string) => void;
    conversationId: string | null;
    markAsRead: (conversationId: string, recipientId: string) => void;
}

/**
 * Scroll behavior and unread message tracking.
 * Handles pagination triggers and unread counts without cascading renders.
 */
export const useScrollBehavior = ({
                                      chatHistory,
                                      hasMore,
                                      isLoadingMore,
                                      currentUserId,
                                      activeUserId,
                                      loadMoreMessages,
                                      conversationId,
                                      markAsRead,
                                  }: UseScrollBehaviorProps) => {
    const [unreadBelowCount, setUnreadBelowCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // We use a ref to track the latest message ID to detect NEW incoming messages
    // vs simply re-rendering existing ones.
    const lastProcessedMessageId = useRef<string | null>(null);

    /**
     * Effect: Track incoming messages for unread counting
     * Optimized to avoid set-state loops.
     */
    useEffect(() => {
        if (chatHistory.length === 0) return;

        const lastMessage = chatHistory[chatHistory.length - 1];

        // If this is the same message we already processed, ignore.
        if (lastProcessedMessageId.current === lastMessage.id) return;
        lastProcessedMessageId.current = lastMessage.id;

        const container = containerRef.current;

        // Only count messages from others
        if (lastMessage.authorId !== currentUserId && container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            // 200px threshold for being "at bottom"
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

            if (!isNearBottom) {
                setUnreadBelowCount((prev) => prev + 1);
            }
        }
    }, [chatHistory, currentUserId]);

    /**
     * Reset unread count when active user changes
     * Relies on parent key-remount or this effect.
     */
    useEffect(() => {
        setUnreadBelowCount(0);
        lastProcessedMessageId.current = null;
    }, [activeUserId]);

    /**
     * Handle scroll events
     */
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container || !conversationId || !activeUserId) return;

        const { scrollTop, scrollHeight, clientHeight } = container;

        // 1. Pagination Trigger: Scrolled near top (scrollTop < 100)
        // We add a check for scrollTop > 0 to prevent triggering when the list is just too short
        if (
            scrollTop < 250 &&
            scrollTop >= 0 &&
            hasMore &&
            !isLoadingMore &&
            chatHistory.length > 0
        ) {
            const oldestMessageId = chatHistory[0].id;
            loadMoreMessages(conversationId, oldestMessageId);
        }

        // 2. Unread Count & Read Status: Scrolled near bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        if (isNearBottom) {
            if (unreadBelowCount > 0) {
                setUnreadBelowCount(0);
            }

            // Mark messages as read if valid
            if (document.visibilityState === 'visible') {
                markAsRead(conversationId, activeUserId);
            }
        }
    }, [
        hasMore,
        isLoadingMore,
        chatHistory,
        loadMoreMessages,
        conversationId,
        activeUserId,
        markAsRead,
        unreadBelowCount // Added dependency to safely clear count
    ]);

    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth',
            });
            setUnreadBelowCount(0);
        }
    }, []);

    const scrollToBottomInstant = useCallback(() => {
        if (containerRef.current) {
            // Force layout calculation
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, []);

    return {
        containerRef,
        unreadBelowCount,
        handleScroll,
        scrollToBottom,
        scrollToBottomInstant,
    };
};