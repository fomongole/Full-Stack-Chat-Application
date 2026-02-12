import { prisma } from '../config/prisma';
import cloudinary from '../config/cloudinary';
import { AppError } from '../utils/app.error';

export class UserService {
    async updateProfile(userId: string, data: { username?: string; about?: string; isPrivate?: string }, file?: Express.Multer.File) {
        let imageUrl: string | undefined;

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

        // Check Username Uniqueness (if changing)
        if (data.username) {
            const existingUser = await prisma.user.findUnique({
                where: { username: data.username }
            });

            // If user exists AND it's not the current user (collision)
            if (existingUser && existingUser.id !== userId) {
                throw new AppError('This username is already taken.', 409);
            }
        }

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

    async blockUser(blockerId: string, blockedId: string) {
        if (blockerId === blockedId) throw new AppError("You cannot block yourself", 400);
        return await prisma.block.create({
            data: { blockerId, blockedId }
        });
    }

    async unblockUser(blockerId: string, blockedId: string) {
        return await prisma.block.deleteMany({
            where: { blockerId, blockedId }
        });
    }

    /**
     * OPTIMIZATION: Lean Sidebar Fetcher
     * 1. Uses 'select' to fetch ONLY needed columns (saves memory/bandwidth).
     * 2. Fetches only necessary relation data.
     */
    async getSidebarUsers(currentUserId: string) {
        const conversations = await prisma.conversation.findMany({
            where: {
                participants: { some: { id: currentUserId } }
            },
            // Performance: Sort by index
            orderBy: { updatedAt: 'desc' },
            take: 100, // Safety limit
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
                        // Lean Block Check
                        blockedBy: { where: { blockerId: currentUserId }, select: { id: true } },
                        blockedUsers: { where: { blockedId: currentUserId }, select: { id: true } }
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

        // The mapping logic operates on lighter objects
        return conversations.map(conv => {
            const user = conv.participants[0];
            if (!user) return null;

            const lastMsg = conv.messages[0];
            const unreadCount = conv._count.messages;

            const iBlockedThem = user.blockedBy.length > 0;
            const theyBlockedMe = user.blockedUsers.length > 0;
            const isStatusHidden = iBlockedThem || theyBlockedMe;
            const isProfileHidden = theyBlockedMe;

            let previewText = lastMsg?.content || "Media message";
            if (lastMsg?.messageType === 'IMAGE') previewText = "📷 Image";
            if (lastMsg?.messageType === 'VIDEO') previewText = "🎥 Video";
            if (lastMsg && lastMsg.authorId === currentUserId) previewText = `You: ${previewText}`;
            if (lastMsg && lastMsg.isDeleted) previewText = "Message deleted";

            const baseUser = {
                id: user.id,
                username: user.username,
                image: isProfileHidden ? null : user.image,
                about: isProfileHidden ? null : user.about,
                email: isProfileHidden ? null : user.email,
                isOnline: isStatusHidden ? false : user.isOnline,
                lastSeen: isStatusHidden ? new Date(0) : user.lastSeen,
                isPrivate: user.isPrivate,
                lastMessage: previewText,
                lastActivity: lastMsg?.createdAt || conv.updatedAt,
                unreadCount,
                hasBlocked: iBlockedThem,
                isBlockedBy: theyBlockedMe
            };

            if (user.isPrivate && !isProfileHidden && !iBlockedThem) {
                return { ...baseUser, about: null, email: null };
            }

            return baseUser;
        }).filter(Boolean);
    }

    async searchUsers(query: string, currentUserId: string) {
        // Optimized search with specific Select
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
                    { blockedUsers: { none: { blockedId: currentUserId } } },
                    { blockedBy: { none: { blockerId: currentUserId } } }
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
                about: true
            }
        });

        return users.map(user => user.isPrivate ? { ...user, isPrivate: true, about: null } : user);
    }
}

export const userService = new UserService();