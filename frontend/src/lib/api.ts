import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    withCredentials: true
});

// Inject token into every request automatically
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});