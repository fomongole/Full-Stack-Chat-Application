import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { User, Message } from '@/types';
import { api } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

export const useConversation = (activeUser: User | null) => {
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState<(Message & { isLocal?: boolean })[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // PAGINATION STATES
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [conversationId, setConversationId] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [isRemoteTyping, setIsRemoteTyping] = useState(false);
    const [unreadBelowCount, setUnreadBelowCount] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isInitialLoad = useRef(true);

    // REFS FOR LOGIC CONTROL
    const countedMessageIds = useRef<Set<string>>(new Set());
    const isDeletingRef = useRef(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmitRef = useRef<number>(0);
    const activeUserRef = useRef(activeUser);
    const conversationIdRef = useRef(conversationId);

    // SCROLL RESTORATION REFS (Snapshot Pattern)
    const paginationScrollSnapshot = useRef<number | null>(null);
    const lastMessageIdRef = useRef<string | null>(null); // Tracks the ID of the bottom-most message

    useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);
    useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

    const socket = useSocket();
    const currentUser = useAuthStore((state) => state.user);

    const isBlocked = activeUser?.hasBlocked || activeUser?.isBlockedBy;

    // ----------------------------------------------------
    // SCROLL ACTIONS
    // ----------------------------------------------------
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior });
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, []);

    const handleAutoScroll = useCallback((newMsgAuthorId?: string) => {
        const container = containerRef.current;
        if (!container) return;

        if (isInitialLoad.current) {
            scrollToBottom('auto');
            isInitialLoad.current = false;
            return;
        }

        // If I sent the message, force scroll to bottom
        if (newMsgAuthorId === currentUser?.id) {
            scrollToBottom('smooth');
            return;
        }

        // If I am already near the bottom, stay at the bottom
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
            scrollToBottom('smooth');
        }
    }, [currentUser?.id, scrollToBottom]);

    const loadMoreMessages = useCallback(() => {
        if (!socket || !conversationId || !hasMore || isLoadingMore || chatHistory.length === 0) return;

        // 1. CAPTURE SNAPSHOT: Before fetching/rendering, record where we are relative to the bottom
        if (containerRef.current) {
            paginationScrollSnapshot.current = containerRef.current.scrollHeight - containerRef.current.scrollTop;
        }

        setIsLoadingMore(true);
        const oldestMessageId = chatHistory[0].id;
        socket.emit("load_more_messages", { conversationId, cursor: oldestMessageId });
    }, [socket, conversationId, hasMore, isLoadingMore, chatHistory]);

    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        // PAGINATION TRIGGER
        if (container.scrollTop < 50 && hasMore && !isLoadingMore) {
            loadMoreMessages();
        }

        // UNREAD COUNT LOGIC
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, [hasMore, isLoadingMore, loadMoreMessages]);

    useEffect(() => {
        if (activeUser?.id) {
            isInitialLoad.current = true;
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
            setHasMore(false);
            // Reset refs
            lastMessageIdRef.current = null;
            paginationScrollSnapshot.current = null;
        }
    }, [activeUser?.id]);

    // ----------------------------------------------------
    // SCROLL RESTORATION & AUTO-SCROLL
    // ----------------------------------------------------

    // 1. SCROLL ANCHORING (Prevents jump when loading previous messages)
    useLayoutEffect(() => {
        // useLayoutEffect fires synchronously after DOM mutations but before paint.
        // This is the industry standard place to adjust scroll positions to prevent "visual jumps".
        if (paginationScrollSnapshot.current !== null && containerRef.current) {
            const container = containerRef.current;
            // Restore position: New Scroll Height - Old Distance from Bottom
            container.scrollTop = container.scrollHeight - paginationScrollSnapshot.current;
            paginationScrollSnapshot.current = null; // Consume the snapshot
            setIsLoadingMore(false); // Unlock loading state
        }
    }, [chatHistory]); // Runs every time history updates

    // 2. AUTO-SCROLL (Handles New Messages)
    useEffect(() => {
        // Deletion Guard
        if (isDeletingRef.current) {
            isDeletingRef.current = false;
            return;
        }

        const lastMessage = chatHistory[chatHistory.length - 1];

        // BOTTOM MESSAGE GUARD:
        // Check if the bottom message has actually changed.
        // If chatHistory updated but the last message ID is the same,
        // it means we prepended (pagination) or edited. We should NOT scroll to bottom.
        const isNewBottomMessage = lastMessage && lastMessage.id !== lastMessageIdRef.current;

        if (isNewBottomMessage) {
            // Update our tracker
            lastMessageIdRef.current = lastMessage.id;

            // Only trigger auto-scroll if it's not a pagination event
            if (!isLoadingHistory && paginationScrollSnapshot.current === null) {
                handleAutoScroll(lastMessage.authorId);
            }
        }
    }, [chatHistory, isLoadingHistory, handleAutoScroll]);


    // ----------------------------------------------------
    // SOCKET LISTENERS
    // ----------------------------------------------------
    useEffect(() => {
        if (!socket || !activeUser?.id) return;

        setIsLoadingHistory(true);
        setChatHistory([]);

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
            // Initialize lastMessageId so first auto-scroll works correctly
            if (data.messages.length > 0) {
                lastMessageIdRef.current = data.messages[data.messages.length - 1].id;
            }
        };

        const handleMoreMessagesLoaded = (data: { messages: Message[], hasMore: boolean }) => {
            // NOTE: We do NOT handle scroll logic here anymore.
            // We just update state. useLayoutEffect handles the anchoring based on paginationScrollSnapshot.
            setChatHistory(prev => [...data.messages, ...prev]);
            setHasMore(data.hasMore);
            // isLoadingMore is set to false in useLayoutEffect after scroll is restored
        };

        const handleReceiveMessage = (newMessage: Message) => {
            setChatHistory((prev) => {
                const filtered = prev.filter(m => !m.isLocal || (m.isLocal && m.attachmentUrl !== newMessage.attachmentUrl && m.id !== newMessage.id));
                if (filtered.some(m => m.id === newMessage.id)) return filtered;
                return [...filtered, newMessage];
            });

            const container = containerRef.current;
            const isFromOther = newMessage.authorId !== currentUser?.id;

            if (container && isFromOther) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                if (!isNearBottom && !countedMessageIds.current.has(newMessage.id)) {
                    setUnreadBelowCount(prev => prev + 1);
                    countedMessageIds.current.add(newMessage.id);
                }
            }

            if (newMessage.authorId === activeUserRef.current?.id) setIsRemoteTyping(false);

            if (document.visibilityState === 'visible' && newMessage.conversationId === conversationIdRef.current) {
                socket.emit("mark_as_read", {
                    conversationId: newMessage.conversationId,
                    recipientId: activeUserRef.current?.id
                });
            }
        };

        const handleMessageDeleted = (deletedMsg: Message) => {
            isDeletingRef.current = true; // Set flag before update
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

    // --- ACTIONS ---
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
        // Direct scroll call for own message (no need to wait for effect)
        scrollToBottom('smooth');

        socket.emit("send_message", { conversationId, recipientId: activeUser.id, message, replyToId: replyTo?.id });

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
            id: tempId, conversationId, authorId: currentUser.id, username: currentUser.username,
            image: currentUser.image, message: caption, content: caption, messageType: type,
            attachmentUrl: objectUrl, isDeleted: false, isRead: false, timestamp: new Date().toISOString(),
            isLocal: true, replyTo: replyTo ? { id: replyTo.id, username: replyTo.username, content: replyTo.content || "Media" } : null
        };
        setChatHistory(prev => [...prev, optimisticMessage]);
        setReplyTo(null);
        scrollToBottom('smooth');

        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await api.post('/users/upload-media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const { url, type: serverType } = response.data.data;
            setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, attachmentUrl: url } : msg));
            socket.emit("send_message", { conversationId, recipientId: activeUser.id, message: caption, replyToId: replyTo?.id, attachmentUrl: url, messageType: serverType });
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

    return {
        message, setMessage: handleTyping, chatHistory, isLoadingHistory,
        sendMessage, sendMediaMessage, deleteMessage, replyTo, setReplyTo,
        isRemoteTyping, scrollRef, containerRef, unreadBelowCount,
        scrollToBottom, handleScroll, isBlocked,
        isLoadingMore
    };
};