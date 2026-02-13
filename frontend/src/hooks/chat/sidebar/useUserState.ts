import { useState, useCallback, useMemo } from 'react';
import { User } from '@/types';

/**
 * Pure user list state management.
 * NO socket logic, NO API calls, NO side effects.
 * Just state and transformations.
 */
export const useUserState = () => {
    const [rawUsers, setRawUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Sorted and deduplicated user list
     */
    const users = useMemo(() => {
        // Deduplicate by ID
        const uniqueUsersMap = new Map<string, User>();
        rawUsers.forEach((user) => {
            uniqueUsersMap.set(user.id, user);
        });
        const uniqueUsers = Array.from(uniqueUsersMap.values());

        // Sort by: lastActivity DESC, then isOnline, then natural order
        return uniqueUsers.sort((a, b) => {
            const timeA = new Date(a.lastActivity || 0).getTime();
            const timeB = new Date(b.lastActivity || 0).getTime();
            if (timeB !== timeA) return timeB - timeA;
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            return 0;
        });
    }, [rawUsers]);

    /**
     * Set user list from API
     */
    const setUsers = useCallback((users: User[]) => {
        setRawUsers(users);
        setIsLoading(false);
        setError(null);
    }, []);

    /**
     * Start loading state
     */
    const startLoading = useCallback(() => {
        setIsLoading(true);
        setError(null);
    }, []);

    /**
     * Stop loading state (used for errors)
     */
    const stopLoading = useCallback(() => {
        setIsLoading(false);
    }, []);

    /**
     * Update a single user's status
     */
    const updateUserStatus = useCallback((
        userId: string,
        updates: Partial<Pick<User, 'isOnline' | 'lastSeen'>>
    ) => {
        setRawUsers((prev) =>
            prev.map((user) =>
                user.id === userId
                    ? {
                        ...user,
                        isOnline: updates.isOnline ?? user.isOnline,
                        lastSeen: updates.lastSeen ?? user.lastSeen,
                    }
                    : user
            )
        );
    }, []);

    /**
     * Update a user with any fields
     */
    const updateUser = useCallback((userId: string, updates: Partial<User>) => {
        setRawUsers((prev) =>
            prev.map((user) => {
                if (user.id === userId) {
                    // Protect unreadCount from being zeroed out by generic updates
                    const newUnreadCount = updates.unreadCount !== undefined
                        ? Math.max(updates.unreadCount, user.unreadCount || 0)
                        : user.unreadCount;

                    return { ...user, ...updates, unreadCount: newUnreadCount };
                }
                return user;
            })
        );
    }, []);

    /**
     * Update typing indicator
     */
    const setUserTyping = useCallback((userId: string, isTyping: boolean) => {
        setRawUsers((prev) =>
            prev.map((user) =>
                user.id === userId ? { ...user, isTyping } : user
            )
        );
    }, []);

    /**
     * Update last message and activity
     */
    const updateLastMessage = useCallback(
        (userId: string, message: string, shouldIncrementUnread: boolean) => {
            setRawUsers((prev) =>
                prev.map((user) => {
                    if (user.id === userId) {
                        return {
                            ...user,
                            lastMessage: message,
                            lastActivity: new Date().toISOString(),
                            unreadCount: shouldIncrementUnread
                                ? (user.unreadCount || 0) + 1
                                : user.unreadCount || 0,
                        };
                    }
                    return user;
                })
            );
        },
        []
    );

    /**
     * Reset unread count for a user
     */
    const resetUnreadCount = useCallback((userId: string) => {
        setRawUsers((prev) =>
            prev.map((user) =>
                user.id === userId ? { ...user, unreadCount: 0 } : user
            )
        );
    }, []);

    return {
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
    };
};