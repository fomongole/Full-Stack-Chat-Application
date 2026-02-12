import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface TokenPayload {
    id: string;
    username: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
};