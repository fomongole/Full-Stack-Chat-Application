import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/store/useChatStore';

export const useRelationshipEvents = () => {
    const socket = useSocket();
    const activeUser = useChatStore((state) => state.activeUser);
    const setActiveUser = useChatStore((state) => state.setActiveUser);

    useEffect(() => {
        if (!socket) return;

        const handleRelationshipUpdate = (data: { targetUserId: string; type: string }) => {
            // Only proceed if we have an active user and the event is about them
            if (activeUser && activeUser.id === data.targetUserId) {
                const updatedUser = { ...activeUser };

                switch (data.type) {
                    case 'BLOCK':
                        // I blocked them (received via my own socket)
                        updatedUser.hasBlocked = true;
                        break;

                    case 'UNBLOCK':
                        // I unblocked them
                        updatedUser.hasBlocked = false;
                        break;

                    case 'BLOCKED_BY':
                        // They blocked me
                        updatedUser.isBlockedBy = true;
                        // Immediately hide their online status/last seen for privacy consistency
                        updatedUser.isOnline = false;
                        updatedUser.lastSeen = undefined;
                        break;

                    case 'UNBLOCKED_BY':
                        // They unblocked me
                        updatedUser.isBlockedBy = false;
                        break;
                }

                // Update the global store immediately to trigger UI re-renders
                setActiveUser(updatedUser);
            }
        };

        socket.on('user_relationship_update', handleRelationshipUpdate);

        return () => {
            socket.off('user_relationship_update', handleRelationshipUpdate);
        };
    }, [socket, activeUser, setActiveUser]);
};