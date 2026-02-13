import { useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Message, User } from '@/types';
import { api } from '@/lib/api';

interface UseMessageActionsProps {
    socket: Socket | null;
    currentUser: User | null;
    activeUser: User | null;
    conversationId: string | null;
    isBlocked: boolean;
    addOptimisticMessage: (message: Message & { isLocal?: boolean }) => void;
    updateOptimisticMessage: (tempId: string, updates: Partial<Message>) => void;
    removeOptimisticMessage: (tempId: string) => void;
    emitTyping: (conversationId: string, recipientId: string) => void;
    emitStopTyping: (conversationId: string, recipientId: string) => void;
}

/**
 * Message action handlers (send, delete, typing, etc.)
 * No state management, just actions.
 */
export const useMessageActions = ({
                                      socket,
                                      currentUser,
                                      activeUser,
                                      conversationId,
                                      isBlocked,
                                      addOptimisticMessage,
                                      updateOptimisticMessage,
                                      removeOptimisticMessage,
                                      emitTyping,
                                      emitStopTyping,
                                  }: UseMessageActionsProps) => {
    const [message, setMessage] = useState('');
    const [replyTo, setReplyTo] = useState<Message | null>(null);

    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmitRef = useRef<number>(0);

    // Prevent input state leakage across different user chats WITHOUT using useEffect.
    // Setting state directly during render when an ID changes allows React to immediately
    // throw away the stale render and restart with clean state, avoiding cascading renders.
    const [prevUserId, setPrevUserId] = useState<string | undefined>(activeUser?.id);
    if (activeUser?.id !== prevUserId) {
        setPrevUserId(activeUser?.id);
        setMessage('');
        setReplyTo(null);
    }

    /**
     * Handle typing with debounced socket emission
     */
    const handleTyping = useCallback(
        (text: string) => {
            setMessage(text);

            if (
                !socket ||
                !conversationId ||
                !activeUser ||
                isBlocked
            ) {
                return;
            }

            // Privacy Logic: If I am private, do I send typing?
            // Standard behavior: YES, to the person I am chatting with.
            // NO, to global listeners.
            // Since this emits to a specific room/user, it is safe.

            const now = Date.now();
            if (now - lastTypingEmitRef.current > 2000) {
                emitTyping(conversationId, activeUser.id);
                lastTypingEmitRef.current = now;
            }

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
                if (activeUser) {
                    emitStopTyping(conversationId, activeUser.id);
                }
            }, 3000);
        },
        [socket, conversationId, activeUser, isBlocked, emitTyping, emitStopTyping]
    );

    /**
     * Send text message
     */
    const sendMessage = useCallback(
        (e?: React.FormEvent) => {
            if (e) e.preventDefault();

            // Strict Block Check
            if (isBlocked) return;

            if (!message.trim() || !socket || !activeUser || !conversationId || !currentUser) {
                return;
            }

            const tempId = uuidv4();
            const optimisticMessage: Message & { isLocal?: boolean } = {
                id: tempId,
                conversationId,
                authorId: currentUser.id,
                username: currentUser.username,
                image: currentUser.image,
                message: message,
                content: message,
                messageType: 'TEXT',
                attachmentUrl: null,
                isDeleted: false,
                isRead: false,
                timestamp: new Date().toISOString(),
                isLocal: true,
                replyTo: replyTo
                    ? {
                        id: replyTo.id,
                        username: replyTo.username,
                        content: replyTo.content || 'Media',
                        messageType: replyTo.messageType
                    }
                    : null,
            };

            addOptimisticMessage(optimisticMessage);

            socket.emit('send_message', {
                conversationId,
                recipientId: activeUser.id,
                message,
                replyToId: replyTo?.id,
            });

            setMessage('');
            setReplyTo(null);
            emitStopTyping(conversationId, activeUser.id);
        },
        [
            isBlocked,
            message,
            socket,
            activeUser,
            conversationId,
            currentUser,
            replyTo,
            addOptimisticMessage,
            emitStopTyping,
        ]
    );

    /**
     * Send media message
     */
    const sendMediaMessage = useCallback(
        async (file: File, caption: string) => {
            if (isBlocked || !conversationId || !activeUser || !socket || !currentUser) {
                return;
            }

            const tempId = uuidv4();
            const objectUrl = URL.createObjectURL(file);
            const type = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';

            const optimisticMessage: Message & { isLocal?: boolean } = {
                id: tempId,
                conversationId,
                authorId: currentUser.id,
                username: currentUser.username,
                image: currentUser.image,
                message: caption,
                content: caption,
                messageType: type,
                attachmentUrl: objectUrl,
                isDeleted: false,
                isRead: false,
                timestamp: new Date().toISOString(),
                isLocal: true,
                replyTo: replyTo
                    ? {
                        id: replyTo.id,
                        username: replyTo.username,
                        content: replyTo.content || 'Media',
                        messageType: replyTo.messageType
                    }
                    : null,
            };

            addOptimisticMessage(optimisticMessage);
            setReplyTo(null);

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await api.post('/users/upload-media', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const { url, type: serverType } = response.data.data;

                updateOptimisticMessage(tempId, { attachmentUrl: url });

                socket.emit('send_message', {
                    conversationId,
                    recipientId: activeUser.id,
                    message: caption,
                    replyToId: replyTo?.id,
                    attachmentUrl: url,
                    messageType: serverType,
                });
            } catch (error) {
                removeOptimisticMessage(tempId);
                throw error;
            }
        },
        [
            isBlocked,
            conversationId,
            activeUser,
            socket,
            currentUser,
            replyTo,
            addOptimisticMessage,
            updateOptimisticMessage,
            removeOptimisticMessage,
        ]
    );

    const deleteMessage = useCallback(
        (messageId: string) => {
            if (!socket || !conversationId) return;
            socket.emit('delete_message', { conversationId, messageId });
        },
        [socket, conversationId]
    );

    return {
        message,
        setMessage: handleTyping,
        replyTo,
        setReplyTo,
        sendMessage,
        sendMediaMessage,
        deleteMessage,
    };
};