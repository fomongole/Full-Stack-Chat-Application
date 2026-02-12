import { prisma } from '../config/prisma';
import { AppError } from '../utils/app.error';

interface SendMessageParams {
    userId: string;
    conversationId: string;
    content?: string;
    replyToId?: string;
    attachmentUrl?: string;
    messageType?: 'TEXT' | 'IMAGE' | 'VIDEO';
}

export class ChatService {

    async getOrCreateConversation(user1Id: string, user2Id: string) {
        let conversation = await prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { id: user1Id } } },
                    { participants: { some: { id: user2Id } } }
                ]
            },
            select: { id: true }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    participants: {
                        connect: [{ id: user1Id }, { id: user2Id }]
                    }
                },
                select: { id: true }
            });
        }
        return conversation;
    }

    async processPrivateMessage(params: SendMessageParams) {
        const { userId, conversationId, content, replyToId, attachmentUrl, messageType = 'TEXT' } = params;

        // 1. Fetch Conversation & Participants
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                participants: {
                    select: { id: true }
                }
            }
        });

        if (!conversation) throw new AppError("Conversation not found", 404);

        const recipient = conversation.participants.find(p => p.id !== userId);

        // 2. BLOCK CHECK (Bidirectional)
        // If either party blocked the other, messages fail.
        if (recipient) {
            const blockCount = await prisma.block.count({
                where: {
                    OR: [
                        { blockerId: recipient.id, blockedId: userId }, // They blocked me
                        { blockerId: userId, blockedId: recipient.id }  // I blocked them
                    ]
                }
            });

            if (blockCount > 0) {
                // Return a generic error or silent fail.
                // 403 Forbidden is appropriate.
                throw new AppError("Message cannot be sent. You are blocked or have blocked this user.", 403);
            }
        }

        // 3. Create Message
        const [newMessage] = await prisma.$transaction([
            prisma.message.create({
                data: {
                    content: content || "",
                    authorId: userId,
                    conversationId: conversationId,
                    messageType,
                    attachmentUrl,
                    replyToId: replyToId
                },
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    isRead: true,
                    isDeleted: true,
                    messageType: true,
                    attachmentUrl: true,
                    conversationId: true,
                    author: { select: { id: true, username: true, image: true } },
                    replyTo: {
                        select: {
                            id: true,
                            content: true,
                            messageType: true,
                            author: { select: { username: true } }
                        }
                    }
                }
            }),
            prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            })
        ]);

        return this.formatMessage(newMessage);
    }

    async deleteMessage(userId: string, messageId: string) {
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: { authorId: true }
        });

        if (!message) throw new AppError("Message not found", 404);
        if (message.authorId !== userId) throw new AppError("You can only delete your own messages", 403);

        const deletedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                isDeleted: true,
                content: "This message was deleted",
                attachmentUrl: null,
                messageType: "TEXT"
            },
            select: {
                id: true,
                content: true,
                createdAt: true,
                isRead: true,
                isDeleted: true,
                messageType: true,
                attachmentUrl: true,
                conversationId: true,
                author: { select: { id: true, username: true, image: true } },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        messageType: true,
                        author: { select: { username: true } }
                    }
                }
            }
        });

        return this.formatMessage(deletedMessage);
    }

    async getConversationHistory(conversationId: string, limit = 50, cursor?: string) {
        const messages = await prisma.message.findMany({
            where: { conversationId },
            take: limit,
            ...(cursor && { skip: 1, cursor: { id: cursor } }),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                content: true,
                createdAt: true,
                isRead: true,
                isDeleted: true,
                messageType: true,
                attachmentUrl: true,
                conversationId: true,
                author: { select: { id: true, username: true, image: true } },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        messageType: true,
                        author: { select: { username: true } }
                    }
                }
            }
        });

        const formatted = messages.map(msg => this.formatMessage(msg)).reverse();

        return {
            messages: formatted,
            hasMore: messages.length === limit,
            nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null
        };
    }

    async markMessagesAsRead(conversationId: string, currentUserId: string) {
        await prisma.message.updateMany({
            where: {
                conversationId: conversationId,
                isRead: false,
                authorId: { not: currentUserId }
            },
            data: { isRead: true }
        });
    }

    private formatMessage(msg: any) {
        return {
            id: msg.id,
            conversationId: msg.conversationId,
            username: msg.author.username,
            authorId: msg.author.id,
            image: msg.author.image,
            message: msg.isDeleted ? "This message was deleted" : msg.content,
            messageType: msg.messageType,
            attachmentUrl: msg.attachmentUrl,
            isDeleted: msg.isDeleted,
            isRead: msg.isRead,
            timestamp: msg.createdAt,
            replyTo: msg.replyTo ? {
                id: msg.replyTo.id,
                username: msg.replyTo.author.username,
                content: msg.replyTo.isDeleted ? "Message deleted" : msg.replyTo.content,
                messageType: msg.replyTo.messageType
            } : null
        };
    }
}

export const chatService = new ChatService();