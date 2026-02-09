'use client';
import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Message } from '@/types';
import { getMessageDateLabel } from '@/lib/dateUtils';
import { MessageBubble } from '@/components/chat/window/MessageBubble';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
    chatHistory: Message[];
    currentUserId: string | null;
    // UPDATED LINE BELOW: Added | null to match RefObject expectations
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
    const lastChatHistoryLengthRef = useRef(0);
    const isPaginationInProgress = useRef(false);

    // Virtualizer setup
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 100,
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
            hasInitiallyScrolledRef.current = true;

            requestAnimationFrame(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                    onInitialScrollComplete?.();
                }
            });
        }
    }, [isLoadingHistory, chatHistory.length, containerRef, onInitialScrollComplete]);

    /**
     * EFFECT 2: New Messages - Auto-scroll for new messages
     */
    useEffect(() => {
        if (!hasInitiallyScrolledRef.current || chatHistory.length === 0) {
            return;
        }

        if (isPaginationInProgress.current) {
            lastChatHistoryLengthRef.current = chatHistory.length;
            isPaginationInProgress.current = false;
            return;
        }

        if (
            chatHistory.length > lastChatHistoryLengthRef.current &&
            containerRef.current
        ) {
            const container = containerRef.current;
            const lastMessage = chatHistory[chatHistory.length - 1];
            const isMyMessage = lastMessage.authorId === currentUserId;

            const scrollBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;
            const isNearBottom = scrollBottom < 300;

            if (isMyMessage || isNearBottom) {
                requestAnimationFrame(() => {
                    if (containerRef.current) {
                        containerRef.current.scrollTop =
                            containerRef.current.scrollHeight;
                    }
                });
            }
        }

        lastChatHistoryLengthRef.current = chatHistory.length;
    }, [chatHistory.length, currentUserId, containerRef]);

    /**
     * EFFECT 3: Handle pagination scroll preservation
     */
    useEffect(() => {
        if (isLoadingMore) {
            isPaginationInProgress.current = true;
        }
    }, [isLoadingMore]);

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
                paddingTop: isLoadingMore ? '40px' : '0',
            }}
            className="px-4 pb-4"
        >
            {/* Pagination loader at top */}
            {isLoadingMore && (
                <div className="absolute top-0 left-0 right-0 flex justify-center py-2 bg-gradient-to-b from-white/80 dark:from-[#0b141a]/80 backdrop-blur-sm z-10">
                    <Loader2 className="w-5 h-5 text-primary animate-spin opacity-70" />
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