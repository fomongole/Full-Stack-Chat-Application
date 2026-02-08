import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

// 1. Use the Environment Variable we set in Vercel
// 2. Fallback to localhost for development
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
    baseURL: `${BASE_URL}/api/v1`, // Ensure /api/v1 is appended correctly
    withCredentials: true // Crucial for cookies if you use them
});

// Inject token into every request automatically
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});