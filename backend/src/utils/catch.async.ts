import { Request, Response, NextFunction } from 'express';

/**
 * Wraps async functions to catch errors automatically.
 * * - For Express: Passes errors to the global error handler via `next()`.
 * - For Sockets/Other: Logs the error safely if no `next` function exists.
 */
export const catchAsync = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Wrapped in Promise.resolve to handle both async and sync errors
        Promise.resolve(fn(req, res, next)).catch((err) => {
            // Check if the last argument is a 'next' function (Express style)
            if (typeof next === 'function') {
                next(err);
            } else {
                // Fallback for non-Express contexts (like Sockets)
                console.error("⚠️ Unhandled Async Error:", err);
            }
        });
    };
};