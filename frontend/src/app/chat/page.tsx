'use client';
import React from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useConversation } from '@/hooks/chat/window/useConversation';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { ChatHeader } from '@/components/chat/window/ChatHeader';
import { ChatInput } from '@/components/chat/window/ChatInput';
import { MessageList } from '@/components/chat/window/MessageList';
import { ChevronDown } from 'lucide-react';

/**
 * Refactored ChatPage - Clean orchestrator.
 *
 * Responsibilities:
 * - Layout composition
 * - Data flow coordination
 * - Conditional rendering of UI states
 *
 * NOT responsible for:
 * - Socket event handling (delegated to useSocketEvents)
 * - State management (delegated to useMessageState)
 * - Scroll logic (delegated to useScrollBehavior + MessageList)
 * - Message rendering (delegated to MessageList)
 * - Action handling (delegated to useMessageActions)
 */
export default function ChatPage() {
    const activeUser = useChatStore((state) => state.activeUser) as User | null;
    const currentUser = useAuthStore((state) => state.user);

    const {
        message,
        setMessage,
        chatHistory,
        isLoadingHistory,
        sendMessage,
        sendMediaMessage,
        deleteMessage,
        replyTo,
        setReplyTo,
        isRemoteTyping,
        containerRef,
        unreadBelowCount,
        handleScroll,
        isBlocked,
        isLoadingMore,
        scrollToBottom,
    } = useConversation(activeUser);

    // Empty state when no user selected
    if (!activeUser) {
        return (
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
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden relative bg-[#efeae2] dark:bg-[#0b141a]">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] z-0"></div>

            {/* Header */}
            <div className="flex-none z-10 w-full">
                <ChatHeader user={activeUser} isTyping={isRemoteTyping} />
            </div>

            {/* Message List Container */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto relative z-0 custom-scrollbar overscroll-contain !overflow-anchor-none"
                style={{ scrollBehavior: 'auto' }}
            >
                <MessageList
                    key={activeUser.id}
                    chatHistory={chatHistory}
                    currentUserId={currentUser?.id || null}
                    containerRef={containerRef}
                    isLoadingHistory={isLoadingHistory}
                    isLoadingMore={isLoadingMore}
                    onReply={setReplyTo}
                    onDelete={deleteMessage}
                    onScroll={handleScroll}
                />
            </div>

            {/* Scroll to bottom button */}
            {unreadBelowCount > 0 && (
                <button
                    onClick={scrollToBottom}
                    className="fixed bottom-24 right-6 md:right-10 z-[40] bg-white dark:bg-[#202c33] text-primary p-3 rounded-full shadow-2xl border border-zinc-200 dark:border-zinc-700 hover:scale-110 active:scale-95 transition-all animate-in slide-in-from-bottom-4 fade-in duration-300 group"
                    aria-label={`${unreadBelowCount} new messages`}
                >
                    <ChevronDown className="w-6 h-6" />
                    <span className="absolute -top-2 -right-1 min-w-[22px] h-[22px] px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-[#202c33] shadow-sm animate-in zoom-in duration-300">
                        {unreadBelowCount > 99 ? '99+' : unreadBelowCount}
                    </span>
                </button>
            )}

            {/* Input */}
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