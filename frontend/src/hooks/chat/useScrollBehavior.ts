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

    // We use a ref to track the previous length to detect NEW messages specifically
    const prevHistoryLengthRef = useRef(chatHistory.length);

    /**
     * Track incoming messages for unread counting
     * Optimized to avoid cascading renders
     */
    useEffect(() => {
        const currentLength = chatHistory.length;
        const prevLength = prevHistoryLengthRef.current;

        // Only run if we actually added messages (and not just initial load)
        if (currentLength > prevLength && prevLength > 0) {
            const lastMessage = chatHistory[currentLength - 1];
            const container = containerRef.current;

            // Only count messages from others
            if (lastMessage.authorId !== currentUserId && container) {
                const isNearBottom =
                    container.scrollHeight - container.scrollTop - container.clientHeight < 300;

                // Check if we already counted this specific ID to be safe
                if (!isNearBottom && !countedMessageIds.current.has(lastMessage.id)) {
                    setUnreadBelowCount((prev) => prev + 1);
                    countedMessageIds.current.add(lastMessage.id);
                }
            }
        }

        prevHistoryLengthRef.current = currentLength;
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
        // Increased threshold to 200px for smoother experience
        if (
            scrollTop < 200 &&
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
            // Only update state if it's not already 0 to avoid re-renders
            setUnreadBelowCount((prev) => (prev > 0 ? 0 : prev));
            if(countedMessageIds.current.size > 0) countedMessageIds.current.clear();

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
            // We use requestAnimationFrame to ensure DOM is ready
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