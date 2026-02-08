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
        // Optimization: Check for existing convo using findFirst (uses implicit index on relations)
        let conversation = await prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { id: user1Id } } },
                    { participants: { some: { id: user2Id } } }
                ]
            },
            select: { id: true } // Only need ID initially
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

        // 1. Security & Existence Check (Optimized Select)
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                participants: {
                    select: { id: true } // Not fetching full user objects
                }
            }
        });

        if (!conversation) throw new AppError("Conversation not found", 404);

        const recipient = conversation.participants.find(p => p.id !== userId);

        // Block Check (Optimized using count instead of findFirst to avoid fetching object)
        if (recipient) {
            const blockCount = await prisma.block.count({
                where: {
                    OR: [
                        { blockerId: recipient.id, blockedId: userId },
                        { blockerId: userId, blockedId: recipient.id }
                    ]
                }
            });

            if (blockCount > 0) {
                throw new AppError("Message cannot be sent. Block restriction active.", 403);
            }
        }

        // 2. Transaction: Create Message & Update Conversation timestamp
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
                // Lean Select for the returned message
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
        // Safety check
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

    async getConversationHistory(conversationId: string, limit = 50) {
        // OPTIMIZATION:
        // Uses the @@index([conversationId, createdAt]) defined in schema
        const messages = await prisma.message.findMany({
            where: { conversationId },
            take: limit,
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

        // Reversing the array.
        // We fetched [Newest -> Oldest] for the DB query,
        // but the UI expects [Oldest -> Newest] to render top-to-bottom.
        return messages.reverse().map(msg => this.formatMessage(msg));
    }

    async markMessagesAsRead(conversationId: string, currentUserId: string) {
        // Uses @@index([conversationId, isRead])
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
        // Helper to keep formatting consistent
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