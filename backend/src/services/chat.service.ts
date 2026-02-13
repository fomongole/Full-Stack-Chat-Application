import { eq, and, or, desc, lt, ne } from 'drizzle-orm';
import { db } from '../config/db';
import { conversations, conversationParticipants, blocks, messages } from '../db/schema';
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
        // Efficient check for existing conversation between two users via the junction table
        const user1Convos = await db.query.conversationParticipants.findMany({
            where: eq(conversationParticipants.userId, user1Id),
            with: {
                conversation: {
                    with: {
                        participants: {
                            where: eq(conversationParticipants.userId, user2Id)
                        }
                    }
                }
            }
        });

        const existing = user1Convos.find(c => c.conversation.participants.length > 0);

        if (existing) {
            return existing.conversation;
        }

        // Transactional creation of conversation and participants
        return await db.transaction(async (tx) => {
            const [newConv] = await tx.insert(conversations).values({}).returning();

            await tx.insert(conversationParticipants).values([
                { conversationId: newConv.id, userId: user1Id },
                { conversationId: newConv.id, userId: user2Id }
            ]);

            return newConv;
        });
    }

    async processPrivateMessage(params: SendMessageParams) {
        const { userId, conversationId, content, replyToId, attachmentUrl, messageType = 'TEXT' } = params;

        // 1. Fetch Conversation & Participants
        const participants = await db.query.conversationParticipants.findMany({
            where: eq(conversationParticipants.conversationId, conversationId),
            with: { user: true }
        });

        if (participants.length === 0) throw new AppError("Conversation not found", 404);

        const recipient = participants.find(p => p.userId !== userId)?.user;

        // Ensure recipient exists and we capture their true ID securely from DB
        if (!recipient) throw new AppError("Recipient not found in conversation", 404);
        //

        // 2. BLOCK CHECK (Bidirectional)
        if (recipient) {
            const blockExists = await db.query.blocks.findFirst({
                where: or(
                    and(eq(blocks.blockerId, recipient.id), eq(blocks.blockedId, userId)),
                    and(eq(blocks.blockerId, userId), eq(blocks.blockedId, recipient.id))
                )
            });

            if (blockExists) {
                throw new AppError("Message cannot be sent. You are blocked or have blocked this user.", 403);
            }
        }

        // 3. Create Message Transactionally
        return await db.transaction(async (tx) => {
            const [newMessage] = await tx.insert(messages).values({
                content: content || "",
                authorId: userId,
                conversationId: conversationId,
                messageType,
                attachmentUrl,
                replyToId: replyToId
            }).returning();

            // Fetch fully populated message for return
            const fullMessage = await tx.query.messages.findFirst({
                where: eq(messages.id, newMessage.id),
                with: {
                    author: true,
                    replyTo: { with: { author: true } }
                }
            });

            await tx.update(conversations)
                .set({ updatedAt: new Date() })
                .where(eq(conversations.id, conversationId));

            // Return the structured object containing the verified recipientId
            return {
                message: this.formatMessage(fullMessage),
                recipientId: recipient.id
            };
        });
    }

    async deleteMessage(userId: string, messageId: string) {
        const message = await db.query.messages.findFirst({
            where: eq(messages.id, messageId)
        });

        if (!message) throw new AppError("Message not found", 404);
        if (message.authorId !== userId) throw new AppError("You can only delete your own messages", 403);

        const [deletedMessage] = await db.update(messages)
            .set({
                isDeleted: true,
                content: "This message was deleted",
                attachmentUrl: null,
                messageType: "TEXT"
            })
            .where(eq(messages.id, messageId))
            .returning();

        // Refetch to include relations for consistent formatting
        const fullDeleted = await db.query.messages.findFirst({
            where: eq(messages.id, messageId),
            with: { author: true, replyTo: { with: { author: true } } }
        });

        return this.formatMessage(fullDeleted);
    }

    async getConversationHistory(conversationId: string, limit = 50, cursor?: string) {
        // Cursor pagination logic based on timestamp
        const whereClause = cursor
            ? and(eq(messages.conversationId, conversationId), lt(messages.createdAt, new Date(cursor)))
            : eq(messages.conversationId, conversationId);

        const msgs = await db.query.messages.findMany({
            where: whereClause,
            limit: limit,
            orderBy: desc(messages.createdAt),
            with: {
                author: true,
                replyTo: { with: { author: true } }
            }
        });

        const formatted = msgs.map(msg => this.formatMessage(msg)).reverse();

        return {
            messages: formatted,
            hasMore: msgs.length === limit,
            // Use timestamp as cursor for next page
            nextCursor: msgs.length > 0 ? msgs[msgs.length - 1].createdAt.toISOString() : null
        };
    }

    async markMessagesAsRead(conversationId: string, currentUserId: string) {
        await db.update(messages)
            .set({ isRead: true })
            .where(and(
                eq(messages.conversationId, conversationId),
                eq(messages.isRead, false),
                ne(messages.authorId, currentUserId)
            ));
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