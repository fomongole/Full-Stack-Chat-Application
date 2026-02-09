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
 * No rendering logic - only scroll-related state.
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
    const countedMessageIds = useRef<Set<string>>(new Set());

    /**
     * Track incoming messages for unread counting
     */
    useEffect(() => {
        if (chatHistory.length === 0) return;

        const lastMessage = chatHistory[chatHistory.length - 1];
        const container = containerRef.current;

        // Only count messages from others
        if (lastMessage.authorId !== currentUserId && container) {
            const isNearBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight < 300;

            if (!isNearBottom && !countedMessageIds.current.has(lastMessage.id)) {
                setUnreadBelowCount((prev) => prev + 1);
                countedMessageIds.current.add(lastMessage.id);
            }
        }
    }, [chatHistory, currentUserId]);

    /**
     * Reset unread count when active user changes
     */
    useEffect(() => {
        if (activeUserId) {
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, [activeUserId]);

    /**
     * Handle scroll events
     */
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container || !conversationId || !activeUserId) return;

        const { scrollTop, scrollHeight, clientHeight } = container;

        // Trigger pagination when scrolled near top
        if (
            scrollTop < 100 &&
            hasMore &&
            !isLoadingMore &&
            chatHistory.length > 0
        ) {
            const oldestMessageId = chatHistory[0].id;
            loadMoreMessages(conversationId, oldestMessageId);
        }

        // Clear unread counter when near bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        if (isNearBottom) {
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();

            // Mark messages as read
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
    ]);

    /**
     * Scroll to bottom with smooth animation
     */
    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth',
            });
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, []);

    /**
     * Instant scroll to bottom (for initial load)
     */
    const scrollToBottomInstant = useCallback(() => {
        if (containerRef.current) {
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
            });
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