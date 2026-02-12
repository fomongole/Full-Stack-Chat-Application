import { prisma } from '../config/prisma';
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
            const existingUser = await prisma.user.findUnique({
                where: { username: data.username }
            });

            if (existingUser && existingUser.id !== userId) {
                throw new AppError('This username is already taken.', 409);
            }
        }

        // 3. Update Database
        return prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.username && { username: data.username }),
                ...(data.about && { about: data.about }),
                ...(data.isPrivate !== undefined && { isPrivate: isPrivateBoolean }),
                ...(imageUrl && { image: imageUrl }),
            },
            select: {
                id: true,
                username: true,
                email: true,
                image: true,
                about: true,
                isOnline: true,
                isPrivate: true
            }
        });
    }

    /**
     * Blocks a user and captures a "Frozen Snapshot" of their current profile.
     * This ensures the blocker sees the profile as it was NOW, forever.
     */
    async blockUser(blockerId: string, blockedId: string) {
        if (blockerId === blockedId) throw new AppError("You cannot block yourself", 400);

        // Fetch the user to be blocked to snapshot their data
        const targetUser = await prisma.user.findUnique({
            where: { id: blockedId },
            select: { image: true, about: true }
        });

        if (!targetUser) throw new AppError("User not found", 404);

        return await prisma.block.create({
            data: {
                blockerId,
                blockedId,
                // CAPTURE SNAPSHOT
                frozenPayload: {
                    image: targetUser.image,
                    about: targetUser.about
                }
            }
        });
    }

    async unblockUser(blockerId: string, blockedId: string) {
        return await prisma.block.deleteMany({
            where: { blockerId, blockedId }
        });
    }

    /**
     * OPTIMIZATION: Lean Sidebar Fetcher
     * Handles complex "View Logic":
     * - Private Accounts: Hide data if not connected
     * - Blocked By Me: Show "Frozen Snapshot" (Old Image/Bio).
     * - Blocked Me: Show "Blackout" (No Image/Bio).
     */
    async getSidebarUsers(currentUserId: string) {
        const conversations = await prisma.conversation.findMany({
            where: {
                participants: { some: { id: currentUserId } }
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
            select: {
                id: true,
                updatedAt: true,
                participants: {
                    where: { id: { not: currentUserId } },
                    select: {
                        id: true,
                        username: true,
                        image: true,
                        isOnline: true,
                        lastSeen: true,
                        isPrivate: true,
                        about: true,
                        email: true,
                        blockedBy: {
                            where: { blockerId: currentUserId },
                            select: { id: true, frozenPayload: true }
                        },
                        blockedUsers: {
                            where: { blockedId: currentUserId },
                            select: { id: true }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        content: true,
                        createdAt: true,
                        messageType: true,
                        authorId: true,
                        isDeleted: true
                    }
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                isRead: false,
                                authorId: { not: currentUserId }
                            }
                        }
                    }
                }
            }
        });

        return conversations.map(conv => {
            const user = conv.participants[0];
            if (!user) return null;

            const lastMsg = conv.messages[0];
            const unreadCount = conv._count.messages;

            // --- RELATIONSHIP LOGIC ---
            const iBlockedThemBlock = user.blockedBy[0]; // If exists, I blocked them
            const iBlockedThem = !!iBlockedThemBlock;
            const theyBlockedMe = user.blockedUsers.length > 0;

            const isStatusHidden = iBlockedThem || theyBlockedMe;

            // --- IMAGE / ABOUT RESOLUTION ---
            let finalImage = user.image;
            let finalAbout = user.about;

            // CASE 1: They Blocked Me -> Total Blackout
            if (theyBlockedMe) {
                finalImage = null; // Default placeholder
                finalAbout = null; // "No bio available"
            }
            // CASE 2: I Blocked Them -> Frozen Snapshot
            else if (iBlockedThem) {
                const snapshot = iBlockedThemBlock.frozenPayload as any;
                if (snapshot) {
                    finalImage = snapshot.image || null; // The image from back then
                    finalAbout = snapshot.about || null;
                }
                // If no snapshot (legacy block), default to current but stop updates (backend won't push new ones via socket).
            }
            // CASE 3: Private Account (and not blocked)
            else if (user.isPrivate) {
                // Private users still show their image to people they chatted with? but maybe hide Bio/Email.
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
        }).filter(Boolean);
    }

    /**
     * Search Users:
     * - Must NOT show users who blocked me.
     * - Must show users I blocked (usually), but maybe at bottom or marked.
     * - Respects privacy settings (hiding about/status).
     */
    async searchUsers(query: string, currentUserId: string) {
        const users = await prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: currentUserId } },
                    {
                        OR: [
                            { username: { contains: query, mode: 'insensitive' } },
                            { email: { contains: query, mode: 'insensitive' } }
                        ]
                    },
                    // Hide users who blocked ME
                    { blockedUsers: { none: { blockedId: currentUserId } } }
                ]
            },
            take: 20,
            select: {
                id: true,
                username: true,
                image: true,
                isPrivate: true,
                isOnline: true,
                lastSeen: true,
                about: true,
                // Check if I blocked them
                blockedBy: {
                    where: { blockerId: currentUserId },
                    select: { frozenPayload: true }
                }
            }
        });

        return users.map(user => {
            const iBlockedThemBlock = user.blockedBy[0];

            // If I blocked them, show Snapshot. Else show Current.
            let displayImage = user.image;
            let displayAbout = user.about;

            if (iBlockedThemBlock && iBlockedThemBlock.frozenPayload) {
                const snap = iBlockedThemBlock.frozenPayload as any;
                displayImage = snap.image;
                displayAbout = snap.about;
            }

            // Privacy Logic
            if (user.isPrivate) {
                displayAbout = null;
            }

            return {
                id: user.id,
                username: user.username,
                image: displayImage,
                isPrivate: user.isPrivate,
                // Hide status for blocked/private users
                isOnline: (user.isPrivate || iBlockedThemBlock) ? false : user.isOnline,
                lastSeen: (user.isPrivate || iBlockedThemBlock) ? null : user.lastSeen,
                about: displayAbout
            };
        });
    }
}

export const userService = new UserService();