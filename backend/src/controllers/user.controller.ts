import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { catchAsync } from '../utils/catch.async';
import { AppError } from '../utils/app.error';

/**
 * Updates the user's profile (Username, Image, About, Privacy).
 */
export const updateProfile = catchAsync(async (req: any, res: Response) => {
    // Safety Check: Ensure user is authenticated
    if (!req.user || !req.user.id) {
        throw new AppError('User not authenticated', 401);
    }

    const updatedUser = await userService.updateProfile(
        req.user.id,
        {
            username: req.body.username,
            about: req.body.about,
            isPrivate: req.body.isPrivate
        },
        req.file
    );

    const io = req.app.get('io');

    // Real-time Update:
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

export const getUsers = catchAsync(async (req: any, res: Response) => {
    // Safety Check: Prevents 500 error if middleware fails to attach user
    if (!req.user || !req.user.id) {
        throw new AppError('User not authenticated', 401);
    }

    // This function ALREADY enforces the Frozen Snapshot logic
    const users = await userService.getSidebarUsers(req.user.id);

    res.status(200).json({
        status: 'success',
        data: { users }
    });
});

export const searchUsers = catchAsync(async (req: any, res: Response) => {
    if (!req.user || !req.user.id) throw new AppError('User not authenticated', 401);

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

export const blockUser = catchAsync(async (req: any, res: Response) => {
    if (!req.user || !req.user.id) throw new AppError('User not authenticated', 401);

    const { userIdToBlock } = req.body;
    const currentUserId = req.user.id;

    // This captures the SNAPSHOT
    await userService.blockUser(currentUserId, userIdToBlock);

    // Real-time Update
    const io = req.app.get('io');

    // Notify ME (Blocker)
    io.to(currentUserId).emit("user_relationship_update", {
        targetUserId: userIdToBlock,
        type: 'BLOCK'
    });

    // Notify THEM (Blocked)
    io.to(userIdToBlock).emit("user_relationship_update", {
        targetUserId: currentUserId,
        type: 'BLOCKED_BY'
    });

    res.status(200).json({ status: 'success', message: 'User blocked' });
});

export const unblockUser = catchAsync(async (req: any, res: Response) => {
    if (!req.user || !req.user.id) throw new AppError('User not authenticated', 401);

    const { userIdToUnblock } = req.body;
    const currentUserId = req.user.id;

    await userService.unblockUser(currentUserId, userIdToUnblock);

    const io = req.app.get('io');

    io.to(currentUserId).emit("user_relationship_update", {
        targetUserId: userIdToUnblock,
        type: 'UNBLOCK'
    });

    io.to(userIdToUnblock).emit("user_relationship_update", {
        targetUserId: currentUserId,
        type: 'UNBLOCKED_BY'
    });

    res.status(200).json({ status: 'success', message: 'User unblocked' });
});