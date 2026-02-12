import { Server, Socket } from 'socket.io';
import { Response } from 'express';
import { chatService } from '../services/chat.service';
import { catchAsync } from '../utils/catch.async';
import { db } from '../config/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import cloudinary from '../config/cloudinary';
import { AppError } from '../utils/app.error';

// --- REST HANDLERS ---
export const uploadMedia = catchAsync(async (req: any, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'chat-app-media',
        resource_type: resourceType
    });

    res.status(200).json({
        status: 'success',
        data: {
            url: uploadResponse.secure_url,
            type: resourceType === 'video' ? 'VIDEO' : 'IMAGE'
        }
    });
});

// --- SOCKET HANDLERS  ---
export const registerChatHandlers = (io: Server, socket: Socket) => {
    const user = (socket as any).user;

    socket.on("join_conversation", async (data: { recipientId: string }) => {
        try {
            const conversation = await chatService.getOrCreateConversation(user.id, data.recipientId);
            socket.join(conversation.id);
            socket.emit("conversation_joined", { conversationId: conversation.id });

            const historyData = await chatService.getConversationHistory(conversation.id);
            socket.emit("load_history", historyData);
        } catch (error) {
            console.error("Join Error:", error);
            socket.emit("error", { message: "Failed to join conversation" });
        }
    });

    socket.on("load_more_messages", async (data: { conversationId: string, cursor: string }) => {
        try {
            const historyData = await chatService.getConversationHistory(data.conversationId, 50, data.cursor);
            socket.emit("more_messages_loaded", historyData);
        } catch (error) {
            console.error("Pagination Error:", error);
        }
    });

    const handlePrivateMessage = async (data: {
        conversationId: string,
        message: string,
        replyToId?: string,
        recipientId: string,
        attachmentUrl?: string,
        messageType?: 'TEXT' | 'IMAGE' | 'VIDEO'
    }) => {
        try {
            const msgType = data.messageType || 'TEXT';

            const savedMessage = await chatService.processPrivateMessage({
                userId: user.id,
                conversationId: data.conversationId,
                content: data.message,
                replyToId: data.replyToId,
                attachmentUrl: data.attachmentUrl,
                messageType: msgType
            });

            // 1. Send to Active Chat Window
            io.to(data.conversationId).emit("receive_message", savedMessage);

            // Generate Preview
            let previewText = data.message;
            if (msgType === 'IMAGE') previewText = data.message ? `📷 ${data.message}` : '📷 Image';
            else if (msgType === 'VIDEO') previewText = data.message ? `🎥 ${data.message}` : '🎥 Video';

            // 2. Notifications
            const recipientNotification = {
                conversationId: data.conversationId,
                senderId: user.id,
                message: previewText,
                isOwn: false
            };

            const senderNotification = {
                conversationId: data.conversationId,
                senderId: data.recipientId,
                message: previewText.startsWith('You:') ? previewText : `You: ${previewText}`,
                isOwn: true
            };

            io.to(data.recipientId).emit("new_message_notification", recipientNotification);
            io.to(user.id).emit("new_message_notification", senderNotification);

        } catch (error: any) {
            // Emitting error back to client so they can remove the "Optimistic" message
            socket.emit("message_error", { message: error.message });
        }
    };

    const handleMarkAsRead = async (data: { conversationId: string, recipientId: string }) => {
        try {
            await chatService.markMessagesAsRead(data.conversationId, user.id);

            const me = await db.query.users.findFirst({
                where: eq(users.id, user.id),
                columns: { isPrivate: true }
            });

            if (me && me.isPrivate) return;

            io.to(data.recipientId).emit("messages_read", { conversationId: data.conversationId, readerId: user.id });
        } catch (error) {
            console.error("Mark Read Error:", error);
        }
    };

    const handleDeleteMessage = async (data: { conversationId: string, messageId: string }) => {
        try {
            const deletedMessage = await chatService.deleteMessage(user.id, data.messageId);
            io.to(data.conversationId).emit("message_deleted", deletedMessage);
        } catch (error: any) {
            socket.emit("message_error", { message: "Failed to delete message" });
        }
    };

    socket.on("typing", (data: { conversationId: string, recipientId: string }) => {
        socket.to(data.recipientId).emit("user_typing", { userId: user.id, conversationId: data.conversationId });
    });

    socket.on("stop_typing", (data: { conversationId: string, recipientId: string }) => {
        socket.to(data.recipientId).emit("user_stop_typing", { userId: user.id });
    });

    socket.on("send_message", handlePrivateMessage);
    socket.on("delete_message", handleDeleteMessage);
    socket.on("mark_as_read", handleMarkAsRead);
};