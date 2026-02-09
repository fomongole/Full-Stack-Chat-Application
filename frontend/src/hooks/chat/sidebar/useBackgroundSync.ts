import { useEffect, useCallback } from 'react';

interface UseBackgroundSyncProps {
    onSync: () => void;
    enabled?: boolean;
    intervalMs?: number;
}

/**
 * Optional background sync for keeping data fresh.
 * Note: With WebSocket, this is often unnecessary.
 * Use sparingly and only when needed.
 */
export const useBackgroundSync = ({
                                      onSync,
                                      enabled = true,
                                      intervalMs = 60000, // 60 seconds default
                                  }: UseBackgroundSyncProps) => {
    /**
     * Manual sync trigger
     */
    const sync = useCallback(() => {
        onSync();
    }, [onSync]);

    /**
     * Auto-sync on interval
     */
    useEffect(() => {
        if (!enabled) return;

        const intervalId = setInterval(sync, intervalMs);

        return () => {
            clearInterval(intervalId);
        };
    }, [sync, enabled, intervalMs]);

    /**
     * Sync when tab becomes visible
     */
    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sync();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sync, enabled]);

    return { sync };
};