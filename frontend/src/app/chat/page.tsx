'use client';
import React, { useRef, useState, useLayoutEffect } from 'react';
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

    // Get clean data from hook (no scroll logic involved there)
    const {
        message, setMessage, chatHistory, isLoadingHistory, sendMessage,
        sendMediaMessage, deleteMessage, replyTo, setReplyTo,
        isRemoteTyping, isBlocked, isLoadingMore,
        loadMoreMessages
    } = useConversation(activeUser);

    const containerRef = useRef<HTMLDivElement>(null);
    const [unreadBelowCount, setUnreadBelowCount] = useState(0);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // --- SCROLL MANAGEMENT REFS ---
    const prevHistoryLengthRef = useRef(0);
    const prevFirstMessageIdRef = useRef<string | null>(null);
    const prevScrollHeightRef = useRef(0);
    const isUserScrolledUpRef = useRef(false);

    // Virtualizer setup
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 80, // Approximate height of a message
        overscan: 5,
    });

    const items = virtualizer.getVirtualItems();

    // --- THE FIX: useLayoutEffect for invisible scroll adjustment ---
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || isLoadingHistory) return;

        const currentLength = chatHistory.length;
        const prevLength = prevHistoryLengthRef.current;
        const currentFirstMsgId = chatHistory[0]?.id;

        // SCENARIO 1: Initial Load (0 -> N messages)
        if (prevLength === 0 && currentLength > 0) {
            // Instantly jump to bottom. No animation.
            container.scrollTop = container.scrollHeight;
        }

            // SCENARIO 2: Pagination (Loading old messages at top)
        // We detect this because the first message ID has changed and length increased
        else if (currentLength > prevLength && currentFirstMsgId !== prevFirstMessageIdRef.current) {
            // The browser keeps scrollTop at the same pixel value (e.g., 50px).
            // But we inserted content above. We must push scrollTop down by the height of inserted content.
            const newScrollHeight = container.scrollHeight;
            const heightAdded = newScrollHeight - prevScrollHeightRef.current;

            // Adjust instantly
            container.scrollTop = container.scrollTop + heightAdded;
        }

        // SCENARIO 3: New Message Arrived (at bottom)
        else if (currentLength > prevLength) {
            const lastMessage = chatHistory[currentLength - 1];
            const isFromMe = lastMessage.authorId === currentUser?.id;

            // If I sent it, or if I was already at the bottom, auto-scroll smoothly
            if (isFromMe || !isUserScrolledUpRef.current) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            } else {
                // I am reading old history, don't interrupt me. Just show badge.
                setUnreadBelowCount(prev => prev + 1);
            }
        }

        // Update refs for next render
        prevHistoryLengthRef.current = currentLength;
        prevFirstMessageIdRef.current = currentFirstMsgId;
        prevScrollHeightRef.current = container.scrollHeight;

    }, [chatHistory, isLoadingHistory, currentUser?.id]);

    // --- SCROLL EVENT LISTENER ---
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = target;

        // Update scroll height ref for pagination calc
        prevScrollHeightRef.current = scrollHeight;

        // Logic to toggle "Scroll to Bottom" button
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isScrolledUp = distanceFromBottom > 150; // Tolerance threshold

        isUserScrolledUpRef.current = isScrolledUp;
        setShowScrollBottom(isScrolledUp);

        // Reset unread count if we are at bottom
        if (!isScrolledUp) {
            setUnreadBelowCount(0);
        }

        // Trigger Pagination: If near top (pixels) and we have more data
        if (scrollTop < 50 && !isLoadingMore && chatHistory.length > 0) {
            loadMoreMessages(); // Call the hook function
        }
    };

    const scrollToBottomManual = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
            setUnreadBelowCount(0);
        }
    };

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
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] z-0"></div>

            <div className="flex-none z-10 w-full">
                <ChatHeader user={activeUser} isTyping={isRemoteTyping} />
            </div>

            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto relative z-0 custom-scrollbar overscroll-contain"
                // IMPORTANT: Removed CSS scroll-behavior: smooth. We handle it in JS now.
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
                        {/* Pagination Loading Indicator */}
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
                                        isLastInGroup={isLastInGroup}
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
            {showScrollBottom && (
                <button
                    onClick={scrollToBottomManual}
                    className="fixed bottom-24 right-6 md:right-10 z-[40] bg-white dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] p-2.5 rounded-full shadow-xl border border-zinc-100 dark:border-zinc-700 hover:scale-105 active:scale-95 transition-all animate-in slide-in-from-bottom-2 duration-200"
                >
                    <ChevronDown className="w-6 h-6" />
                    {unreadBelowCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-[#00a884] text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm animate-in zoom-in duration-200">
                            {unreadBelowCount > 99 ? '99+' : unreadBelowCount}
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