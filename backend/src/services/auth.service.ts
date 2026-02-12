import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { users } from '../db/schema';
import { env } from '../config/env';
import { AppError } from '../utils/app.error';
import { generateAccessToken, generateRefreshToken } from '../utils/token.util';

export class AuthService {
    private async generateUniqueUsername(baseEmail: string): Promise<string> {
        const prefix = baseEmail.split('@')[0];
        let isUnique = false;
        let finalUsername = prefix;

        while (!isUnique) {
            const existing = await db.query.users.findFirst({
                where: eq(users.username, finalUsername)
            });
            if (!existing) {
                isUnique = true;
            } else {
                finalUsername = `${prefix}_${Math.floor(Math.random() * 10000)}`;
            }
        }
        return finalUsername;
    }

    async register(userData: any) {
        const existingEmail = await db.query.users.findFirst({
            where: eq(users.email, userData.email)
        });
        if (existingEmail) throw new AppError('User with this email already exists', 400);

        let username = userData.username;
        if (!username) {
            username = await this.generateUniqueUsername(userData.email);
        } else {
            const existingUser = await db.query.users.findFirst({
                where: eq(users.username, username)
            });
            if (existingUser) throw new AppError('Username is already taken', 400);
        }

        const hashedPassword = await bcrypt.hash(userData.password, 12);

        const [newUser] = await db.insert(users).values({
            email: userData.email,
            username: username,
            password: hashedPassword,
            image: userData.image || null,
            about: userData.about || "Hey there! I'm using Chat App."
        }).returning();

        const accessToken = generateAccessToken({ id: newUser.id, username: newUser.username });
        const refreshToken = generateRefreshToken({ id: newUser.id, username: newUser.username });

        return { accessToken, refreshToken, user: newUser };
    }

    async login(credentials: any) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, credentials.email)
        });

        if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
            throw new AppError('Invalid email or password', 401);
        }

        // Update to online immediately on login
        await db.update(users)
            .set({ isOnline: true })
            .where(eq(users.id, user.id));

        // Generate BOTH tokens
        const accessToken = generateAccessToken({ id: user.id, username: user.username });
        const refreshToken = generateRefreshToken({ id: user.id, username: user.username });

        return { accessToken, refreshToken, user };
    }

    /**
     * Verifies the Refresh Token and issues a new Access Token
     */
    async refreshToken(token: string) {
        try {
            // 1. Verify the refresh token
            const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; username: string };

            // 2. Check if user still exists (Security Check)
            const user = await db.query.users.findFirst({ where: eq(users.id, decoded.id) });

            if (!user) {
                throw new AppError('User no longer exists', 401);
            }

            // 3. Generate a NEW Access Token
            const newAccessToken = generateAccessToken({ id: user.id, username: user.username });

            return { accessToken: newAccessToken, user };
        } catch (error) {
            throw new AppError('Invalid or expired refresh token', 401);
        }
    }
}

export const authService = new AuthService();