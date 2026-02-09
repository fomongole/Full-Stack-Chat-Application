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
 * Fixed: Implements "Scroll Anchoring" to prevent jumping when loading older messages.
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
    // Refs for Scroll Anchoring
    const prevScrollHeightRef = useRef<number>(0);
    const hasInitiallyScrolledRef = useRef(false);

    // Virtualizer setup
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 100, // Approximate height of a message
        overscan: 10, // Render more items outside view to prevent white flashes
    });

    const items = virtualizer.getVirtualItems();

    /**
     * FIX: Scroll Anchoring Logic
     * Runs synchronously after DOM update but BEFORE paint.
     * Calculates how much the list grew and adjusts scroll position.
     */
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const currentScrollHeight = container.scrollHeight;
        const prevScrollHeight = prevScrollHeightRef.current;

        // If we have history, aren't loading, and the height grew (meaning items were added to top)
        if (
            prevScrollHeight > 0 &&
            currentScrollHeight > prevScrollHeight &&
            !isLoadingMore &&
            !isLoadingHistory
        ) {
            // The magic formula: New Position = Old Position + (New Height - Old Height)
            const heightDifference = currentScrollHeight - prevScrollHeight;
            container.scrollTop = container.scrollTop + heightDifference;
        }

        // Save current height for next render
        prevScrollHeightRef.current = currentScrollHeight;
    }, [chatHistory, isLoadingMore, isLoadingHistory, containerRef]);

    /**
     * Initial Load: Scroll to bottom
     */
    useEffect(() => {
        if (
            !hasInitiallyScrolledRef.current &&
            !isLoadingHistory &&
            chatHistory.length > 0 &&
            containerRef.current
        ) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            hasInitiallyScrolledRef.current = true;
            onInitialScrollComplete?.();
        }
    }, [isLoadingHistory, chatHistory.length, containerRef, onInitialScrollComplete]);

    /**
     * Auto-scroll for NEW messages (Stick to bottom)
     */
    useEffect(() => {
        if (!hasInitiallyScrolledRef.current || chatHistory.length === 0) return;

        const container = containerRef.current;
        if (!container) return;

        const lastMessage = chatHistory[chatHistory.length - 1];
        const isMyMessage = lastMessage.authorId === currentUserId;

        // Check if user is near bottom
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceToBottom < 300;

        // Only auto-scroll if I sent it OR if I'm already at the bottom
        if (isMyMessage || isNearBottom) {
            // Small timeout to allow virtualizer to calculate exact size
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTo({
                        top: containerRef.current.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }, 50);
        }
    }, [chatHistory.length, currentUserId, containerRef]);

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