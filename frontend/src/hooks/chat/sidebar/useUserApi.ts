import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { User } from '@/types';

interface UseUserApiProps {
    onUsersLoaded: (users: User[]) => void;
    onError?: (error: any) => void;
    startLoading: () => void;
    stopLoading: () => void;
    shouldShowInitialLoader: boolean;
}

/**
 * API calls for user data.
 * NO socket logic, NO state management.
 * Just API interactions.
 */
export const useUserApi = ({
                               onUsersLoaded,
                               onError,
                               startLoading,
                               stopLoading,
                               shouldShowInitialLoader,
                           }: UseUserApiProps) => {
    const hasLoadedRef = useRef(false);

    /**
     * Fetch users from API
     */
    const fetchUsers = useCallback(async () => {
        try {
            // Only show loading spinner on FIRST load
            if (shouldShowInitialLoader && !hasLoadedRef.current) {
                startLoading();
            }

            const response = await api.get('/users');
            const users = response.data.data.users;

            onUsersLoaded(users);
            hasLoadedRef.current = true;
        } catch (error) {
            console.error('Failed to load users:', error);
            stopLoading(); // ✅ FIX: Ensure loading state is turned off on error
            onError?.(error);
        }
    }, [onUsersLoaded, onError, startLoading, stopLoading, shouldShowInitialLoader]);

    /**
     * Initial fetch on mount
     */
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    return {
        fetchUsers,
        refetch: fetchUsers,
    };
};