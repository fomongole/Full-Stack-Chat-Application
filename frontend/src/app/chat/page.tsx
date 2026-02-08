'use client';
import React from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useConversation } from '@/hooks/chat/useConversation';
import { User } from '@/types';
import { getMessageDateLabel } from '@/lib/dateUtils';

import { ChatHeader } from '@/components/chat/window/ChatHeader';
import { MessageBubble } from '@/components/chat/window/MessageBubble';
import { ChatInput } from '@/components/chat/window/ChatInput';

export default function ChatPage() {
    const activeUser = useChatStore((state) => state.activeUser) as User | null;

    const {
        message, setMessage, chatHistory, sendMessage,
        sendMediaMessage, deleteMessage, replyTo, setReplyTo,
        isRemoteTyping, scrollRef, isBlocked
    } = useConversation(activeUser);

    if (!activeUser) return (
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#f0f2f5] dark:bg-[#111b21] border-b-[6px] border-green-500">
            {/* WhatsApp Web Style Welcome Screen */}
            <div className="max-w-md text-center p-8">
                <div className="relative w-64 h-64 mx-auto mb-8 overflow-hidden rounded-full shadow-sm">
                    <img
                        src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60"
                        alt="Select Chat"
                        className="w-full h-full object-cover opacity-80"
                    />
                </div>
                <h2 className="text-3xl font-light text-[#41525d] dark:text-[#e9edef] mb-4">
                    Welcome to my Chat App
                </h2>
                <p className="text-[#667781] dark:text-[#8696a0] text-sm leading-relaxed">
                    Select a conversation from the sidebar to start messaging.
                    Send and receive messages without keeping your phone online.
                </p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full relative z-10">
            <ChatHeader user={activeUser} isTyping={isRemoteTyping} />

            <div className="flex-1 overflow-y-auto p-4 md:px-8 md:py-4 space-y-1 custom-scrollbar">
                {chatHistory.map((msg, i) => {
                    const isFromMe = msg.username !== activeUser.username;

                    // --- BUBBLE GROUPING LOGIC ---
                    const previousMsg = chatHistory[i - 1];
                    const nextMsg = chatHistory[i + 1];

                    // It is first if: No previous msg OR Previous msg is from different user OR Previous msg was a date separator away
                    const isFirstInGroup = !previousMsg || previousMsg.username !== msg.username ||
                        getMessageDateLabel(msg.timestamp) !== getMessageDateLabel(previousMsg.timestamp);

                    // It is last if: No next msg OR Next msg is from different user
                    const isLastInGroup = !nextMsg || nextMsg.username !== msg.username;

                    const showDateHeader = i === 0 ||
                        getMessageDateLabel(msg.timestamp) !== getMessageDateLabel(chatHistory[i - 1].timestamp);

                    return (
                        <React.Fragment key={msg.id || i}>
                            {showDateHeader && (
                                <div className="flex justify-center my-6 sticky top-2 z-10">
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
                        </React.Fragment>
                    );
                })}
                <div ref={scrollRef} />
            </div>

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
    );
}