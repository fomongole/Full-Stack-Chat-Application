import React, { useState, useEffect, useRef, memo } from 'react';
import { Message } from '@/types';
import { formatMessageTime } from '@/lib/dateUtils';
import { useAuthStore } from '@/store/useAuthStore';
import { MediaAttachment } from './MediaAttachment';
import { Check, CheckCheck, Trash2, Reply } from 'lucide-react';

interface ExtendedMessage extends Message {
    isLocal?: boolean;
}

interface MessageBubbleProps {
    message: ExtendedMessage;
    isFromMe: boolean;
    isFirstInGroup: boolean;
    isLastInGroup: boolean;
    onReply: (msg: Message) => void;
    onDelete: (id: string) => void;
}

export const MessageBubble = memo(function MessageBubble({ message, isFromMe, isFirstInGroup, isLastInGroup, onReply, onDelete }: MessageBubbleProps) {
    // const currentUser = useAuthStore(state => state.user);
    const canDelete = isFromMe && !message.isDeleted && !message.isLocal;
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleDeleteClick = () => {
        if (isConfirmingDelete) {
            onDelete(message.id);
            setIsConfirmingDelete(false);
        } else {
            setIsConfirmingDelete(true);
            timeoutRef.current = setTimeout(() => setIsConfirmingDelete(false), 3000);
        }
    };

    // --- 1. Bubble Shape Logic ---
    const myClasses = `bg-primary text-white 
        ${isFirstInGroup ? 'rounded-tr-none' : 'rounded-tr-xl'} 
        ${isLastInGroup ? 'rounded-br-xl' : 'rounded-br-xl'} 
        rounded-l-xl shadow-sm`;

    const theirClasses = `bg-white dark:bg-[#202c33] border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100
        ${isFirstInGroup ? 'rounded-tl-none' : 'rounded-tl-xl'} 
        ${isLastInGroup ? 'rounded-bl-xl' : 'rounded-bl-xl'} 
        rounded-r-xl shadow-sm`;

    // --- 2. The Action Buttons Component ---
    const ActionButtons = () => (
        <div className={`
            flex items-center gap-1.5 px-2 
            opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 
            ${isFromMe ? 'justify-end' : 'justify-start'}
        `}>
            {/* Reply */}
            <button
                onClick={() => onReply(message)}
                className="p-1.5 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                title="Reply"
            >
                <Reply className="w-4 h-4" />
            </button>

            {/* Delete */}
            {canDelete && (
                <button
                    onClick={handleDeleteClick}
                    className={`p-1.5 rounded-full transition-colors flex items-center gap-1 ${
                        isConfirmingDelete
                            ? "bg-red-50 text-red-600 dark:bg-red-900/20"
                            : "text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                    }`}
                    title="Delete"
                >
                    <Trash2 className="w-4 h-4" />
                    {isConfirmingDelete && <span className="text-[10px] font-bold uppercase">Confirm</span>}
                </button>
            )}
        </div>
    );

    // --- 3. Render Layout ---
    return (
        <div className={`
            group/row flex w-full 
            ${isFromMe ? 'justify-end' : 'justify-start'} 
            ${isLastInGroup ? 'mb-3' : 'mb-0.5'}
            animate-in fade-in zoom-in-95 duration-200
        `}>
            {/* FLEX CONTAINER: Keeps buttons and bubble side-by-side */}
            <div className={`
                flex items-end gap-1 max-w-[95%] md:max-w-[85%]
                ${isFromMe ? 'flex-row' : 'flex-row-reverse'} 
            `}>

                {/* SIDE A: Action Buttons (Left for Me, Right for Them via flex-row-reverse) */}
                <ActionButtons />

                {/* SIDE B: The Actual Bubble */}
                <div className={`
                    relative overflow-hidden flex-1
                    ${isFromMe ? myClasses : theirClasses}
                    ${message.isLocal ? 'opacity-90' : 'opacity-100'} 
                    transition-all duration-200
                `}>

                    {/* Reply Context (Inside Bubble) */}
                    {message.replyTo && (
                        <div className={`m-1 p-2 rounded-lg text-xs border-l-4 mb-1 ${
                            isFromMe
                                ? 'bg-black/20 border-white/50 text-white/90'
                                : 'bg-zinc-100 dark:bg-black/20 border-primary text-zinc-600 dark:text-zinc-300'
                        }`}>
                            <span className="font-bold block mb-0.5">{message.replyTo.username}</span>
                            <span className="truncate block opacity-80 line-clamp-1">
                                {message.replyTo.messageType !== 'TEXT' ? '📷 Media' : message.replyTo.content}
                            </span>
                        </div>
                    )}

                    {/* Media Content */}
                    {!message.isDeleted && message.attachmentUrl && (
                        <div className="p-1 pb-0">
                            <MediaAttachment
                                url={message.attachmentUrl}
                                type={message.messageType as 'IMAGE' | 'VIDEO'}
                                isLocal={message.isLocal}
                            />
                        </div>
                    )}

                    {/* Text & Meta */}
                    <div className={`
                        flex flex-wrap items-end gap-2 px-3 py-1.5
                        ${!message.message && message.attachmentUrl ? 'pb-2' : ''}
                    `}>
                        {(message.message || message.isDeleted) && (
                            <span className={`text-[15px] leading-relaxed break-words max-w-full ${message.isDeleted ? "italic opacity-60 text-sm" : ""}`}>
                                {message.isDeleted && <span className="inline-flex items-center gap-1 mr-1 text-xs">🚫</span>}
                                {message.message}
                            </span>
                        )}

                        <span className={`text-[10px] ml-auto flex items-center gap-1 whitespace-nowrap ${isFromMe ? 'text-white/70' : 'text-zinc-400'} pt-1 select-none`}>
                            {message.isLocal ? "Sending..." : formatMessageTime(message.timestamp)}
                            {isFromMe && !message.isDeleted && !message.isLocal && (
                                <span title={message.isRead ? "Read" : "Sent"}>
                                    {message.isRead ? <CheckCheck className="w-3.5 h-3.5 text-white/90" /> : <Check className="w-3.5 h-3.5 text-white/60" />}
                                </span>
                            )}
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}, (prev, next) => {
    return prev.message.id === next.message.id &&
        prev.message.isRead === next.message.isRead &&
        prev.message.isDeleted === next.message.isDeleted &&
        prev.message.attachmentUrl === next.message.attachmentUrl &&
        prev.isFirstInGroup === next.isFirstInGroup &&
        prev.isLastInGroup === next.isLastInGroup;
});