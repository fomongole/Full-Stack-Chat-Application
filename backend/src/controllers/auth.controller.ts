import { Request, Response, CookieOptions } from 'express';
import { authService } from '../services/auth.service';
import { catchAsync } from '../utils/catch.async';
import { AppError } from '../utils/app.error';

// Helper to set the Refresh Token as an HTTP-Only Cookie
const sendTokenCookie = (res: Response, token: string) => {
    const isProduction = process.env.NODE_ENV === 'production';

    const cookieOptions: CookieOptions = {
        httpOnly: true, // Prevents JavaScript access (XSS protection)
        secure: isProduction, // MUST be true if sameSite is 'none'
        // 'none' allows cross-origin cookie sending (Vercel Frontend -> Backend API)
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
    };

    res.cookie('refreshToken', token, cookieOptions);
};

export const register = catchAsync(async (req: Request, res: Response) => {
    const { accessToken, refreshToken, user } = await authService.register(req.body);

    // Set Refresh Token in Cookie
    sendTokenCookie(res, refreshToken);

    // Send Access Token in JSON
    res.status(201).json({
        status: 'success',
        token: accessToken,
        data: { user }
    });
});

export const login = catchAsync(async (req: Request, res: Response) => {
    const { accessToken, refreshToken, user } = await authService.login(req.body);

    // Set Refresh Token in Cookie
    sendTokenCookie(res, refreshToken);

    res.status(200).json({
        status: 'success',
        token: accessToken,
        data: { user }
    });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
    // Get token from cookie (cookie-parser middleware)
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        throw new AppError('No refresh token found. Please log in.', 401);
    }

    // Verify and get BOTH new tokens (Refresh Token Rotation)
    const { accessToken, refreshToken: newRefreshToken, user } = await authService.refreshToken(refreshToken);

    // Set the NEW Refresh Token in Cookie to reset the 7-day clock
    sendTokenCookie(res, newRefreshToken);

    // Return new Access Token
    res.status(200).json({
        status: 'success',
        token: accessToken,
        data: { user }
    });
});

export const logout = (req: Request, res: Response) => {
    const isProduction = process.env.NODE_ENV === 'production';

    // Explicitly type the logout cookie options too
    const cookieOptions: CookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        expires: new Date(0)
    };

    // Clear the cookie by setting it to empty with immediate expiration
    res.cookie('refreshToken', '', cookieOptions);

    res.status(200).json({ status: 'success' });
};