import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { registerChatHandlers } from './controllers/chat.controller';
import { authMiddleware } from './middlewares/auth.middleware';
import { prisma } from './config/prisma';

const httpServer = http.createServer(app);

// Initializing Socket.io with CORS allowing all origins
const io = new Server(httpServer, {
    cors: { origin: "*" }
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
    // User is attached to socket in authMiddleware
    const userId = (socket as any).user.id;

    /**
     * Personal Notification Channel
     * We join a room named after the User's ID.
     * This allows us to target this specific user from anywhere in the app
     * (e.g., "io.to(recipientId).emit(...)") even if we don't know their socket ID.
     * Used for: Sidebar updates, Unread badges, Incoming calls.
     */
    socket.join(userId);

    try {
        // 1. Update DB status
        await prisma.user.update({
            where: { id: userId },
            data: { isOnline: true }
        });

        // 2. Broadcast to everyone else that this user is online
        socket.broadcast.emit("user_status_change", { userId, isOnline: true });

    } catch (error) {
        console.error(`⚠️ Could not update user status:`);
        socket.disconnect();
        return;
    }

    // Register all chat-related event listeners
    registerChatHandlers(io, socket);

    socket.on("disconnect", async () => {
        console.log(`🔌 Disconnected: ${socket.id}`);

        try {
            const lastSeen = new Date();
            // Update DB status to offline with timestamp
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isOnline: false,
                    lastSeen: lastSeen
                }
            });

            // Notify others for accurate "Last Seen" display
            socket.broadcast.emit("user_status_change", { userId, isOnline: false, lastSeen });
        } catch (error) {
            // Silently fail if DB update fails on disconnect
        }
    });
});

httpServer.listen(env.PORT, () => {
    console.log(`🚀 Secure Server running on port ${env.PORT}`);
});