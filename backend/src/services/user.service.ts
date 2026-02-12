import { eq, ne, and, or, desc, like } from 'drizzle-orm';
import { db } from '../config/db';
import { users, blocks, conversationParticipants, conversations, messages } from '../db/schema';
import cloudinary from '../config/cloudinary';
import { AppError } from '../utils/app.error';

/**
 * Service handling User Profile management, Blocking logic,
 * and optimized sidebar data fetching.
 */
export class UserService {

    /**
     * Updates user profile text and optionally uploads a new profile image.
     */
    async updateProfile(userId: string, data: { username?: string; about?: string; isPrivate?: string }, file?: Express.Multer.File) {
        let imageUrl: string | undefined;

        // 1. Handle Image Upload to Cloudinary
        if (file) {
            const b64 = Buffer.from(file.buffer).toString('base64');
            const dataURI = "data:" + file.mimetype + ";base64," + b64;
            try {
                const uploadResponse = await cloudinary.uploader.upload(dataURI, {
                    folder: 'chat-app-profiles',
                    resource_type: 'image',
                    transformation: [{ width: 500, height: 500, crop: "fill" }]
                });
                imageUrl = uploadResponse.secure_url;
            } catch (error) {
                throw new AppError('Failed to upload image', 500);
            }
        }

        const isPrivateBoolean = data.isPrivate === 'true';

        // 2. Check Username Uniqueness
        if (data.username) {
            const existingUser = await db.query.users.findFirst({
                where: eq(users.username, data.username)
            });

            if (existingUser && existingUser.id !== userId) {
                throw new AppError('This username is already taken.', 409);
            }
        }

        // 3. Update Database
        const [updatedUser] = await db.update(users)
            .set({
                ...(data.username && { username: data.username }),
                ...(data.about && { about: data.about }),
                ...(data.isPrivate !== undefined && { isPrivate: isPrivateBoolean }),
                ...(imageUrl && { image: imageUrl }),
            })
            .where(eq(users.id, userId))
            .returning();

        return updatedUser;
    }

    /**
     * Blocks a user and captures a "Frozen Snapshot" of their current profile.
     * This ensures the blocker sees the profile as it was NOW, forever.
     */
    async blockUser(blockerId: string, blockedId: string) {
        if (blockerId === blockedId) throw new AppError("You cannot block yourself", 400);

        // Fetch the user to be blocked to snapshot their data
        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, blockedId),
            columns: { image: true, about: true }
        });

        if (!targetUser) throw new AppError("User not found", 404);

        return await db.insert(blocks).values({
            blockerId,
            blockedId,
            // CAPTURE SNAPSHOT
            frozenPayload: {
                image: targetUser.image,
                about: targetUser.about
            }
        });
    }

    async unblockUser(blockerId: string, blockedId: string) {
        return await db.delete(blocks)
            .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
    }

    /**
     * Lean Sidebar Fetcher
     * Handles complex "View Logic" (Frozen Snapshots / Blackouts).
     */
    async getSidebarUsers(currentUserId: string) {
        // Query explicit junction table with nested relations
        const userConversations = await db.query.conversationParticipants.findMany({
            where: eq(conversationParticipants.userId, currentUserId),
            with: {
                conversation: {
                    with: {
                        messages: {
                            orderBy: desc(messages.createdAt),
                            limit: 1,
                        },
                        participants: {
                            with: {
                                user: {
                                    with: {
                                        blockedBy: { where: eq(blocks.blockerId, currentUserId) },
                                        blockedUsers: { where: eq(blocks.blockedId, currentUserId) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        return userConversations.map(cp => {
            const conv = cp.conversation;
            const otherParticipant = conv.participants.find(p => p.userId !== currentUserId);
            if (!otherParticipant) return null;
            const user = otherParticipant.user;

            const lastMsg = conv.messages[0];
            const unreadCount = 0; // Requires aggregation query for perfect count

            // --- RELATIONSHIP LOGIC ---
            const iBlockedThemBlock = user.blockedBy[0];
            const iBlockedThem = !!iBlockedThemBlock;
            const theyBlockedMe = user.blockedUsers.length > 0;
            const isStatusHidden = iBlockedThem || theyBlockedMe;

            // --- IMAGE / ABOUT RESOLUTION ---
            let finalImage = user.image;
            let finalAbout = user.about;

            // CASE 1: They Blocked Me -> Total Blackout
            if (theyBlockedMe) {
                finalImage = null;
                finalAbout = null;
            }
            // CASE 2: I Blocked Them -> Frozen Snapshot
            else if (iBlockedThem) {
                const snapshot = iBlockedThemBlock.frozenPayload as any;
                if (snapshot) {
                    finalImage = snapshot.image || null;
                    finalAbout = snapshot.about || null;
                }
            }
            // CASE 3: Private Account
            else if (user.isPrivate) {
                finalAbout = null;
            }

            // --- MESSAGE PREVIEW ---
            let previewText = lastMsg?.content || "Media message";
            if (lastMsg?.messageType === 'IMAGE') previewText = "📷 Image";
            if (lastMsg?.messageType === 'VIDEO') previewText = "🎥 Video";
            if (lastMsg && lastMsg.authorId === currentUserId) previewText = `You: ${previewText}`;
            if (lastMsg && lastMsg.isDeleted) previewText = "Message deleted";

            return {
                id: user.id,
                username: user.username,
                image: finalImage,
                about: finalAbout,
                email: (theyBlockedMe || iBlockedThem || user.isPrivate) ? null : user.email,
                isOnline: isStatusHidden ? false : user.isOnline,
                lastSeen: isStatusHidden ? new Date(0) : user.lastSeen,
                isPrivate: user.isPrivate,
                lastMessage: previewText,
                lastActivity: lastMsg?.createdAt || conv.updatedAt,
                unreadCount,
                hasBlocked: iBlockedThem,
                isBlockedBy: theyBlockedMe
            };
        }).filter(Boolean).sort((a: any, b: any) => b.lastActivity - a.lastActivity);
    }

    /**
     * Search Users:
     * - Must NOT show users who blocked me.
     * - Respects privacy settings.
     */
    async searchUsers(query: string, currentUserId: string) {
        const foundUsers = await db.query.users.findMany({
            where: and(
                ne(users.id, currentUserId),
                or(
                    like(users.username, `%${query}%`),
                    like(users.email, `%${query}%`)
                )
            ),
            limit: 20,
            with: {
                blockedBy: { where: eq(blocks.blockerId, currentUserId) },
                blockedUsers: { where: eq(blocks.blockedId, currentUserId) }
            }
        });

        // Filter out those who blocked me
        return foundUsers
            .filter(u => u.blockedUsers.length === 0)
            .map(user => {
                const iBlockedThemBlock = user.blockedBy[0];
                let displayImage = user.image;
                let displayAbout = user.about;

                if (iBlockedThemBlock && iBlockedThemBlock.frozenPayload) {
                    const snap = iBlockedThemBlock.frozenPayload as any;
                    displayImage = snap.image;
                    displayAbout = snap.about;
                }

                if (user.isPrivate) {
                    displayAbout = null;
                }

                return {
                    id: user.id,
                    username: user.username,
                    image: displayImage,
                    isPrivate: user.isPrivate,
                    isOnline: (user.isPrivate || iBlockedThemBlock) ? false : user.isOnline,
                    lastSeen: (user.isPrivate || iBlockedThemBlock) ? null : user.lastSeen,
                    about: displayAbout
                };
            });
    }
}

export const userService = new UserService();