import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useChatList } from '@/hooks/chat/sidebar/useChatList';
import { User } from '@/types';

export function useUserBlock() {
    const [isLoading, setIsLoading] = useState(false);
    const { fetchUsers } = useChatList({ enableUpdates: false });

    const toggleBlockStatus = async (user: User) => {
        setIsLoading(true);
        try {
            if (user.hasBlocked) {
                await api.post('/users/unblock', { userIdToUnblock: user.id });
                toast.success(`Unblocked ${user.username}`);
            } else {
                await api.post('/users/block', { userIdToBlock: user.id });
                toast.error(`Blocked ${user.username}`);
            }

            // Refresh the list to reflect changes
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