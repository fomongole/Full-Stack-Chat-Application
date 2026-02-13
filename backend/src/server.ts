import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { registerChatHandlers } from './controllers/chat.controller';
import { authMiddleware } from './middlewares/auth.middleware';
import { db } from './config/db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

const httpServer = http.createServer(app);

/**
 * Socket.io Server Initialization
 * Configured with CORS to allow connections from your frontend domains.
 */
const io = new Server(httpServer, {
    cors: {
        origin: [
            "https://full-stack-chat-application-pi.vercel.app",
            "https://fred-chat-app.vercel.app",
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"]
    }
});

/**
 * ARCHITECTURE NOTE: Socket <-> Rest Bridge
 * We attach the 'io' instance to the Express app.
 * This allows REST controllers (like user.controller.ts) to emit
 * real-time events (like profile updates) without needing an active socket connection.
 */
app.set('io', io);

// Global middleware to verify JWT before allowing socket connection
io.use(authMiddleware);

io.on("connection", async (socket) => {
    // User is attached to socket in authMiddleware via JWT decoding
    const userId = (socket as any).user.id;

    /**
     * Personal Notification Channel
     * We join a room named after the User's ID.
     * Used for: Sidebar updates, Unread badges, Incoming calls.
     */
    socket.join(userId);

    try {
        // 1. Update DB status to ONLINE
        await db.update(users)
            .set({ isOnline: true })
            .where(eq(users.id, userId));

        // 2. Broadcast to everyone else that this user is online
        socket.broadcast.emit("user_status_change", { userId, isOnline: true });

    } catch (error) {
        console.error(`⚠️ Could not update user status for ${userId}:`, error);
        // We don't disconnect here, as chat might still work even if status update fails
    }

    // Register all chat-related event listeners (Messaging, Typing, etc.)
    registerChatHandlers(io, socket);

    /**
     * Handle Disconnect
     * Updates "Last Seen" timestamp and notifies others.
     */
    socket.on("disconnect", async () => {
        console.log(`🔌 Disconnected: ${userId} (${socket.id})`);

        try {
            // Multi-tab presence check
            // Only mark as offline if the user has NO other active socket connections (e.g., another tab/device open)
            const activeSockets = await io.in(userId).fetchSockets();
            if (activeSockets.length > 0) {
                return; // They are still active on another tab!
            }

            const lastSeen = new Date();

            // Update DB status to OFFLINE with timestamp
            await db.update(users)
                .set({ isOnline: false, lastSeen: lastSeen })
                .where(eq(users.id, userId));

            // Notify others for accurate "Last Seen" display
            socket.broadcast.emit("user_status_change", {
                userId,
                isOnline: false,
                lastSeen
            });
        } catch (error) {
            console.error(`⚠️ Failed to update offline status for ${userId}`, error);
        }
    });
});

httpServer.listen(env.PORT, () => {
    console.log(`🚀 Secure Server running on port ${env.PORT}`);
});