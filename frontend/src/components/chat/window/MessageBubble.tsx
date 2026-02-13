import React, { useState, useRef, useEffect, memo } from 'react';
import { Message } from '@/types';
import { formatMessageTime } from '@/lib/dateUtils';
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
    onMediaLoad?: () => void; // ---> FIX: Added optional prop
}

export const MessageBubble = memo(function MessageBubble({ message, isFromMe, isFirstInGroup, isLastInGroup, onReply, onDelete, onMediaLoad }: MessageBubbleProps) {
    const canDelete = isFromMe && !message.isDeleted && !message.isLocal;

    // UI States
    const [showActionsMobile, setShowActionsMobile] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    // Gestures Refs
    const touchStartRef = useRef<number>(0);
    const touchEndRef = useRef<number>(0);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Swipe state for animation
    const [swipeTranslate, setSwipeTranslate] = useState(0);
    const bubbleRef = useRef<HTMLDivElement>(null);

    // Auto-hide actions after 3 seconds if tapped on mobile
    useEffect(() => {
        if (showActionsMobile) {
            const timer = setTimeout(() => setShowActionsMobile(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showActionsMobile]);

    // --- HANDLERS ---

    const handleDeleteClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (isConfirmingDelete) {
            onDelete(message.id);
            setIsConfirmingDelete(false);
        } else {
            setIsConfirmingDelete(true);
            setTimeout(() => setIsConfirmingDelete(false), 3000);
        }
    };

    // MOBILE GESTURES
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = e.targetTouches[0].clientX;

        // Start Long Press Timer
        longPressTimerRef.current = setTimeout(() => {
            setShowActionsMobile(true); // Show actions on long press
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
        }, 500);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndRef.current = e.targetTouches[0].clientX;
        // If moving significantly, cancel long press
        if (Math.abs(touchStartRef.current - touchEndRef.current) > 10) {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        }

        // Calculates swipe direction and amount
        const delta = touchEndRef.current - touchStartRef.current;
        if (isFromMe) {
            // For own messages (right-aligned): Swipe left (negative delta)
            if (delta < 0 && !message.isDeleted) {
                setSwipeTranslate(Math.max(delta, -80)); // Cap at -80px
            }
        } else {
            // For other's messages (left-aligned): Swipe right (positive delta)
            if (delta > 0 && !message.isDeleted) {
                setSwipeTranslate(Math.min(delta, 80)); // Cap at 80px
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

        // Detect Swipe to Reply (>50px in correct direction)
        const delta = touchEndRef.current - touchStartRef.current;
        const swipeThreshold = 50;
        if (isFromMe) {
            if (delta < -swipeThreshold && touchEndRef.current !== 0 && !message.isDeleted) {
                onReply(message);
                if (navigator.vibrate) navigator.vibrate(30);
            }
        } else {
            if (delta > swipeThreshold && touchEndRef.current !== 0 && !message.isDeleted) {
                onReply(message);
                if (navigator.vibrate) navigator.vibrate(30);
            }
        }

        // Animate back to 0
        setSwipeTranslate(0);

        // Reset
        touchStartRef.current = 0;
        touchEndRef.current = 0;
    };

    // --- STYLES ---
    const myClasses = `bg-primary text-white 
        ${isFirstInGroup ? 'rounded-tr-none' : 'rounded-tr-xl'} 
        ${isLastInGroup ? 'rounded-br-xl' : 'rounded-br-xl'} 
        rounded-l-xl shadow-sm`;

    const theirClasses = `bg-white dark:bg-[#202c33] border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100
        ${isFirstInGroup ? 'rounded-tl-none' : 'rounded-tl-xl'} 
        ${isLastInGroup ? 'rounded-bl-xl' : 'rounded-bl-xl'} 
        rounded-r-xl shadow-sm`;

    return (
        <div
            className={`
                group/row flex w-full 
                ${isFromMe ? 'justify-end' : 'justify-start'} 
                ${isLastInGroup ? 'mb-3' : 'mb-0.5'}
                animate-in fade-in zoom-in-95 duration-200 select-none
            `}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className={`
                flex items-end gap-1 max-w-[95%] md:max-w-[85%]
                ${isFromMe ? 'flex-row' : 'flex-row-reverse'} 
            `}>

                {/* 🛠️ Action Buttons (Inlined) */}
                <div className={`
                    flex items-center gap-1.5 px-2 transition-opacity duration-200 
                    ${isFromMe ? 'justify-end' : 'justify-start'}
                    ${showActionsMobile ? 'opacity-100' : 'opacity-0 md:group-hover/row:opacity-100'} 
                `}>
                    {/* Reply */}
                    {!message.isDeleted && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onReply(message); }}
                            className="p-2 md:p-1.5 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors bg-white/50 md:bg-transparent shadow-sm md:shadow-none"
                            title="Reply"
                        >
                            <Reply className="w-5 h-5 md:w-4 md:h-4" />
                        </button>
                    )}

                    {/* Delete */}
                    {canDelete && (
                        <button
                            onClick={handleDeleteClick}
                            className={`p-2 md:p-1.5 rounded-full transition-colors flex items-center gap-1 bg-white/50 md:bg-transparent shadow-sm md:shadow-none ${
                                isConfirmingDelete
                                    ? "bg-red-50 text-red-600 dark:bg-red-900/20"
                                    : "text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                            }`}
                            title="Delete"
                        >
                            <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                            {isConfirmingDelete && <span className="text-[10px] font-bold uppercase hidden md:inline">Confirm</span>}
                        </button>
                    )}
                </div>

                {/* THE BUBBLE */}
                <div
                    ref={bubbleRef}
                    onClick={() => setShowActionsMobile(!showActionsMobile)}
                    className={`
                        relative overflow-hidden flex-1
                        ${isFromMe ? myClasses : theirClasses}
                        ${message.isLocal ? 'opacity-90' : 'opacity-100'} 
                        transition-all duration-200 cursor-pointer active:scale-[0.98]
                    `}
                    style={{
                        transform: `translateX(${swipeTranslate}px)`,
                        transition: swipeTranslate === 0 ? 'transform 0.2s ease-out' : 'none'
                    }}
                >

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

                    {!message.isDeleted && message.attachmentUrl && (
                        <div className="p-1 pb-0">
                            <MediaAttachment
                                url={message.attachmentUrl}
                                type={message.messageType as 'IMAGE' | 'VIDEO'}
                                isLocal={message.isLocal}
                                onLoad={onMediaLoad} // ---> FIX: Pass to media component
                            />
                        </div>
                    )}

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

                        <span className={`text-[10px] ml-auto flex items-center gap-1 whitespace-nowrap ${isFromMe ? 'text-white/70' : 'text-zinc-400'} pt-1`}>
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