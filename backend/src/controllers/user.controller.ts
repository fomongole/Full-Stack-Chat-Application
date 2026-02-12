import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { catchAsync } from '../utils/catch.async';

/**
 * Updates the user's profile (Username, Image, About, Privacy).
 * This is a hybrid controller. It updates the DB via REST,
 * but ALSO triggers a Socket broadcast to ensure immediate UI updates
 * for other users viewing this profile.
 */
export const updateProfile = catchAsync(async (req: any, res: Response) => {
    // req.file contains the image, req.body contains text fields
    const updatedUser = await userService.updateProfile(
        req.user.id,
        {
            username: req.body.username,
            about: req.body.about,
            isPrivate: req.body.isPrivate
        },
        req.file
    );

    // Retrieve the socket instance set in server.ts
    const io = req.app.get('io');

    // Real-time Update: Inform all clients about the profile change.
    io.emit("user_update", {
        userId: updatedUser.id,
        username: updatedUser.username,
        image: updatedUser.image,
        isPrivate: updatedUser.isPrivate,
        about: updatedUser.isPrivate ? null : updatedUser.about
    });

    res.status(200).json({
        status: 'success',
        data: { user: updatedUser }
    });
});

/**
 * Fetches the "Sidebar" list.
 */
export const getUsers = catchAsync(async (req: any, res: Response) => {
    const users = await userService.getSidebarUsers(req.user.id);

    res.status(200).json({
        status: 'success',
        data: { users }
    });
});

/**
 * Global Search for finding users in the sidebar.
 */
export const searchUsers = catchAsync(async (req: any, res: Response) => {
    const query = req.query.q as string;

    if (!query) {
        return res.status(200).json({ status: 'success', data: { users: [] } });
    }

    const users = await userService.searchUsers(query, req.user.id);

    res.status(200).json({
        status: 'success',
        data: { users }
    });
});

/**
 * Blocks a specific user.
 * Emits real-time event so both users see the block immediately.
 */
export const blockUser = catchAsync(async (req: any, res: Response) => {
    const { userIdToBlock } = req.body;
    const currentUserId = req.user.id;

    await userService.blockUser(currentUserId, userIdToBlock);

    // Real-time Update
    const io = req.app.get('io');

    // Notify ME (Blocker) - so UI updates to show "Unblock"
    io.to(currentUserId).emit("user_relationship_update", {
        targetUserId: userIdToBlock,
        type: 'BLOCK'
    });

    // Notify THEM (Blocked) - so their UI updates to hide my image/status
    io.to(userIdToBlock).emit("user_relationship_update", {
        targetUserId: currentUserId,
        type: 'BLOCKED_BY'
    });

    res.status(200).json({ status: 'success', message: 'User blocked' });
});

/**
 * Unblocks a specific user.
 * Emits real-time event so both users see the unblock immediately.
 */
export const unblockUser = catchAsync(async (req: any, res: Response) => {
    const { userIdToUnblock } = req.body;
    const currentUserId = req.user.id;

    await userService.unblockUser(currentUserId, userIdToUnblock);

    // Real-time Update
    const io = req.app.get('io');

    // Notify ME (Unblocker)
    io.to(currentUserId).emit("user_relationship_update", {
        targetUserId: userIdToUnblock,
        type: 'UNBLOCK'
    });

    // Notify THEM (Unblocked) - so they can see my image/status again
    io.to(userIdToUnblock).emit("user_relationship_update", {
        targetUserId: currentUserId,
        type: 'UNBLOCKED_BY'
    });

    res.status(200).json({ status: 'success', message: 'User unblocked' });
});