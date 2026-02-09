import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { User, Message } from '@/types';
import { api } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

export const useConversation = (activeUser: User | null) => {
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState<(Message & { isLocal?: boolean })[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [isRemoteTyping, setIsRemoteTyping] = useState(false);

    // Refs for internal logic (debouncing, deduping)
    const isInitialLoad = useRef(true);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmitRef = useRef<number>(0);
    const activeUserRef = useRef(activeUser);
    const conversationIdRef = useRef(conversationId);

    useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);
    useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

    const socket = useSocket();
    const currentUser = useAuthStore((state) => state.user);
    const isBlocked = activeUser?.hasBlocked || activeUser?.isBlockedBy;

    // 1. Reset state when switching users
    useEffect(() => {
        if (activeUser?.id) {
            isInitialLoad.current = true;
            setHasMore(false);
            setChatHistory([]);
            setMessage('');
            setReplyTo(null);
        }
    }, [activeUser?.id]);

    // 2. Load More Action (Exposed to UI)
    const loadMoreMessages = useCallback(() => {
        if (!socket || !conversationId || !hasMore || isLoadingMore || chatHistory.length === 0) return;

        setIsLoadingMore(true);
        const oldestMessageId = chatHistory[0].id;
        socket.emit("load_more_messages", { conversationId, cursor: oldestMessageId });
    }, [socket, conversationId, hasMore, isLoadingMore, chatHistory]);

    // 3. Socket Event Listeners
    useEffect(() => {
        if (!socket || !activeUser?.id) return;

        setIsLoadingHistory(true);
        setChatHistory([]); // Clear previous chat immediately on switch

        socket.emit("join_conversation", { recipientId: activeUser.id });

        const handleConversationJoined = (data: { conversationId: string }) => {
            setConversationId(data.conversationId);
            socket.emit("mark_as_read", {
                conversationId: data.conversationId,
                recipientId: activeUserRef.current?.id
            });
        };

        const handleLoadHistory = (data: { messages: Message[], hasMore: boolean }) => {
            setChatHistory(data.messages);
            setHasMore(data.hasMore);
            setIsLoadingHistory(false);
            isInitialLoad.current = false;
        };

        const handleMoreMessagesLoaded = (data: { messages: Message[], hasMore: boolean }) => {
            // Prepend new messages to the top
            setChatHistory(prev => [...data.messages, ...prev]);
            setHasMore(data.hasMore);
            setIsLoadingMore(false);
        };

        const handleReceiveMessage = (newMessage: Message) => {
            setChatHistory((prev) => {
                // Remove local optimistic version if it exists
                const filtered = prev.filter(m =>
                    !m.isLocal ||
                    (m.isLocal && m.attachmentUrl !== newMessage.attachmentUrl && m.id !== newMessage.id)
                );
                // Deduplicate
                if (filtered.some(m => m.id === newMessage.id)) return filtered;
                return [...filtered, newMessage];
            });

            if (newMessage.authorId === activeUserRef.current?.id) {
                setIsRemoteTyping(false);
                // Mark read if window is focused
                if (document.visibilityState === 'visible') {
                    socket.emit("mark_as_read", {
                        conversationId: newMessage.conversationId,
                        recipientId: activeUserRef.current?.id
                    });
                }
            }
        };

        const handleMessageDeleted = (deletedMsg: Message) => {
            setChatHistory(prev => prev.map(msg => msg.id === deletedMsg.id ? deletedMsg : msg));
        };

        const handleUserTyping = (data: { userId: string }) => {
            if (data.userId === activeUserRef.current?.id) setIsRemoteTyping(true);
        };
        const handleUserStopTyping = (data: { userId: string }) => {
            if (data.userId === activeUserRef.current?.id) setIsRemoteTyping(false);
        };
        const handleMessagesRead = (data: { conversationId: string, readerId: string }) => {
            if (data.conversationId === conversationIdRef.current && data.readerId === activeUserRef.current?.id) {
                setChatHistory(prev => prev.map(msg => ({ ...msg, isRead: true })));
            }
        };

        socket.on("conversation_joined", handleConversationJoined);
        socket.on("load_history", handleLoadHistory);
        socket.on("more_messages_loaded", handleMoreMessagesLoaded);
        socket.on("receive_message", handleReceiveMessage);
        socket.on("message_deleted", handleMessageDeleted);
        socket.on("user_typing", handleUserTyping);
        socket.on("user_stop_typing", handleUserStopTyping);
        socket.on("messages_read", handleMessagesRead);

        return () => {
            socket.off("conversation_joined", handleConversationJoined);
            socket.off("load_history", handleLoadHistory);
            socket.off("more_messages_loaded", handleMoreMessagesLoaded);
            socket.off("receive_message", handleReceiveMessage);
            socket.off("message_deleted", handleMessageDeleted);
            socket.off("user_typing", handleUserTyping);
            socket.off("user_stop_typing", handleUserStopTyping);
            socket.off("messages_read", handleMessagesRead);
        };
    }, [socket, activeUser?.id, currentUser?.id]);

    const sendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isBlocked) return;
        if (!message.trim() || !socket || !activeUser || !conversationId) return;

        const tempId = uuidv4();
        const optimisticMessage: Message & { isLocal?: boolean } = {
            id: tempId,
            conversationId,
            authorId: currentUser!.id,
            username: currentUser!.username,
            image: currentUser!.image,
            message: message,
            content: message,
            messageType: 'TEXT',
            attachmentUrl: null,
            isDeleted: false,
            isRead: false,
            timestamp: new Date().toISOString(),
            isLocal: true,
            replyTo: replyTo ? { id: replyTo.id, username: replyTo.username, content: replyTo.content || "Media" } : null
        };

        setChatHistory(prev => [...prev, optimisticMessage]);

        socket.emit("send_message", {
            conversationId,
            recipientId: activeUser.id,
            message,
            replyToId: replyTo?.id
        });

        setMessage('');
        setReplyTo(null);
        socket.emit("stop_typing", { conversationId, recipientId: activeUser.id });
    };

    const sendMediaMessage = async (file: File, caption: string) => {
        if (isBlocked || !conversationId || !activeUser || !socket || !currentUser) return;
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
            replyTo: replyTo ? {
                id: replyTo.id,
                username: replyTo.username,
                content: replyTo.content || "Media"
            } : null
        };

        setChatHistory(prev => [...prev, optimisticMessage]);
        setReplyTo(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/users/upload-media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const { url, type: serverType } = response.data.data;

            setChatHistory(prev => prev.map(msg =>
                msg.id === tempId ? { ...msg, attachmentUrl: url } : msg
            ));

            socket.emit("send_message", {
                conversationId,
                recipientId: activeUser.id,
                message: caption,
                replyToId: replyTo?.id,
                attachmentUrl: url,
                messageType: serverType
            });
        } catch (error) {
            setChatHistory(prev => prev.filter(m => m.id !== tempId));
            throw error;
        }
    };

    const deleteMessage = (messageId: string) => {
        if (!socket || !conversationId) return;
        socket.emit("delete_message", { conversationId, messageId });
    };

    const handleTyping = useCallback((text: string) => {
        setMessage(text);
        if (!socket || !conversationId || !activeUser || currentUser?.isPrivate || isBlocked) return;

        const now = Date.now();
        if (now - lastTypingEmitRef.current > 2000) {
            socket.emit("typing", { conversationId, recipientId: activeUser.id });
            lastTypingEmitRef.current = now;
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (activeUser) socket.emit("stop_typing", { conversationId, recipientId: activeUser.id });
        }, 3000);
    }, [socket, conversationId, activeUser, currentUser, isBlocked]);

    // Note: No scrollToBottom or containerRef here!
    return {
        message,
        setMessage: handleTyping,
        chatHistory,
        isLoadingHistory,
        sendMessage,
        sendMediaMessage,
        deleteMessage,
        replyTo,
        setReplyTo,
        isRemoteTyping,
        isBlocked,
        isLoadingMore,
        conversationId,
        loadMoreMessages // We export this so the UI can call it
    };
};