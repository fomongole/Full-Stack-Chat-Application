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
 * Handles ONLY message rendering, virtualization, and initial scroll.
 * No business logic, no state management.
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
    const hasInitiallyScrolledRef = useRef(false);

    // Track previous scroll height to handle pagination jumps
    const previousScrollHeightRef = useRef(0);
    const previousChatLengthRef = useRef(0);

    // Virtualizer setup
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 100, // Reasonable estimate for message height
        overscan: 5,
        scrollMargin: 50,
    });

    const items = virtualizer.getVirtualItems();

    /**
     * EFFECT 1: Initial Load - Scroll to bottom INSTANTLY on first load
     */
    useEffect(() => {
        if (
            !hasInitiallyScrolledRef.current &&
            !isLoadingHistory &&
            chatHistory.length > 0 &&
            containerRef.current
        ) {
            // Force immediate measure to ensure accurate scroll height
            virtualizer.measure();

            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                    hasInitiallyScrolledRef.current = true;
                    onInitialScrollComplete?.();
                }
            });
        }
    }, [isLoadingHistory, chatHistory.length, containerRef, onInitialScrollComplete, virtualizer]);

    /**
     * EFFECT 2: Scroll Restoration logic (Fix for the jumping bug)
     * We capture the height difference before and after render
     */
    // 2a. Capture scroll height BEFORE the update
    if (containerRef.current && isLoadingMore && chatHistory.length > previousChatLengthRef.current) {
        previousScrollHeightRef.current = containerRef.current.scrollHeight;
    }

    // 2b. Adjust scroll position AFTER the update
    useLayoutEffect(() => {
        const container = containerRef.current;
        const isHistoryGrowth = chatHistory.length > previousChatLengthRef.current;

        // If we added messages and we have a previous height stored
        if (container && isHistoryGrowth && previousScrollHeightRef.current > 0) {
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - previousScrollHeightRef.current;

            // Only adjust if we added items to the TOP (which increases scrollHeight)
            // and we weren't already at the bottom.
            if (heightDifference > 0) {
                // Restore the user's relative position
                container.scrollTop = container.scrollTop + heightDifference;
            }

            // Reset the ref
            previousScrollHeightRef.current = 0;
        }

        previousChatLengthRef.current = chatHistory.length;
    }, [chatHistory.length, containerRef]);


    /**
     * EFFECT 3: New Messages (Bottom) - Auto-scroll for new incoming messages
     */
    useEffect(() => {
        if (!hasInitiallyScrolledRef.current || chatHistory.length === 0) {
            return;
        }

        // If we just loaded older messages (length increased significantly), don't scroll to bottom
        // This is handled by Effect 2

        const lastMessage = chatHistory[chatHistory.length - 1];
        const isMyMessage = lastMessage.authorId === currentUserId;

        if (containerRef.current) {
            const container = containerRef.current;
            const scrollBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;
            const isNearBottom = scrollBottom < 300;

            // Only auto-scroll if it's my message OR I'm already near the bottom
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
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
            className="px-4 pb-4"
        >
            {/* Pagination loader at top */}
            {isLoadingMore && (
                <div className="absolute top-0 left-0 right-0 flex justify-center py-4 z-10">
                    <div className="bg-white/80 dark:bg-[#0b141a]/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    </div>
                </div>
            )}

            {/* Date headers and messages */}
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
                    getMessageDateLabel(
                        chatHistory[virtualRow.index - 1].timestamp
                    );

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
                    >
                        {showDateHeader && (
                            <div className="flex justify-center my-4">
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