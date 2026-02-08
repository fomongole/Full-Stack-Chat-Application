import { create } from 'zustand';
import { User } from '@/types';

interface ChatState {
    activeUser: User | null;
    // Allow 'null' to support closing chat on mobile
    setActiveUser: (user: User | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
    activeUser: null,
    setActiveUser: (user) => set({ activeUser: user }),
}));