import { useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseUserSocketProps {
    socket: Socket | null;
    activeUserId: string | null;
    onStatusChange: (data: { userId: string; isOnline: boolean; lastSeen: string }) => void;
    onUserUpdate: (data: { userId: string; [key: string]: any }) => void;
    onTyping: (data: { userId: string }) => void;
    onStopTyping: (data: { userId: string }) => void;
    onNewMessage: (data: { senderId: string; message: string; isOwn?: boolean }) => void;
    onRelationshipUpdate: () => void;
    enableUpdates?: boolean;
}

/**
 * Pure socket event handling for user list updates.
 * NO state management, NO business logic.
 * Just event delegation.
 */
export const useUserSocket = ({
                                  socket,
                                  activeUserId,
                                  onStatusChange,
                                  onUserUpdate,
                                  onTyping,
                                  onStopTyping,
                                  onNewMessage,
                                  onRelationshipUpdate,
                                  enableUpdates = true,
                              }: UseUserSocketProps) => {
    useEffect(() => {
        if (!socket || !enableUpdates) return;

        // Register all event listeners
        socket.on('user_status_change', onStatusChange);
        socket.on('user_update', onUserUpdate);
        socket.on('user_typing', onTyping);
        socket.on('user_stop_typing', onStopTyping);
        socket.on('new_message_notification', onNewMessage);
        socket.on('user_relationship_update', onRelationshipUpdate);

        return () => {
            socket.off('user_status_change', onStatusChange);
            socket.off('user_update', onUserUpdate);
            socket.off('user_typing', onTyping);
            socket.off('user_stop_typing', onStopTyping);
            socket.off('new_message_notification', onNewMessage);
            socket.off('user_relationship_update', onRelationshipUpdate);
        };
    }, [
        socket,
        enableUpdates,
        onStatusChange,
        onUserUpdate,
        onTyping,
        onStopTyping,
        onNewMessage,
        onRelationshipUpdate,
    ]);
};