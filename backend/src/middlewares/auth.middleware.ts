import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/app.error';
import { Response, NextFunction } from "express";

export const authMiddleware = (socket: Socket, next: (err?: any) => void) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new AppError('Authentication error: Token missing', 401));
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; username: string };

        // Attach user to socket with proper data
        (socket as any).user = decoded;
        next();
    } catch (err) {
        next(new AppError('Authentication error: Invalid or expired token', 401));
    }
};

export const protect = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        return next(new AppError('You are not logged in', 401));
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; username: string };
        req.user = decoded;
        next();
    } catch (err) {
        next(new AppError('Invalid token. Please log in again.', 401));
    }
};