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
    const [unreadBelowCount, setUnreadBelowCount] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const isInitialLoad = useRef(true);
    const countedMessageIds = useRef<Set<string>>(new Set());

    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmitRef = useRef<number>(0);
    const activeUserRef = useRef(activeUser);
    const conversationIdRef = useRef(conversationId);

    // CRITICAL: Keep this as a ref to allow the Page component
    // to coordinate scroll anchoring without re-renders.
    const isPaginationInProgress = useRef(false);

    useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);
    useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

    const socket = useSocket();
    const currentUser = useAuthStore((state) => state.user);
    const isBlocked = activeUser?.hasBlocked || activeUser?.isBlockedBy;

    /**
     * Load more messages (pagination)
     */
    const loadMoreMessages = useCallback(() => {
        if (!socket || !conversationId || !hasMore || isLoadingMore || chatHistory.length === 0) return;

        // Flag that we are prepending data so the Virtualizer can anchor the scroll
        isPaginationInProgress.current = true;
        setIsLoadingMore(true);

        const oldestMessageId = chatHistory[0].id;
        socket.emit("load_more_messages", { conversationId, cursor: oldestMessageId });
    }, [socket, conversationId, hasMore, isLoadingMore, chatHistory]);

    /**
     * Scroll handler - triggered by the UI
     */
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;

        // Trigger pagination when scrolled near top
        if (scrollTop < 100 && hasMore && !isLoadingMore && chatHistory.length > 0) {
            loadMoreMessages();
        }

        // Clear unread counter when near bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        if (isNearBottom) {
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, [hasMore, isLoadingMore, loadMoreMessages, chatHistory.length]);

    /**
     * Reset state when active user changes
     */
    useEffect(() => {
        if (activeUser?.id) {
            isInitialLoad.current = true;
            isPaginationInProgress.current = false;
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
            setHasMore(false);
            setChatHistory([]);
        }
    }, [activeUser?.id]);

    /**
     * Socket event listeners
     */
    useEffect(() => {
        if (!socket || !activeUser?.id) return;

        setIsLoadingHistory(true);
        setChatHistory([]);
        isInitialLoad.current = true;

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
        };

        const handleMoreMessagesLoaded = (data: { messages: Message[], hasMore: boolean }) => {
            // Prepend older messages
            setChatHistory(prev => [...data.messages, ...prev]);
            setHasMore(data.hasMore);
            setIsLoadingMore(false);
            // Note: isPaginationInProgress is reset by the Page component after scroll is adjusted
        };

        const handleReceiveMessage = (newMessage: Message) => {
            setChatHistory((prev) => {
                const filtered = prev.filter(m =>
                    !m.isLocal ||
                    (m.isLocal && m.attachmentUrl !== newMessage.attachmentUrl && m.id !== newMessage.id)
                );
                if (filtered.some(m => m.id === newMessage.id)) return filtered;
                return [...filtered, newMessage];
            });

            const container = containerRef.current;
            const isFromOther = newMessage.authorId !== currentUser?.id;

            if (container && isFromOther) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
                if (!isNearBottom && !countedMessageIds.current.has(newMessage.id)) {
                    setUnreadBelowCount(prev => prev + 1);
                    countedMessageIds.current.add(newMessage.id);
                }
            }

            if (newMessage.authorId === activeUserRef.current?.id) {
                setIsRemoteTyping(false);
            }

            if (document.visibilityState === 'visible' && newMessage.conversationId === conversationIdRef.current) {
                socket.emit("mark_as_read", {
                    conversationId: newMessage.conversationId,
                    recipientId: activeUserRef.current?.id
                });
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

    /**
     * Send text message
     */
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

    /**
     * Send media message
     */
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

    // UI-facing scroll to bottom
    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth'
            });
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, []);

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
        containerRef,
        unreadBelowCount,
        setUnreadBelowCount,
        handleScroll,
        isBlocked,
        isLoadingMore,
        isInitialLoad,
        scrollToBottom,
        conversationId,
        isPaginationInProgress // This is now a RefObject
    };
};