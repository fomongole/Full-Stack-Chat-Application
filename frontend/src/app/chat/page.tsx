'use client';
import React, { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react';
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
        unreadBelowCount, setUnreadBelowCount, handleScroll,
        isBlocked, isLoadingMore, scrollToBottom, isPaginationInProgress
    } = useConversation(activeUser);

    // Track scroll state for auto-scroll logic
    const prevHistoryLengthRef = useRef(0);
    const prevFirstMessageIdRef = useRef<string | null>(null);
    const isUserScrolledUpRef = useRef(false);

    // --- VIRTUALIZER SETUP ---
    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 80,
        overscan: 10, // Higher overscan helps with smooth upward scrolling
    });

    const items = virtualizer.getVirtualItems();

    // --- SCROLL COORDINATION ---
    useLayoutEffect(() => {
        if (chatHistory.length === 0 || isLoadingHistory) {
            prevHistoryLengthRef.current = 0;
            prevFirstMessageIdRef.current = null;
            return;
        }

        const currentLength = chatHistory.length;
        const prevLength = prevHistoryLengthRef.current;
        const currentFirstMsgId = chatHistory[0]?.id;
        const prevFirstMsgId = prevFirstMessageIdRef.current;

        // SCENARIO 1: Initial Load
        if (prevLength === 0 && currentLength > 0) {
            virtualizer.scrollToIndex(currentLength - 1, { align: 'end' });
        }

        // SCENARIO 2: Pagination (Messages prepended to top)
        else if (isPaginationInProgress.current && currentFirstMsgId !== prevFirstMsgId) {
            const itemsAdded = currentLength - prevLength;
            // Anchor to the item we were just looking at (the previous first item)
            virtualizer.scrollToIndex(itemsAdded, { align: 'start' });
            // Release the lock
            isPaginationInProgress.current = false;
        }

        // SCENARIO 3: New Message (Appended to bottom)
        else if (currentLength > prevLength) {
            const lastMessage = chatHistory[currentLength - 1];
            const isFromMe = lastMessage.authorId === currentUser?.id;

            // Auto-scroll if I sent it OR if the user is already at the bottom
            if (isFromMe || !isUserScrolledUpRef.current) {
                virtualizer.scrollToIndex(currentLength - 1, {
                    align: 'end',
                    behavior: isFromMe ? 'auto' : 'smooth'
                });
            }
        }

        prevHistoryLengthRef.current = currentLength;
        prevFirstMessageIdRef.current = currentFirstMsgId;
    }, [chatHistory, isLoadingHistory, currentUser?.id, virtualizer]);

    // --- WRAPPER FOR SCROLL EVENT ---
    const onScrollInternal = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

        // Determine if user has scrolled up away from bottom
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isUserScrolledUpRef.current = distanceFromBottom > 150;

        // Trigger the hook's scroll logic (pagination etc)
        handleScroll();
    };

    if (!activeUser) return (
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#f0f2f5] dark:bg-[#111b21] border-b-[6px] border-green-500">
            <div className="max-w-md text-center p-8">
                <h2 className="text-3xl font-light text-[#41525d] dark:text-[#e9edef] mb-4">Welcome to Chat App</h2>
                <p className="text-[#667781] dark:text-[#8696a0] text-sm leading-relaxed">Select a conversation to start messaging.</p>
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
                onScroll={onScrollInternal}
                className="flex-1 overflow-y-auto relative z-0 custom-scrollbar overscroll-contain"
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
                        }}
                        className="px-4 pb-4"
                    >
                        {isLoadingMore && (
                            <div className="absolute top-2 left-0 right-0 flex justify-center z-10">
                                <div className="bg-white/90 dark:bg-[#111b21]/90 backdrop-blur p-1.5 rounded-full shadow-md">
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                </div>
                            </div>
                        )}

                        {items.map((virtualRow) => {
                            const msg = chatHistory[virtualRow.index];
                            if (!msg) return null;

                            const previousMsg = chatHistory[virtualRow.index - 1];
                            const isFromMe = msg.authorId === currentUser?.id;

                            // Message grouping logic
                            const isFirstInGroup = !previousMsg || previousMsg.authorId !== msg.authorId;
                            const showDateHeader = virtualRow.index === 0 ||
                                getMessageDateLabel(msg.timestamp) !== getMessageDateLabel(previousMsg.timestamp);

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
                                        <div className="flex justify-center my-4 sticky top-2 z-10 pointer-events-none">
                                            <span className="text-[11px] font-medium text-[#54656f] dark:text-[#8696a0] bg-[#eef0f2] dark:bg-[#1f2c34] px-3 py-1.5 rounded-lg shadow-sm border border-black/5 opacity-90 backdrop-blur-sm">
                                                {getMessageDateLabel(msg.timestamp)}
                                            </span>
                                        </div>
                                    )}
                                    <MessageBubble
                                        message={msg}
                                        isFromMe={isFromMe}
                                        isFirstInGroup={isFirstInGroup}
                                        onReply={setReplyTo}
                                        onDelete={deleteMessage}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Scroll To Bottom Button */}
            {isUserScrolledUpRef.current && (
                <button
                    onClick={scrollToBottom}
                    className="fixed bottom-24 right-6 md:right-10 z-[40] bg-white dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] p-2.5 rounded-full shadow-xl border border-zinc-100 dark:border-zinc-700 hover:scale-105 active:scale-95 transition-all"
                >
                    <ChevronDown className="w-6 h-6" />
                    {unreadBelowCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-[#00a884] text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                            {unreadBelowCount}
                        </span>
                    )}
                </button>
            )}

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