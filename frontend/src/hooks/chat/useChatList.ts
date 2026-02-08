import { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // Import useRef
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/store/useChatStore';
import { toast } from "sonner";
import { User } from '@/types';

export const useChatList = (enableUpdates = true) => {
    const [rawUsers, setRawUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [, setTick] = useState(0);

    // 1. REF TO TRACK USERS INSTANTLY
    const usersRef = useRef<User[]>([]);

    const socket = useSocket();
    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const selectedUser = useChatStore((state) => state.activeUser);

    // 2. KEEP REF SYNCED WITH STATE
    useEffect(() => {
        usersRef.current = rawUsers;
    }, [rawUsers]);

    const users = useMemo(() => {
        const uniqueUsersMap = new Map<string, User>();
        rawUsers.forEach((user) => {
            uniqueUsersMap.set(user.id, user);
        });
        const uniqueUsers = Array.from(uniqueUsersMap.values());

        return uniqueUsers.sort((a, b) => {
            const timeA = new Date(a.lastActivity || 0).getTime();
            const timeB = new Date(b.lastActivity || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            return 0;
        });
    }, [rawUsers]);

    const forceUpdate = useCallback(() => {
        setTick(t => t + 1);
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            // Only show loading on FIRST load, not background refreshes
            if (usersRef.current.length === 0) setIsLoading(true);

            const response = await api.get('/users');
            setRawUsers(response.data.data.users);
        } catch (error) {
            console.error("Failed to load users:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // INSTANT READ RESET
    useEffect(() => {
        if (selectedUser) {
            setRawUsers(prev => prev.map(u =>
                u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u
            ));
        }
    }, [selectedUser?.id]);

    useEffect(() => {
        if (!enableUpdates) return;
        const intervalId = setInterval(forceUpdate, 60000);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') forceUpdate();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [forceUpdate, enableUpdates]);

    useEffect(() => {
        if (!socket || !enableUpdates) return;

        const handleStatusChange = (data: { userId: string, isOnline: boolean, lastSeen: string }) => {
            setRawUsers(prevUsers => prevUsers.map(user => {
                if (user.id === data.userId) {
                    const isBlocked = user.hasBlocked || user.isBlockedBy;
                    return {
                        ...user,
                        isOnline: isBlocked ? false : data.isOnline,
                        lastSeen: isBlocked ? user.lastSeen : data.lastSeen,
                    };
                }
                return user;
            }));

            if (selectedUser?.id === data.userId) {
                const isBlocked = selectedUser.hasBlocked || selectedUser.isBlockedBy;
                setActiveUser({
                    ...selectedUser,
                    isOnline: isBlocked ? false : data.isOnline,
                    lastSeen: isBlocked ? selectedUser.lastSeen : data.lastSeen
                });
            }
        };

        const handleUserUpdate = (data: any) => {
            setRawUsers(prev => prev.map(u => u.id === data.userId ? { ...u, ...data } : u));
            if (selectedUser?.id === data.userId) setActiveUser({ ...selectedUser, ...data });
        };

        const handleTyping = (data: { userId: string }) => {
            setRawUsers(prev => prev.map(u =>
                u.id === data.userId ? { ...u, isTyping: true } : u
            ));
        };

        const handleStopTyping = (data: { userId: string }) => {
            setRawUsers(prev => prev.map(u =>
                u.id === data.userId ? { ...u, isTyping: false } : u
            ));
        };

        const handleNewMessageNotification = async (data: { senderId: string, message: string, isOwn?: boolean }) => {
            // Check the REF (synchronous, instant access to current state)
            const userExists = usersRef.current.some(u => u.id === data.senderId);

            if (userExists) {
                // OPTIMISTIC UPDATE: Update the list immediately without fetching
                setRawUsers(prev => prev.map(u => {
                    if (u.id === data.senderId) {
                        const isCurrentChat = selectedUser?.id === data.senderId;
                        const shouldIncrement = !data.isOwn && !isCurrentChat;

                        return {
                            ...u,
                            lastMessage: data.message,
                            lastActivity: new Date().toISOString(),
                            unreadCount: shouldIncrement ? (u.unreadCount || 0) + 1 : (isCurrentChat ? 0 : (u.unreadCount || 0))
                        };
                    }
                    return u;
                }));
            } else {
                // Only fetch if it's genuinely a NEW user not in our list
                await fetchUsers();
            }

            if (!data.isOwn && selectedUser?.id !== data.senderId) {
                toast.info("New message received");
            }
        };

        const handleRelationshipUpdate = async () => {
            await fetchUsers();
        };

        socket.on("user_status_change", handleStatusChange);
        socket.on("user_update", handleUserUpdate);
        socket.on("user_typing", handleTyping);
        socket.on("user_stop_typing", handleStopTyping);
        socket.on("new_message_notification", handleNewMessageNotification);
        socket.on("user_relationship_update", handleRelationshipUpdate);

        return () => {
            socket.off("user_status_change", handleStatusChange);
            socket.off("user_update", handleUserUpdate);
            socket.off("user_typing", handleTyping);
            socket.off("user_stop_typing", handleStopTyping);
            socket.off("new_message_notification", handleNewMessageNotification);
            socket.off("user_relationship_update", handleRelationshipUpdate);
        };
    }, [socket, selectedUser, setActiveUser, fetchUsers, enableUpdates]);

    return { users, isLoading, fetchUsers };
};