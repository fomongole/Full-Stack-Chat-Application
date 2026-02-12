import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Singleton Axios instance for the application.
 * Configured with base URL and credentials for secure cookie handling.
 */
export const api = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    withCredentials: true, // Essential for sending/receiving HttpOnly cookies
});

// -----------------------------------------------------------------------------
// Request Interceptor
// -----------------------------------------------------------------------------

/**
 * Automatically attaches the Authorization header to every outgoing request
 * if a valid access token exists in the Zustand store.
 */
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().token;
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// -----------------------------------------------------------------------------
// Response Interceptor & Refresh Logic
// -----------------------------------------------------------------------------

/**
 * Queue to hold requests that fail due to 401 (Expired Token)
 * while a token refresh is already in progress.
 */
interface FailedRequest {
    resolve: (token: string) => void;
    reject: (error: Error) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

/**
 * Processes the queue of failed requests.
 * @param error - If the refresh failed, this error is passed to all queued requests.
 * @param token - If the refresh succeeded, this new token is passed to retry the requests.
 */
const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else if (token) {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

/**
 * Response Interceptor.
 * Handles global error responses, specifically 401 Unauthorized.
 * Implements "Silent Refresh" strategy:
 * 1. Catches 401 errors.
 * 2. Pauses the failed request.
 * 3. Attempts to refresh the token via HttpOnly cookie.
 * 4. Retries the failed request with the new token.
 */
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Check if error is 401 and avoid infinite loops by checking _retry flag
        if (error.response?.status === 401 && !originalRequest._retry) {

            // EDGE CASE: Login/Register endpoints
            // If the user doesn't have a token yet, this is a standard "Invalid Credentials" error.
            if (!useAuthStore.getState().token) {
                return Promise.reject(error);
            }

            // Mark request as retried to prevent infinite loops
            originalRequest._retry = true;

            // If a refresh is already in progress, queue this request
            if (isRefreshing) {
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                        }
                        return api(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            // Start the refresh process
            isRefreshing = true;

            try {
                // Call backend to refresh token (Cookie is sent automatically)
                // We use a fresh axios call to avoid circular dependency
                const { data } = await axios.post(
                    `${BASE_URL}/api/v1/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                const newToken = data.token;

                // Update client state
                useAuthStore.getState().setAuth(data.data.user, newToken);

                // Update default headers for future requests
                api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

                // Update specific failed request
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                }

                // Process any other requests that failed while we were refreshing
                processQueue(null, newToken);
                isRefreshing = false;

                // Retry the original request
                return api(originalRequest);

            } catch (refreshError) {
                // Refresh failed (Session completely expired)
                processQueue(refreshError as Error, null);
                isRefreshing = false;

                // UX: Only show toast if it wasn't a background health check
                if (!originalRequest.url?.includes('/health')) {
                    toast.error("Session expired. Please log in again.");
                }

                // Force logout to clean state and redirect
                useAuthStore.getState().logout();

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);