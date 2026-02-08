'use client';

import { useSocketContext } from '@/providers/SocketProvider';

/**
 * Instead of creating a new connection, this just grabs
 * the existing one from the Provider.
 */
export const useSocket = () => {
    const { socket } = useSocketContext();
    return socket;
};