'use client';
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
 * Fixed: ESLint "Cannot access refs during render" error.
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
    const [isUserScrollingUp, setIsUserScrollingUp] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track the last message ID we processed to prevent recount loops
    const lastProcessedMessageId = useRef<string | null>(null);
    const lastScrollTop = useRef<number>(0);
    const isProgrammaticScroll = useRef<boolean>(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track previous active user for Derived State
    const [prevActiveUserId, setPrevActiveUserId] = useState(activeUserId);

    // 1. DERIVED STATE: Reset unread count instantly
    // Allowed: State updates during render (stops double-paint)
    if (activeUserId !== prevActiveUserId) {
        setPrevActiveUserId(activeUserId);
        setUnreadBelowCount(0);
        setIsUserScrollingUp(false);
    }

    // 2. EFFECT: Reset the Ref (Side Effect)
    // Required: Ref updates must happen inside useEffect, not render
    useEffect(() => {
        lastProcessedMessageId.current = null;
        lastScrollTop.current = 0;
        isProgrammaticScroll.current = false;
    }, [activeUserId]);

    /**
     * Effect: Track new incoming messages for unread count
     */
    useEffect(() => {
        if (chatHistory.length === 0) return;

        const lastMessage = chatHistory[chatHistory.length - 1];

        // Prevent re-running for the same message
        if (lastProcessedMessageId.current === lastMessage.id) return;
        lastProcessedMessageId.current = lastMessage.id;

        const container = containerRef.current;
        if (!container) return;

        // If I am NOT the author, and I am NOT at the bottom, increment unread
        if (lastMessage.authorId !== currentUserId) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceToBottom = scrollHeight - scrollTop - clientHeight;
            const isNearBottom = distanceToBottom < 200;

            if (!isNearBottom) {
                // Wrap in setTimeout to avoid "setState during render" warning from parent updates
                setTimeout(() => {
                    setUnreadBelowCount((prev) => prev + 1);
                }, 0);
            }
        }
    }, [chatHistory, currentUserId]);

    /**
     * Effect: Reset isUserScrollingUp after a period of no scrolling
     */
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    /**
     * Scroll Event Handler
     */
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container || !conversationId || !activeUserId) return;

        // Don't update scroll direction if it's a programmatic scroll
        if (isProgrammaticScroll.current) {
            isProgrammaticScroll.current = false;
            return;
        }

        const { scrollTop, scrollHeight, clientHeight } = container;

        // Determine scroll direction
        if (scrollTop < lastScrollTop.current) {
            setIsUserScrollingUp(true);
            // Clear any existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            // Set a timeout to reset isUserScrollingUp after 1 second of no scrolling
            scrollTimeoutRef.current = setTimeout(() => {
                setIsUserScrollingUp(false);
            }, 1000);
        } else if (scrollTop > lastScrollTop.current) {
            setIsUserScrollingUp(false);
        }

        lastScrollTop.current = scrollTop;

        // 1. Pagination: User scrolled to top
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

        // 2. Unread Count: User scrolled to bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        if (isNearBottom) {
            if (unreadBelowCount > 0) {
                setUnreadBelowCount(0);
            }
            // Mark as read if visible
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
        unreadBelowCount
    ]);

    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            isProgrammaticScroll.current = true;
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth',
            });
            setUnreadBelowCount(0);
            setIsUserScrollingUp(false);
        }
    }, []);

    const scrollToBottomInstant = useCallback(() => {
        if (containerRef.current) {
            isProgrammaticScroll.current = true;
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            setIsUserScrollingUp(false);
        }
    }, []);

    return {
        containerRef,
        unreadBelowCount,
        handleScroll,
        scrollToBottom,
        scrollToBottomInstant,
        isUserScrollingUp,
    };
};