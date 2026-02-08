import {useState, useEffect, useRef, useCallback, useLayoutEffect} from 'react';
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

    // GUARD: Prevents a single message from being counted twice
    const countedMessageIds = useRef<Set<string>>(new Set());

    // FLAGS: To control scroll behavior during specific updates
    const isDeletingRef = useRef(false);
    const isPaginatingRef = useRef(false);

    // CRITICAL FIX: Store scroll anchor data for pagination
    const paginationAnchorRef = useRef<{
        shouldAnchor: boolean;
        previousScrollHeight: number;
        previousScrollTop: number;
    } | null>(null);

    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmitRef = useRef<number>(0);

    const activeUserRef = useRef(activeUser);
    const conversationIdRef = useRef(conversationId);

    // For delete scroll fix
    const deleteAdjustment = useRef<{ oldHeight: number; oldScrollTop: number } | null>(null);

    useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);
    useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

    const socket = useSocket();
    const currentUser = useAuthStore((state) => state.user);
    const setActiveUser = useChatStore((state) => state.setActiveUser);

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

        // CRITICAL: Block auto-scroll during pagination
        if (isPaginatingRef.current || paginationAnchorRef.current?.shouldAnchor) {
            return;
        }

        // 1. Initial Load: Always scroll to bottom
        if (isInitialLoad.current) {
            scrollToBottom('auto');
            isInitialLoad.current = false;
            return;
        }

        // 2. If WE sent the message: Always scroll to bottom
        if (newMsgAuthorId === currentUser?.id) {
            scrollToBottom('smooth');
            return;
        }

        // 3. Incoming message: Only scroll if user is already near the bottom
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
            scrollToBottom('smooth');
        }
    }, [currentUser?.id, scrollToBottom]);

    const loadMoreMessages = useCallback(() => {
        if (!socket || !conversationId || !hasMore || isLoadingMore || chatHistory.length === 0) return;

        const container = containerRef.current;
        if (!container) return;

        // CRITICAL FIX: Capture scroll position BEFORE state update
        paginationAnchorRef.current = {
            shouldAnchor: true,
            previousScrollHeight: container.scrollHeight,
            previousScrollTop: container.scrollTop
        };

        setIsLoadingMore(true);
        isPaginatingRef.current = true;

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
            isPaginatingRef.current = false;
            paginationAnchorRef.current = null;
        }
    }, [activeUser?.id]);

    // MAIN AUTO-SCROLL EFFECT
    useEffect(() => {
        // CRITICAL: Block auto-scroll during pagination or deletion
        if (isDeletingRef.current || isPaginatingRef.current || paginationAnchorRef.current?.shouldAnchor) {
            return;
        }

        if (!isLoadingHistory && !isLoadingMore && chatHistory.length > 0) {
            handleAutoScroll(chatHistory[chatHistory.length - 1]?.authorId);
        }
    }, [chatHistory, isLoadingHistory, isLoadingMore, handleAutoScroll]);

    // SCROLL ANCHORING & ADJUSTMENTS
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // CRITICAL FIX: Handle pagination scroll anchoring FIRST
        if (paginationAnchorRef.current?.shouldAnchor) {
            const { previousScrollHeight } = paginationAnchorRef.current;
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - previousScrollHeight;

            // Maintain user's scroll position by adjusting for new content height
            container.scrollTop = heightDifference;

            // Clean up pagination state
            paginationAnchorRef.current = null;
            isPaginatingRef.current = false;
            return;
        }

        // Handle deletion scroll fix
        if (deleteAdjustment.current) {
            const { oldHeight, oldScrollTop } = deleteAdjustment.current;
            const newHeight = container.scrollHeight;
            if (newHeight !== oldHeight && oldScrollTop > 0) {
                container.scrollTop = oldScrollTop + (newHeight - oldHeight);
            }
            deleteAdjustment.current = null;
            isDeletingRef.current = false;
            return;
        }

        // Safety: Reset pagination flag if it somehow persists
        if (isPaginatingRef.current && !isLoadingMore) {
            isPaginatingRef.current = false;
        }
    }, [chatHistory, isLoadingMore]);

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
        };

        const handleMoreMessagesLoaded = (data: { messages: Message[], hasMore: boolean }) => {
            // CRITICAL FIX: Simply prepend messages
            // The layoutEffect will handle scroll anchoring using paginationAnchorRef
            setChatHistory(prev => [...data.messages, ...prev]);
            setHasMore(data.hasMore);
            setIsLoadingMore(false);

            // Note: paginationAnchorRef.current.shouldAnchor is still true
            // This prevents auto-scroll in the effect above
            // layoutEffect will handle the scroll positioning
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
            const container = containerRef.current;
            isDeletingRef.current = true;
            if (container) {
                deleteAdjustment.current = {
                    oldHeight: container.scrollHeight,
                    oldScrollTop: container.scrollTop
                };
            }
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
        handleAutoScroll(currentUser?.id);

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