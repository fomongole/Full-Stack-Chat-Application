import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Message } from '@/types';
import { formatMessageTime } from '@/lib/dateUtils';
import { MediaAttachment } from './MediaAttachment';
import { Check, CheckCheck, Trash2, Reply as ReplyIcon } from 'lucide-react';

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
    const canDelete = isFromMe && !message.isDeleted && !message.isLocal;

    // UI States
    const [showActionsMobile, setShowActionsMobile] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    // Framer Motion Drag values
    const dragX = useMotionValue(0);
    const replyIconOpacity = useTransform(dragX, [0, 60], [0, 1]);
    const replyIconScale = useTransform(dragX, [0, 60], [0.5, 1.2]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isConfirmingDelete) {
            onDelete(message.id);
            setIsConfirmingDelete(false);
        } else {
            setIsConfirmingDelete(true);
            setTimeout(() => setIsConfirmingDelete(false), 3000);
        }
    };

    const handleDragEnd = (_: any, info: any) => {
        // Threshold for reply: 70px
        if (info.offset.x > 70 && !message.isDeleted) {
            onReply(message);
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
        }
    };

    const myClasses = `bg-primary text-white 
        ${isFirstInGroup ? 'rounded-tr-none' : 'rounded-tr-xl'} 
        rounded-l-xl rounded-br-xl shadow-sm`;

    const theirClasses = `bg-white dark:bg-[#202c33] border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100
        ${isFirstInGroup ? 'rounded-tl-none' : 'rounded-tl-xl'} 
        rounded-r-xl rounded-bl-xl shadow-sm`;

    return (
        <div className={`group/row flex w-full relative ${isFromMe ? 'justify-end' : 'justify-start'} ${isLastInGroup ? 'mb-3' : 'mb-0.5'} px-2 overflow-hidden`}>

            {/* REPLY ICON REVEAL ON SLIDE */}
            {!isFromMe && !message.isDeleted && (
                <motion.div
                    style={{ opacity: replyIconOpacity, scale: replyIconScale }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 text-primary z-0"
                >
                    <ReplyIcon className="w-6 h-6" />
                </motion.div>
            )}

            <motion.div
                drag={!message.isDeleted ? "x" : false}
                dragConstraints={{ left: 0, right: 100 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                style={{ x: dragX }}
                className={`flex items-end gap-1 max-w-[95%] md:max-w-[85%] z-10 ${isFromMe ? 'flex-row' : 'flex-row-reverse'}`}
            >
                {/* ACTIONS (Desktop & Tap) */}
                <div className={`flex items-center gap-1.5 px-1 transition-opacity duration-200 ${isFromMe ? 'justify-end' : 'justify-start'} ${showActionsMobile ? 'opacity-100' : 'opacity-0 md:group-hover/row:opacity-100'}`}>
                    {!message.isDeleted && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onReply(message); setShowActionsMobile(false); }}
                            className="p-1.5 text-zinc-400 hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                        >
                            <ReplyIcon className="w-4 h-4" />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={handleDeleteClick}
                            className={`p-1.5 rounded-full transition-colors ${isConfirmingDelete ? "bg-red-50 text-red-600" : "text-zinc-400 hover:text-red-500 hover:bg-red-50"}`}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* THE BUBBLE */}
                <div
                    onClick={() => !message.isDeleted && setShowActionsMobile(!showActionsMobile)}
                    className={`
                        relative overflow-hidden flex-1 transition-all duration-200 cursor-pointer active:scale-[0.98]
                        ${isFromMe ? myClasses : theirClasses}
                        ${message.isLocal ? 'opacity-70' : 'opacity-100'}
                        ${message.isDeleted ? 'opacity-50 border-dashed border-2' : ''}
                    `}
                >
                    {message.replyTo && !message.isDeleted && (
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

                    {!message.isDeleted && message.attachmentUrl && (
                        <div className="p-1 pb-0">
                            <MediaAttachment
                                url={message.attachmentUrl}
                                type={message.messageType as 'IMAGE' | 'VIDEO'}
                                isLocal={message.isLocal}
                            />
                        </div>
                    )}

                    <div className="flex flex-wrap items-end gap-2 px-3 py-1.5">
                        {(message.message || message.isDeleted) && (
                            <span className={`text-[15px] leading-relaxed break-words max-w-full ${message.isDeleted ? "italic opacity-60 text-sm" : ""}`}>
                                {message.isDeleted ? "🚫 This message was deleted" : message.message}
                            </span>
                        )}

                        <span className={`text-[10px] ml-auto flex items-center gap-1 whitespace-nowrap ${isFromMe ? 'text-white/70' : 'text-zinc-400'} pt-1`}>
                            {message.isLocal ? "Sending..." : formatMessageTime(message.timestamp)}
                            {isFromMe && !message.isDeleted && !message.isLocal && (
                                <span title={message.isRead ? "Read" : "Sent"}>
                                    {message.isRead ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </motion.div>
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