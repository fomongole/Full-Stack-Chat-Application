import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { User } from '@/types';
import { useChatStore } from '@/store/useChatStore';

export function useUserBlock() {
    const [isLoading, setIsLoading] = useState(false);

    // Store setters for Optimistic Updates
    const activeUser = useChatStore((state) => state.activeUser);
    const setActiveUser = useChatStore((state) => state.setActiveUser);

    const toggleBlockStatus = async (user: User) => {
        setIsLoading(true);
        try {
            if (user.hasBlocked) {
                // UNBLOCK ACTION
                await api.post('/users/unblock', { userIdToUnblock: user.id });
                toast.success(`Unblocked ${user.username}`);

                // Optimistic Update: Update active user state immediately
                if (activeUser?.id === user.id) {
                    setActiveUser({
                        ...activeUser,
                        hasBlocked: false
                    });
                }
            } else {
                // BLOCK ACTION
                await api.post('/users/block', { userIdToBlock: user.id });
                toast.error(`Blocked ${user.username}`);

                // Optimistic Update: Update active user state immediately
                if (activeUser?.id === user.id) {
                    setActiveUser({
                        ...activeUser,
                        hasBlocked: true,
                        // Immediate Local Blackout for me (I shouldn't see their status)
                        isOnline: false,
                        lastSeen: undefined
                    });
                }
            }

            // The backend emits 'user_relationship_update' via Socket.
            // The Sidebar component listens to this and re-fetches the list,
            // which captures the "Frozen Snapshot" payload from the server.

            return true;

        } catch (error: unknown) {
            console.error(error);
            const apiError = error as { response?: { data?: { message?: string } } };
            toast.error(apiError.response?.data?.message || 'Action failed');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        toggleBlockStatus,
        isLoading
    };
}