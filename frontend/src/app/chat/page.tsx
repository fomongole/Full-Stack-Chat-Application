'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '@/store/useChatStore';
import { useConversation } from '@/hooks/chat/useConversation';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { getMessageDateLabel } from '@/lib/dateUtils';
import { ChatHeader } from '@/components/chat/window/ChatHeader';
import { MessageBubble } from '@/components/chat/window/MessageBubble';
import { ChatInput } from '@/components/chat/window/ChatInput';
import { Loader2, ChevronDown } from 'lucide-react';

export default function ChatPage() {
    const activeUser = useChatStore((state) => state.activeUser) as User | null;
    const currentUser = useAuthStore((state) => state.user);

    const {
        message, setMessage, chatHistory, isLoadingHistory, sendMessage,
        sendMediaMessage, deleteMessage, replyTo, setReplyTo,
        isRemoteTyping, containerRef,
        unreadBelowCount, handleScroll,
        isBlocked, isLoadingMore, isInitialLoad,
        scrollToBottom, conversationId,
        isPaginationInProgress
    } = useConversation(activeUser);

    // Track if we've done the initial scroll
    const hasInitiallyScrolledRef = useRef(false);
    const lastChatHistoryLengthRef = useRef(0);

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
     * This runs once when messages first load
     */
    useEffect(() => {
        // Only run when we have messages and haven't scrolled yet
        if (!hasInitiallyScrolledRef.current &&
            !isLoadingHistory &&
            chatHistory.length > 0 &&
            containerRef.current) {

            // Mark as scrolled IMMEDIATELY to prevent re-runs
            hasInitiallyScrolledRef.current = true;

            // Use requestAnimationFrame to ensure DOM is painted
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    // INSTANT scroll - no animation
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
            });
        }
    }, [isLoadingHistory, chatHistory.length]);

    /**
     * EFFECT 2: New Messages - Auto-scroll for new messages
     * Only scrolls if:
     * - Not initial load
     * - Not during pagination
     * - Message is from me OR user is near bottom
     */
    useEffect(() => {
        // Skip if initial load or no messages
        if (!hasInitiallyScrolledRef.current || chatHistory.length === 0) {
            return;
        }

        // Skip if pagination is in progress
        if (isPaginationInProgress) {
            lastChatHistoryLengthRef.current = chatHistory.length;
            return;
        }

        // Only process if we have NEW messages
        if (chatHistory.length > lastChatHistoryLengthRef.current && containerRef.current) {
            const container = containerRef.current;
            const lastMessage = chatHistory[chatHistory.length - 1];
            const isMyMessage = lastMessage.authorId === currentUser?.id;

            // Check if user is near bottom
            const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            const isNearBottom = scrollBottom < 300;

            // Auto-scroll if it's my message OR user is already near bottom
            if (isMyMessage || isNearBottom) {
                // Small delay to ensure DOM is updated
                requestAnimationFrame(() => {
                    if (containerRef.current) {
                        containerRef.current.scrollTop = containerRef.current.scrollHeight;
                    }
                });
            }
        }

        // Update last known length
        lastChatHistoryLengthRef.current = chatHistory.length;
    }, [chatHistory.length, currentUser?.id, isPaginationInProgress]);

    /**
     * EFFECT 3: Reset on user change
     * Clear all scroll state when switching conversations
     */
    useEffect(() => {
        if (activeUser?.id) {
            hasInitiallyScrolledRef.current = false;
            lastChatHistoryLengthRef.current = 0;
        }
    }, [activeUser?.id]);

    if (!activeUser) return (
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#f0f2f5] dark:bg-[#111b21] border-b-[6px] border-green-500">
            <div className="max-w-md text-center p-8">
                <h2 className="text-3xl font-light text-[#41525d] dark:text-[#e9edef] mb-4">
                    Welcome to Chat App
                </h2>
                <p className="text-[#667781] dark:text-[#8696a0] text-sm leading-relaxed">
                    Select a conversation to start messaging.
                </p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full overflow-hidden relative bg-[#efeae2] dark:bg-[#0b141a]">
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] z-0"></div>

            <div className="flex-none z-10 w-full">
                <ChatHeader user={activeUser} isTyping={isRemoteTyping} />
            </div>

            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto relative z-0 custom-scrollbar overscroll-contain"
                style={{ scrollBehavior: 'auto' }} // CRITICAL: 'auto' prevents visible scroll animation
            >
                {isLoadingHistory ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" />
                        <p className="text-xs text-zinc-500 font-medium">Loading messages...</p>
                    </div>
                ) : (
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
                            const isFromMe = msg.authorId === currentUser?.id;

                            const isFirstInGroup = !previousMsg || previousMsg.authorId !== msg.authorId ||
                                getMessageDateLabel(msg.timestamp) !== getMessageDateLabel(previousMsg.timestamp);

                            const isLastInGroup = !nextMsg || nextMsg.authorId !== msg.authorId;

                            const showDateHeader = virtualRow.index === 0 ||
                                getMessageDateLabel(msg.timestamp) !== getMessageDateLabel(chatHistory[virtualRow.index - 1].timestamp);

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
                                        onReply={setReplyTo}
                                        onDelete={deleteMessage}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Scroll to bottom button */}
                {unreadBelowCount > 0 && (
                    <button
                        onClick={scrollToBottom}
                        className="fixed bottom-24 right-6 md:right-10 z-[40] bg-white dark:bg-[#202c33] text-primary p-3 rounded-full shadow-2xl border border-zinc-200 dark:border-zinc-700 hover:scale-110 active:scale-95 transition-all animate-in slide-in-from-bottom-4 fade-in duration-300 group"
                    >
                        <ChevronDown className="w-6 h-6" />
                        <span className="absolute -top-2 -right-1 min-w-[22px] h-[22px] px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-[#202c33] shadow-sm animate-in zoom-in duration-300">
                            {unreadBelowCount > 99 ? '99+' : unreadBelowCount}
                        </span>
                    </button>
                )}
            </div>

            <div className="flex-none z-20 w-full bg-[#f0f2f5] dark:bg-[#202c33]">
                <ChatInput
                    value={message}
                    onChange={setMessage}
                    onSend={sendMessage}
                    onUploadMedia={sendMediaMessage}
                    recipientName={activeUser.username}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    isBlocked={isBlocked}
                />
            </div>
        </div>
    );
}