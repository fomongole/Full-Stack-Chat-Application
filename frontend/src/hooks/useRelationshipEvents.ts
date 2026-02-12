import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/store/useChatStore';

/**
 * Handles real-time Block/Unblock events for the *Active Chat Window*.
 * Ensures the UI immediately reflects privacy changes (hiding status/input).
 */
export const useRelationshipEvents = () => {
    const socket = useSocket();
    const activeUser = useChatStore((state) => state.activeUser);
    const setActiveUser = useChatStore((state) => state.setActiveUser);

    useEffect(() => {
        if (!socket) return;

        const handleRelationshipUpdate = (data: { targetUserId: string; type: string }) => {
            // Only proceed if we have an active user and the event is about them
            if (activeUser && activeUser.id === data.targetUserId) {
                // Create a NEW object reference to ensure React detects the change
                const updatedUser = { ...activeUser };

                switch (data.type) {
                    case 'BLOCK':
                        // I blocked them.
                        updatedUser.hasBlocked = true;
                        updatedUser.isOnline = false;
                        updatedUser.lastSeen = undefined;
                        // We intentionally KEEP their image here (Frozen Snapshot logic)
                        break;

                    case 'UNBLOCK':
                        updatedUser.hasBlocked = false;
                        // We don't know their real status yet, wait for next heartbeat
                        break;

                    case 'BLOCKED_BY':
                        // They blocked me. TOTAL BLACKOUT.
                        updatedUser.isBlockedBy = true;
                        updatedUser.isOnline = false;
                        updatedUser.lastSeen = undefined;
                        updatedUser.about = undefined;
                        // Force image removal immediately
                        updatedUser.image = undefined;
                        break;

                    case 'UNBLOCKED_BY':
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