'use client';
import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
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
}

export const MessageList: React.FC<MessageListProps> = ({
                                                            chatHistory,
                                                            currentUserId,
                                                            containerRef,
                                                            isLoadingHistory,
                                                            isLoadingMore,
                                                            onReply,
                                                            onDelete,
                                                            onScroll,
                                                        }) => {
    // Track the first visible message before load
    const [anchorMessageIndex, setAnchorMessageIndex] = useState<number | null>(null);
    const [anchorMessageOffset, setAnchorMessageOffset] = useState<number>(0);
    const [shouldPreserveScroll, setShouldPreserveScroll] = useState(false);

    // Track previous lengths to detect when we're loading older messages
    const prevChatHistoryLength = useRef(chatHistory.length);
    const isLoadingMoreRef = useRef(false);

    // Virtualizer setup
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 100,
        overscan: 10,
    });

    const items = virtualizer.getVirtualItems();

    /**
     * Save the current scroll position before loading more messages
     */
    const saveScrollPosition = useCallback(() => {
        const container = containerRef.current;
        if (!container || chatHistory.length === 0) return;

        // Find which message is at the top of the viewport
        const containerTop = container.scrollTop;
        const messages = container.querySelectorAll('[data-message-index]');

        let anchorIndex = null;
        let minDistance = Infinity;

        messages.forEach((message) => {
            const index = parseInt(message.getAttribute('data-message-index') || '-1');
            const rect = message.getBoundingClientRect();
            const relativeTop = rect.top - container.getBoundingClientRect().top + container.scrollTop;

            const distance = Math.abs(relativeTop - containerTop);
            if (distance < minDistance) {
                minDistance = distance;
                anchorIndex = index;
            }
        });

        if (anchorIndex !== null) {
            setAnchorMessageIndex(anchorIndex);
            const anchorElement = container.querySelector(`[data-message-index="${anchorIndex}"]`);
            if (anchorElement) {
                const rect = anchorElement.getBoundingClientRect();
                setAnchorMessageOffset(rect.top - container.getBoundingClientRect().top);
            }
        }
    }, [chatHistory.length, containerRef]);

    /**
     * Restore scroll position after loading older messages
     */
    const restoreScrollPosition = useCallback(() => {
        if (!shouldPreserveScroll || anchorMessageIndex === null || !containerRef.current) return;

        const container = containerRef.current;
        const anchorElement = container.querySelector(`[data-message-index="${anchorMessageIndex}"]`);

        if (anchorElement) {
            const rect = anchorElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const targetScrollTop = rect.top - containerRect.top + container.scrollTop - anchorMessageOffset;

            container.scrollTop = targetScrollTop;
        }

        setShouldPreserveScroll(false);
        setAnchorMessageIndex(null);
        setAnchorMessageOffset(0);
    }, [shouldPreserveScroll, anchorMessageIndex, anchorMessageOffset, containerRef]);

    /**
     * Detect when we're loading older messages and save position
     */
    useEffect(() => {
        if (isLoadingMore) {
            isLoadingMoreRef.current = true;
            saveScrollPosition();
            setShouldPreserveScroll(true);
        } else if (isLoadingMoreRef.current) {
            // Finished loading
            requestAnimationFrame(() => {
                restoreScrollPosition();
                isLoadingMoreRef.current = false;
            });
        }

        prevChatHistoryLength.current = chatHistory.length;
    }, [isLoadingMore, chatHistory.length, saveScrollPosition, restoreScrollPosition]);

    /**
     * Initial Load: Scroll to bottom
     */
    useEffect(() => {
        if (!isLoadingHistory && chatHistory.length > 0 && containerRef.current) {
            const container = containerRef.current;
            // Only auto-scroll on initial load, not when switching chats
            if (container.scrollHeight > container.clientHeight && container.scrollTop === 0) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }, [isLoadingHistory, chatHistory.length, containerRef]);

    /**
     * Auto-scroll for NEW messages at bottom (not when user is reading older messages)
     */
    useEffect(() => {
        if (isLoadingMore || !containerRef.current || chatHistory.length === 0) return;

        const container = containerRef.current;
        const lastMessage = chatHistory[chatHistory.length - 1];
        const isMyMessage = lastMessage.authorId === currentUserId;

        // Check if user is near bottom
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceToBottom < 300;

        // Only auto-scroll if:
        // 1. I sent the message AND I'm near bottom OR
        // 2. Someone else sent AND I'm at the very bottom (not just near)
        const shouldAutoScroll =
            (isMyMessage && isNearBottom) ||
            (!isMyMessage && distanceToBottom < 50);

        if (shouldAutoScroll) {
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTo({
                        top: containerRef.current.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }, [chatHistory.length, currentUserId, containerRef, isLoadingMore]);

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
        >
            {/* Loading Spinner for Pagination */}
            {isLoadingMore && (
                <div className="absolute top-[-40px] left-0 right-0 h-[40px] flex justify-center z-10 pointer-events-none">
                    <div className="bg-white/90 dark:bg-[#111b21]/90 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2 border border-zinc-200 dark:border-zinc-700">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">Loading older messages...</span>
                    </div>
                </div>
            )}

            {items.map((virtualRow) => {
                const msg = chatHistory[virtualRow.index];
                if (!msg) return null;

                const previousMsg = chatHistory[virtualRow.index - 1];
                const nextMsg = chatHistory[virtualRow.index + 1];
                const isFromMe = msg.authorId === currentUserId;

                // Grouping Logic
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
                        data-message-index={virtualRow.index}
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