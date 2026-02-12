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
                const updatedUser = { ...activeUser };

                switch (data.type) {
                    case 'BLOCK':
                        // I blocked them.
                        updatedUser.hasBlocked = true;
                        // Strict Alignment: I shouldn't see their status anymore
                        updatedUser.isOnline = false;
                        updatedUser.lastSeen = undefined;
                        // Keep their image (Frozen Snapshot logic handled by sidebar refetch)
                        break;

                    case 'UNBLOCK':
                        // I unblocked them.
                        updatedUser.hasBlocked = false;
                        // Status will update on next heartbeat or sidebar refresh
                        break;

                    case 'BLOCKED_BY':
                        // They blocked me.
                        updatedUser.isBlockedBy = true;
                        // Strict Alignment: Total Blackout
                        updatedUser.isOnline = false;
                        updatedUser.lastSeen = undefined;
                        updatedUser.about = undefined; // Hide bio
                        updatedUser.image = undefined; // Hide image (local optimistic update)
                        break;

                    case 'UNBLOCKED_BY':
                        // They unblocked me.
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