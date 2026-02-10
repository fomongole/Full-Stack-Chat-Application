import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useChatList } from '@/hooks/chat/sidebar/useChatList';
import { User } from '@/types';
import { useChatStore } from '@/store/useChatStore';

export function useUserBlock() {
    const [isLoading, setIsLoading] = useState(false);
    const { fetchUsers } = useChatList({ enableUpdates: false });

    // Grab store setters for Optimistic Updates
    const activeUser = useChatStore((state) => state.activeUser);
    const setActiveUser = useChatStore((state) => state.setActiveUser);

    const toggleBlockStatus = async (user: User) => {
        setIsLoading(true);
        try {
            if (user.hasBlocked) {
                // UNBLOCK ACTION
                await api.post('/users/unblock', { userIdToUnblock: user.id });
                toast.success(`Unblocked ${user.username}`);

                // Optimistic Update: If we are currently looking at this user
                if (activeUser?.id === user.id) {
                    setActiveUser({ ...activeUser, hasBlocked: false });
                }
            } else {
                // BLOCK ACTION
                await api.post('/users/block', { userIdToBlock: user.id });
                toast.error(`Blocked ${user.username}`);

                // Optimistic Update: If we are currently looking at this user
                if (activeUser?.id === user.id) {
                    setActiveUser({ ...activeUser, hasBlocked: true });
                }
            }

            // Refresh the sidebar list to reflect changes there too
            await fetchUsers();
            return true; // Indicate success

        } catch (error: unknown) {
            console.error(error);
            const apiError = error as { response?: { data?: { message?: string } } };
            toast.error(apiError.response?.data?.message || 'Action failed');
            return false; // Indicate failure
        } finally {
            setIsLoading(false);
        }
    };

    return {
        toggleBlockStatus,
        isLoading
    };
}