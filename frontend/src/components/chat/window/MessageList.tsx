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
 * MessageList with fixed Scroll Anchoring.
 * Prevents jumping when loading older messages.
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
    // Track previous height to calculate scroll diff
    const prevScrollHeightRef = useRef<number>(0);
    const prevFirstMessageIdRef = useRef<string | null>(null);
    const hasInitiallyScrolledRef = useRef(false);

    // Virtualizer setup
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 100, // Estimate row height
        overscan: 10, // Increase overscan to prevent blank spaces during fast scroll
    });

    const items = virtualizer.getVirtualItems();

    /**
     * SCROLL ANCHORING LOGIC (The Fix for the "Buggy Jump")
     * 1. Before render, we simply let React update.
     * 2. After render but BEFORE paint (useLayoutEffect), we check if height changed.
     * 3. If we loaded *older* messages (prepended), we adjust scrollTop.
     */
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const currentScrollHeight = container.scrollHeight;
        const prevScrollHeight = prevScrollHeightRef.current;
        const count = chatHistory.length;

        // Check if we prepended messages (list grew, and the first message ID changed)
        // We only adjust scroll if we are NOT at the very bottom (initial load handled elsewhere)
        if (
            prevScrollHeight > 0 &&
            currentScrollHeight > prevScrollHeight &&
            isLoadingMore === false // Only adjust when loading is done
        ) {
            // Calculate how much the list grew upwards
            const heightDifference = currentScrollHeight - prevScrollHeight;

            // Adjust scroll position immediately to keep viewport stable
            container.scrollTop = container.scrollTop + heightDifference;

            // Debug log if needed
            // console.log(`Anchored Scroll: Adjusted by ${heightDifference}px`);
        }

        // Update refs for next render
        prevScrollHeightRef.current = currentScrollHeight;
        prevFirstMessageIdRef.current = chatHistory[0]?.id || null;

    }, [chatHistory, isLoadingMore, containerRef]);


    /**
     * INITIAL SCROLL LOGIC
     * Forces scroll to bottom on first load.
     */
    useEffect(() => {
        if (!isLoadingHistory && chatHistory.length > 0 && !hasInitiallyScrolledRef.current) {
            const container = containerRef.current;
            if (container) {
                container.scrollTop = container.scrollHeight;
                hasInitiallyScrolledRef.current = true;
                onInitialScrollComplete?.();
            }
        }
    }, [isLoadingHistory, chatHistory.length, containerRef, onInitialScrollComplete]);


    /**
     * AUTO-SCROLL FOR NEW MESSAGES (Stick to Bottom)
     * If user is near bottom and new message comes in -> scroll down.
     */
    useEffect(() => {
        if (!hasInitiallyScrolledRef.current || chatHistory.length === 0) return;

        const container = containerRef.current;
        if (!container) return;

        const lastMessage = chatHistory[chatHistory.length - 1];
        const isMyMessage = lastMessage.authorId === currentUserId;

        // Check if user is near bottom (within 300px)
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceToBottom < 300;

        // If I sent the message OR I'm already at the bottom, auto-scroll
        if (isMyMessage || isNearBottom) {
            // Use minimal timeout to allow virtualizer to compute size
            setTimeout(() => {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
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
            {/* Loading More Indicator - Positioned nicely within the flow */}
            {isLoadingMore && (
                <div className="absolute top-[-40px] left-0 right-0 h-[40px] flex items-center justify-center">
                    <div className="bg-white/80 dark:bg-[#111b21]/80 px-3 py-1 rounded-full shadow-sm flex items-center gap-2 backdrop-blur-sm z-20">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <span className="text-[10px] text-zinc-500 font-medium">Loading history...</span>
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
                            <div className="flex justify-center my-4 sticky top-2 z-10">
                                <span className="text-[11px] font-medium text-[#54656f] dark:text-[#8696a0] bg-[#eef0f2] dark:bg-[#1f2c34] px-3 py-1.5 rounded-lg shadow-sm border border-black/5 opacity-90">
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