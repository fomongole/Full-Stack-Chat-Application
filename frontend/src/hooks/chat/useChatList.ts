import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/store/useChatStore';
import { toast } from "sonner";
import { User } from '@/types';

export const useChatList = (enableUpdates = true) => {
    const [rawUsers, setRawUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [, setTick] = useState(0);

    const socket = useSocket();
    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const selectedUser = useChatStore((state) => state.activeUser);

    // --- DEDUPLICATION & SORTING ---
    const users = useMemo(() => {
        // 1. Create a Map to enforce unique IDs (last one wins)
        const uniqueUsersMap = new Map<string, User>();
        rawUsers.forEach((user) => {
            uniqueUsersMap.set(user.id, user);
        });

        // 2. Convert back to array
        const uniqueUsers = Array.from(uniqueUsersMap.values());

        // 3. Sort by Activity and Online Status
        return uniqueUsers.sort((a, b) => {
            const timeA = new Date(a.lastActivity || 0).getTime();
            const timeB = new Date(b.lastActivity || 0).getTime();
            // Sort by most recent message/activity first
            if (timeB !== timeA) return timeB - timeA;
            // Then by online status
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            return 0;
        });
    }, [rawUsers]);

    const forceUpdate = useCallback(() => {
        setTick(t => t + 1);
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/users');
            setRawUsers(response.data.data.users);
        } catch (error) {
            console.error("Failed to load users:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial Fetch
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // INSTANT READ RESET: When active user changes, clear unread count locally
    useEffect(() => {
        if (selectedUser) {
            setRawUsers(prev => prev.map(u =>
                u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u
            ));
        }
    }, [selectedUser?.id]);

    // Periodic Refresh (Last Seen updates)
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

    // Socket Listeners
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

            // Also update the active user store if needed
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
            // Check if we already have this user
            let userFound = false;

            setRawUsers(prev => {
                const userExists = prev.some(u => u.id === data.senderId);
                if (userExists) {
                    userFound = true;
                    return prev.map(u => {
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
                    });
                }
                return prev;
            });

            // If user wasn't in list, fetch fresh list safely outside the setter
            if (!userFound) {
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