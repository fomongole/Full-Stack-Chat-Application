'use client';
import React, { useEffect, useRef } from 'react'; // Removed unused useState
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
        isBlocked, isLoadingMore, isInitialLoad
    } = useConversation(activeUser);

    // NEW: Ref to track previous history length for detecting prepends/appends
    const prevHistoryLengthRef = useRef(chatHistory.length);

    // Virtualizer setup (increased estimateSize for better handling of media messages)
    const virtualizer = useVirtualizer({
        count: chatHistory.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 100, // CHANGED: Was 80; better for variable heights (text + media)
        overscan: 5,
        measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
            ? (element) => element?.getBoundingClientRect().height
            : undefined,
    });
    const items = virtualizer.getVirtualItems();

    // NEW: General auto-scroll for appends (new messages) + prepend detection
    useEffect(() => {
        if (!containerRef.current) return;

        const lengthDelta = chatHistory.length - prevHistoryLengthRef.current;
        const oldScrollTop = containerRef.current.scrollTop;
        const oldScrollHeight = virtualizer.getTotalSize(); // Use virtual total size
        const wasNearBottom = oldScrollHeight - oldScrollTop - containerRef.current.clientHeight < 150;

        if (lengthDelta > 0) { // History grew (append or prepend)
            if (wasNearBottom && !isInitialLoad.current) {
                // Append case: Auto-scroll to new end if was near bottom (smooth for UX)
                virtualizer.scrollToIndex(chatHistory.length - 1, { align: 'end', behavior: 'smooth' });
            } else if (isLoadingMore) {
                // Prepend case (load more older): Scroll to the start of the old content to prevent jump (instant)
                virtualizer.scrollToIndex(lengthDelta, { align: 'start', behavior: 'auto' });
            }
        }

        prevHistoryLengthRef.current = chatHistory.length;
    }, [chatHistory.length, virtualizer, isLoadingMore, isInitialLoad]); // Dependencies: Trigger on length or load more changes

    // CHANGED: Auto-scroll to bottom on initial load (use scrollToIndex for virtual accuracy; try without timeout first)
    useEffect(() => {
        if (!isLoadingHistory && chatHistory.length > 0 && isInitialLoad.current && containerRef.current) {
            virtualizer.scrollToIndex(chatHistory.length - 1, { align: 'end', behavior: 'auto' });
            isInitialLoad.current = false;
        }
    }, [isLoadingHistory, chatHistory.length, virtualizer]); // Removed timeout—add back as setTimeout(..., 100) if heights still load async

    // REMOVED: The send-message auto-scroll effect (now handled by the general append useEffect above)

    const scrollToBottom = () => {
        if (containerRef.current) {
            virtualizer.scrollToIndex(chatHistory.length - 1, { align: 'end', behavior: 'smooth' });
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
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] z-0"></div>
            <div className="flex-none z-10 w-full">
                <ChatHeader user={activeUser} isTyping={isRemoteTyping} />
            </div>
            <div
                ref={containerRef}
                onScroll={handleScroll}
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
                        className="p-4 md:px-8 md:py-4"
                    >
                        {/* Pagination loader */}
                        {isLoadingMore && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 text-primary animate-spin opacity-60" />
                            </div>
                        )}
                        {items.map((virtualRow) => {
                            const msg = chatHistory[virtualRow.index];
                            const previousMsg = chatHistory[virtualRow.index - 1];
                            const nextMsg = chatHistory[virtualRow.index + 1];
                            const isFromMe = msg.username !== activeUser.username;
                            const isFirstInGroup = !previousMsg || previousMsg.username !== msg.username ||
                                getMessageDateLabel(msg.timestamp) !== getMessageDateLabel(previousMsg.timestamp);
                            const isLastInGroup = !nextMsg || nextMsg.username !== msg.username;
                            const showDateHeader = virtualRow.index === 0 ||
                                getMessageDateLabel(msg.timestamp) !== getMessageDateLabel(chatHistory[virtualRow.index - 1].timestamp);
                            return (
                                <div
                                    key={virtualRow.key}
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
                                        <div className="flex justify-center my-6">
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