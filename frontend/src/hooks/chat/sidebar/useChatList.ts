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
 * * Responsibilities:
 * - Aggregates API, Socket, and State logic for the Sidebar.
 * - Enforces Block/Privacy logic on incoming socket events.
 */
export const useChatList = ({
                                enableUpdates = true,
                                enableBackgroundSync = false,
                            }: UseChatListOptions = {}) => {
    const socket = useSocket();
    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const selectedUser = useChatStore((state) => state.activeUser);

    // Track users for synchronous access inside socket callbacks
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

    /**
     * Handle Online/Offline status changes.
     * STRICT ALIGNMENT: We must NOT update status if a block exists.
     */
    const handleStatusChange = useCallback(
        (data: { userId: string; isOnline: boolean; lastSeen: string }) => {
            const currentUserInList = usersRef.current.find(u => u.id === data.userId);

            // SECURITY CHECK: If blocked/blocking, ignore status updates
            if (currentUserInList) {
                const isBlocked = currentUserInList.hasBlocked || currentUserInList.isBlockedBy;
                if (isBlocked) return;
            }

            // Update in user list
            updateUserStatus(data.userId, {
                isOnline: data.isOnline,
                lastSeen: data.lastSeen,
            });

            // Update active user if it's the same user
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
            // We generally trust the backend not to send sensitive data,
            // but for "Frozen" logic, rely on the fact that if I blocked them,
            // I shouldn't be receiving these updates anyway (backend filtering usually).
            // Even if I do, the next sidebar refresh resets to the "Frozen" snapshot.

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
            // Don't show typing indicator if blocked
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
                // New conversation started - fetch fresh list
                await fetchUsers();
            }

            if (!data.isOwn && selectedUser?.id !== data.senderId) {
                // Backend won't emit message event if blocked.
                toast.info('New message received');
            }
        },
        [selectedUser, updateLastMessage, fetchUsers]
    );

    const handleRelationshipUpdate = useCallback(async () => {
        // When block/unblock happens, re-fetch the whole list.
        // This ensures the "Frozen Snapshot" or "Blackout" state is correctly loaded from the DB.
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

    // 5. BACKGROUND SYNC
    useBackgroundSync({
        onSync: fetchUsers,
        enabled: enableBackgroundSync && enableUpdates,
        intervalMs: 60000,
    });

    // 6. RESET UNREAD
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