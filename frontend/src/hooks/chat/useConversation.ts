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
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [isRemoteTyping, setIsRemoteTyping] = useState(false);
    const [unreadBelowCount, setUnreadBelowCount] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isInitialLoad = useRef(true);

    // GUARD: Prevents a single message from being counted twice
    const countedMessageIds = useRef<Set<string>>(new Set());

    // FLAG: Prevents auto-scroll when an update is caused by deletion
    const isDeletingRef = useRef(false);

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

        if (isInitialLoad.current) {
            scrollToBottom('auto');
            isInitialLoad.current = false;
            return;
        }

        if (newMsgAuthorId === currentUser?.id) {
            scrollToBottom('smooth');
            return;
        }

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
            scrollToBottom('smooth');
        }
    }, [currentUser?.id, scrollToBottom]);

    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, []);

    useEffect(() => {
        if (activeUser?.id) {
            isInitialLoad.current = true;
            setUnreadBelowCount(0);
            countedMessageIds.current.clear();
        }
    }, [activeUser?.id]);

    useEffect(() => {
        // If this update was caused by a deletion, DO NOT auto-scroll.
        if (isDeletingRef.current) {
            isDeletingRef.current = false; // Reset the flag
            return;
        }

        if (!isLoadingHistory && chatHistory.length > 0) {
            handleAutoScroll(chatHistory[chatHistory.length - 1]?.authorId);
        }
    }, [chatHistory, isLoadingHistory, handleAutoScroll]);

    // Fix for deletion scroll: Adjust after render
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (container && deleteAdjustment.current) {
            const { oldHeight, oldScrollTop } = deleteAdjustment.current;
            const newHeight = container.scrollHeight;

            // Only adjust if height actually changed
            if (newHeight !== oldHeight && oldScrollTop > 0) {
                container.scrollTop = oldScrollTop + (newHeight - oldHeight);
            }
            deleteAdjustment.current = null;
        }
    }, [chatHistory]);

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

        const handleLoadHistory = (history: Message[]) => {
            setChatHistory(history);
            setIsLoadingHistory(false);
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

            // 1. SET FLAG TO BLOCK AUTO-SCROLL
            isDeletingRef.current = true;

            if (container) {
                // Save before update for useLayoutEffect
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
        socket.on("receive_message", handleReceiveMessage);
        socket.on("message_deleted", handleMessageDeleted);
        socket.on("user_typing", handleUserTyping);
        socket.on("user_stop_typing", handleUserStopTyping);
        socket.on("messages_read", handleMessagesRead);

        return () => {
            socket.off("conversation_joined", handleConversationJoined);
            socket.off("load_history", handleLoadHistory);
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
        scrollToBottom, handleScroll, isBlocked
    };
};