import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/hooks/useSocket';

export const useLogout = () => {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { logout: clearStore } = useAuthStore();
    const socket = useSocket();

    const logout = async () => {
        setIsLoading(true);
        try {
            // 1. Invalidate session on server (remove httpOnly cookie)
            await api.post('/auth/logout');
        } catch (error) {
            console.error("Logout failed on server", error);
        } finally {
            // 2. Clear local auth state
            clearStore();

            // 3. Disconnect socket
            if (socket) {
                socket.disconnect();
            }

            // 4. Redirect to log in
            router.replace('/login');
            setIsLoading(false);
        }
    };

    return { logout, isLoading };
};