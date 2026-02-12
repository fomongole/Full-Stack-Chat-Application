import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/store/useChatStore';
import { toast } from 'sonner';
import { useUserState } from './useUserState';
import { useUserSocket } from './useUserSocket';
import { useUserApi } from './useUserApi';
import { useBackgroundSync } from './useBackgroundSync';

interface UseChatListOptions {
    enableUpdates?: boolean;
    enableBackgroundSync?: boolean;
}

export const useChatList = ({
                                enableUpdates = true,
                                enableBackgroundSync = false,
                            }: UseChatListOptions = {}) => {
    const socket = useSocket();
    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const selectedUser = useChatStore((state) => state.activeUser);

    const usersRef = useRef<any[]>([]);

    const {
        users,
        rawUsers,
        isLoading,
        error,
        setError,
        setUsers,
        startLoading,
        stopLoading,
        updateUserStatus,
        updateUser,
        setUserTyping,
        updateLastMessage,
        resetUnreadCount,
    } = useUserState();

    useEffect(() => {
        usersRef.current = rawUsers;
    }, [rawUsers]);

    // -------------------------------------------------------------------------
    // 1. DATA SYNCHRONIZATION (Fixes Issue 3: Header not updating)
    // -------------------------------------------------------------------------
    // When the sidebar list updates (via API fetch), we MUST check if the
    // currently active user's data has changed (e.g., they got blocked, image changed).
    // If so, we sync the global store immediately.
    useEffect(() => {
        if (selectedUser && rawUsers.length > 0) {
            const updatedActiveUser = rawUsers.find(u => u.id === selectedUser.id);

            // If we found the user in the new list, and they look different from current state
            if (updatedActiveUser) {
                // We compare key fields to avoid infinite loops
                const hasChanged =
                    updatedActiveUser.image !== selectedUser.image ||
                    updatedActiveUser.isOnline !== selectedUser.isOnline ||
                    updatedActiveUser.lastSeen !== selectedUser.lastSeen ||
                    updatedActiveUser.hasBlocked !== selectedUser.hasBlocked ||
                    updatedActiveUser.isBlockedBy !== selectedUser.isBlockedBy;

                if (hasChanged) {
                    setActiveUser(updatedActiveUser);
                }
            }
        }
    }, [rawUsers, selectedUser, setActiveUser]);


    // -------------------------------------------------------------------------
    // 2. API CALLS & SANITIZATION (Fixes Issue 1: Unread Flash)
    // -------------------------------------------------------------------------
    const { fetchUsers } = useUserApi({
        onUsersLoaded: (fetchedUsers) => {
            // FIX: Sanitize unread count BEFORE setting state
            // If we are currently looking at a user, their incoming unread count MUST be 0.
            const sanitizedUsers = fetchedUsers.map(u => {
                if (useChatStore.getState().activeUser?.id === u.id) {
                    return { ...u, unreadCount: 0 };
                }
                return u;
            });
            setUsers(sanitizedUsers);
        },
        onError: () => setError("Failed to load conversations"),
        startLoading,
        stopLoading,
        shouldShowInitialLoader: usersRef.current.length === 0,
    });

    // -------------------------------------------------------------------------
    // 3. SOCKET EVENT HANDLERS
    // -------------------------------------------------------------------------
    const handleStatusChange = useCallback(
        (data: { userId: string; isOnline: boolean; lastSeen: string }) => {
            const currentUserInList = usersRef.current.find(u => u.id === data.userId);
            if (currentUserInList) {
                const isBlocked = currentUserInList.hasBlocked || currentUserInList.isBlockedBy;
                if (isBlocked) return;
            }

            updateUserStatus(data.userId, {
                isOnline: data.isOnline,
                lastSeen: data.lastSeen,
            });

            // Also update active user store if it's the current one
            if (selectedUser?.id === data.userId) {
                const isBlocked = selectedUser.hasBlocked || selectedUser.isBlockedBy;
                if (!isBlocked) {
                    setActiveUser({
                        ...selectedUser,
                        isOnline: data.isOnline,
                        lastSeen: data.lastSeen,
                    });
                }
            }
        },
        [updateUserStatus, selectedUser, setActiveUser]
    );

    const handleUserUpdate = useCallback(
        (data: any) => {
            updateUser(data.userId, data);
            if (selectedUser?.id === data.userId) {
                setActiveUser({ ...selectedUser, ...data });
            }
        },
        [updateUser, selectedUser, setActiveUser]
    );

    const handleTyping = useCallback(
        (data: { userId: string }) => {
            const user = usersRef.current.find(u => u.id === data.userId);
            if (user && (user.hasBlocked || user.isBlockedBy)) return;
            setUserTyping(data.userId, true);
        },
        [setUserTyping]
    );

    const handleStopTyping = useCallback(
        (data: { userId: string }) => {
            setUserTyping(data.userId, false);
        },
        [setUserTyping]
    );

    const handleNewMessage = useCallback(
        async (data: { senderId: string; message: string; isOwn?: boolean }) => {
            const userExists = usersRef.current.some((u) => u.id === data.senderId);

            if (userExists) {
                const isCurrentChat = selectedUser?.id === data.senderId;
                const shouldIncrement = !data.isOwn && !isCurrentChat;
                updateLastMessage(data.senderId, data.message, shouldIncrement);
            } else {
                await fetchUsers();
            }

            if (!data.isOwn && selectedUser?.id !== data.senderId) {
                toast.info('New message received');
            }
        },
        [selectedUser, updateLastMessage, fetchUsers]
    );

    const handleRelationshipUpdate = useCallback(async () => {
        // Re-fetch list to get the "Frozen Snapshot" or "Blackout" data from backend
        await fetchUsers();
        // The useEffect at the top will handle syncing this fresh data to the activeUser
    }, [fetchUsers]);

    useUserSocket({
        socket,
        activeUserId: selectedUser?.id || null,
        onStatusChange: handleStatusChange,
        onUserUpdate: handleUserUpdate,
        onTyping: handleTyping,
        onStopTyping: handleStopTyping,
        onNewMessage: handleNewMessage,
        onRelationshipUpdate: handleRelationshipUpdate,
        enableUpdates,
    });

    useBackgroundSync({
        onSync: fetchUsers,
        enabled: enableBackgroundSync && enableUpdates,
        intervalMs: 60000,
    });

    return {
        users,
        isLoading,
        error,
        fetchUsers,
    };
};