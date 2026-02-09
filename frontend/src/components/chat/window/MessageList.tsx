'use client';
import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Message } from '@/types';
import { getMessageDateLabel } from '@/lib/dateUtils';
import { MessageBubble } from '@/components/chat/window/MessageBubble';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
    chatHistory: Message[];
    currentUserId: string | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isLoadingHistory: boolean;
    isLoadingMore: boolean;
    onReply: (message: Message) => void;
    onDelete: (messageId: string) => void;
    onScroll: () => void;
    onInitialScrollComplete?: () => void;
}

/**
 * Specialized MessageList component.
 * Fixed: Robust Scroll Anchoring using Virtualizer Metrics.
 */
export const MessageList: React.FC<MessageListProps> = ({
                                                            chatHistory,
                                                            currentUserId,
                                                            containerRef,
                                                            isLoadingHistory,
                                                            isLoadingMore,
                                                            onReply,
                                                            onDelete,
                                                            onScroll,
                                                            onInitialScrollComplete,
                                                        }) => {
    // Track previous list height to calculate precise scroll adjustments
    const prevTotalSizeRef = useRef<number>(0);
    const hasInitiallyScrolledRef = useRef(false);

    // Track the last message ID to detect "New Message" vs "History Load"
    const prevLastMessageIdRef = useRef<string | null>(null);

    // Virtualizer setup
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 100, // Reasonable estimate prevents jitter
        overscan: 20, // High overscan ensures smooth scrolling into new area
    });

    const items = virtualizer.getVirtualItems();
    const currentTotalSize = virtualizer.getTotalSize();

    /**
     * 1. ROBUST SCROLL ANCHORING
     * We calculate the size difference using the Virtualizer's math, not the DOM.
     * This runs synchronously before the browser paints the new frame.
     */
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const prevTotalSize = prevTotalSizeRef.current;

        // If the content grew (meaning we loaded history at the top)
        // AND we are not in the initial loading state
        if (prevTotalSize > 0 && currentTotalSize > prevTotalSize && !isLoadingHistory) {

            // Calculate how much pixel height was added to the top
            const heightDifference = currentTotalSize - prevTotalSize;

            // Immediately adjust scroll position by that exact amount
            // This cancels out the "jump" and keeps the user's viewport static
            container.scrollTop = container.scrollTop + heightDifference;
        }

        // Update ref for the next render cycle
        prevTotalSizeRef.current = currentTotalSize;
    }, [currentTotalSize, isLoadingHistory, containerRef]);

    /**
     * 2. INITIAL SCROLL TO BOTTOM
     * Runs only once when the first batch of history is ready.
     */
    useEffect(() => {
        if (
            !hasInitiallyScrolledRef.current &&
            !isLoadingHistory &&
            chatHistory.length > 0 &&
            containerRef.current
        ) {
            // Force scroll to bottom
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            hasInitiallyScrolledRef.current = true;

            // Initialize the last message ID tracker
            prevLastMessageIdRef.current = chatHistory[chatHistory.length - 1].id;

            onInitialScrollComplete?.();
        }
    }, [isLoadingHistory, chatHistory, containerRef, onInitialScrollComplete]);

    /**
     * 3. SMART AUTO-SCROLL (Stick to Bottom)
     * Only scrolls down if a TRULY NEW message arrived (ID changed).
     */
    useEffect(() => {
        if (!hasInitiallyScrolledRef.current || chatHistory.length === 0) return;

        const container = containerRef.current;
        if (!container) return;

        const lastMessage = chatHistory[chatHistory.length - 1];
        const prevLastMessageId = prevLastMessageIdRef.current;

        // If the last message ID is exactly the same as before,
        // it means we just loaded history (or edited a message).
        // In this case, DO NOT scroll to bottom.
        if (lastMessage.id === prevLastMessageId) {
            return;
        }

        // It's a new message! Update ref and check if we should scroll.
        prevLastMessageIdRef.current = lastMessage.id;

        const isMyMessage = lastMessage.authorId === currentUserId;
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceToBottom < 300;

        if (isMyMessage || isNearBottom) {
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTo({
                        top: containerRef.current.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }, [chatHistory, currentUserId, containerRef]);

    if (isLoadingHistory) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" />
                <p className="text-xs text-zinc-500 font-medium">Loading messages...</p>
            </div>
        );
    }

    return (
        <div
            style={{
                height: `${currentTotalSize}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {/* Loading Spinner for Pagination */}
            {isLoadingMore && (
                <div className="absolute top-[-30px] left-0 right-0 h-[30px] flex justify-center z-10">
                    <div className="bg-white/80 dark:bg-[#111b21]/80 px-3 py-1 rounded-full shadow-sm backdrop-blur-sm flex items-center gap-2">
                        <Loader2 className="w-3 h-3 text-primary animate-spin" />
                        <span className="text-[10px] text-zinc-500">Loading history...</span>
                    </div>
                </div>
            )}

            {items.map((virtualRow) => {
                const msg = chatHistory[virtualRow.index];
                if (!msg) return null;

                const previousMsg = chatHistory[virtualRow.index - 1];
                const nextMsg = chatHistory[virtualRow.index + 1];
                const isFromMe = msg.authorId === currentUserId;

                const isFirstInGroup =
                    !previousMsg ||
                    previousMsg.authorId !== msg.authorId ||
                    getMessageDateLabel(msg.timestamp) !==
                    getMessageDateLabel(previousMsg.timestamp);

                const isLastInGroup =
                    !nextMsg || nextMsg.authorId !== msg.authorId;

                const showDateHeader =
                    virtualRow.index === 0 ||
                    getMessageDateLabel(msg.timestamp) !==
                    getMessageDateLabel(chatHistory[virtualRow.index - 1]?.timestamp);

                return (
                    <div
                        key={msg.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="px-4 pb-1"
                    >
                        {showDateHeader && (
                            <div className="flex justify-center my-4 sticky top-2 z-10 opacity-90">
                                <span className="text-[11px] font-medium text-[#54656f] dark:text-[#8696a0] bg-[#eef0f2] dark:bg-[#1f2c34] px-3 py-1.5 rounded-lg shadow-sm border border-black/5">
                                    {getMessageDateLabel(msg.timestamp)}
                                </span>
                            </div>
                        )}
                        <MessageBubble
                            message={msg}
                            isFromMe={isFromMe}
                            isFirstInGroup={isFirstInGroup}
                            isLastInGroup={isLastInGroup}
                            onReply={onReply}
                            onDelete={onDelete}
                        />
                    </div>
                );
            })}
        </div>
    );
};