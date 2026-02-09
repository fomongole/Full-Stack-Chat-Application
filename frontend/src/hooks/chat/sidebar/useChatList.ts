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

/**
 * Refactored useChatList hook.
 * Clean facade that composes specialized hooks.
 *
 * Architecture:
 * - useUserState: Pure state management
 * - useUserSocket: Socket event handling
 * - useUserApi: API calls
 * - useBackgroundSync: Optional background updates
 */
export const useChatList = ({
                                enableUpdates = true,
                                enableBackgroundSync = false, // Disabled by default since we have sockets
                            }: UseChatListOptions = {}) => {
    const socket = useSocket();
    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const selectedUser = useChatStore((state) => state.activeUser);

    // Track users for synchronous access (needed for socket handlers)
    const usersRef = useRef<any[]>([]);

    // 1. USER STATE MANAGEMENT
    const {
        users,
        rawUsers,
        isLoading,
        setUsers,
        startLoading,
        updateUserStatus,
        updateUser,
        setUserTyping,
        updateLastMessage,
        resetUnreadCount,
    } = useUserState();

    // Keep ref in sync for socket handlers
    useEffect(() => {
        usersRef.current = rawUsers;
    }, [rawUsers]);

    // 2. API CALLS
    const { fetchUsers } = useUserApi({
        onUsersLoaded: setUsers,
        startLoading,
        shouldShowInitialLoader: usersRef.current.length === 0,
    });

    // 3. SOCKET EVENT HANDLERS
    const handleStatusChange = useCallback(
        (data: { userId: string; isOnline: boolean; lastSeen: string }) => {
            // Update in user list
            updateUserStatus(data.userId, {
                isOnline: data.isOnline,
                lastSeen: data.lastSeen,
            });

            // Update active user if it's the same user
            if (selectedUser?.id === data.userId) {
                const isBlocked = selectedUser.hasBlocked || selectedUser.isBlockedBy;
                setActiveUser({
                    ...selectedUser,
                    isOnline: isBlocked ? false : data.isOnline,
                    lastSeen: isBlocked ? selectedUser.lastSeen : data.lastSeen,
                });
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
            // Check if user exists in our list (using ref for synchronous access)
            const userExists = usersRef.current.some((u) => u.id === data.senderId);

            if (userExists) {
                // Optimistic update - don't fetch, just update state
                const isCurrentChat = selectedUser?.id === data.senderId;
                const shouldIncrement = !data.isOwn && !isCurrentChat;

                updateLastMessage(data.senderId, data.message, shouldIncrement);
            } else {
                // New user - fetch updated list
                await fetchUsers();
            }

            // Show notification for non-own messages from other users
            if (!data.isOwn && selectedUser?.id !== data.senderId) {
                toast.info('New message received');
            }
        },
        [selectedUser, updateLastMessage, fetchUsers]
    );

    const handleRelationshipUpdate = useCallback(async () => {
        // Refetch users when relationships change (block/unblock)
        await fetchUsers();
    }, [fetchUsers]);

    // 4. SOCKET EVENTS
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

    // 5. BACKGROUND SYNC (Optional)
    useBackgroundSync({
        onSync: fetchUsers,
        enabled: enableBackgroundSync && enableUpdates,
        intervalMs: 60000,
    });

    // 6. RESET UNREAD COUNT WHEN USER IS SELECTED
    useEffect(() => {
        if (selectedUser?.id) {
            resetUnreadCount(selectedUser.id);
        }
    }, [selectedUser?.id, resetUnreadCount]);

    return {
        users,
        isLoading,
        fetchUsers,
    };
};