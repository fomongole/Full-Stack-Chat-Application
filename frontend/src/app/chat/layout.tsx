'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useSocket } from '@/hooks/useSocket';
import { useChatList } from '@/hooks/chat/useChatList';
import { User } from '@/types';
import ChatSidebar from '@/components/chat/ChatSidebar';
import EditProfileModal from '@/components/modals/EditProfileModal';
import LogoutModal from '@/components/modals/LogoutModal';
import UserProfileModal from '@/components/modals/UserProfileModal';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
    const { users, isLoading } = useChatList();
    const activeUser = useChatStore((state) => state.activeUser);

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isLogoutOpen, setIsLogoutOpen] = useState(false);
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    const { logout } = useAuthStore();
    const router = useRouter();
    const socket = useSocket();

    const handleLogout = () => {
        logout();
        if (socket) socket.disconnect();
        router.replace('/login');
    };

    return (
        // Using 100dvh (Dynamic Viewport Height) to handle mobile browser bars correctly
        <div className="flex h-[100dvh] overflow-hidden bg-white dark:bg-black touch-none overscroll-none">
            {/* SIDEBAR */}
            <div className={`
                ${activeUser ? 'hidden md:flex' : 'flex'} 
                w-full md:w-[380px] flex-col bg-white dark:bg-[#111b21] z-20 border-r border-zinc-200 dark:border-zinc-800
            `}>
                <ChatSidebar
                    users={users}
                    isLoading={isLoading}
                    onProfileClick={() => setIsProfileOpen(true)}
                    onLogoutClick={() => setIsLogoutOpen(true)}
                    onViewUser={(user) => setViewingUser(user)}
                />
            </div>

            {/* MAIN CHAT AREA */}
            <main className={`
                ${activeUser ? 'flex' : 'hidden md:flex'} 
                flex-1 flex-col relative bg-[#efeae2] dark:bg-[#0b141a] w-full
            `}>
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]"></div>

                {children}
            </main>

            {/* Modals */}
            <EditProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
            <UserProfileModal isOpen={!!viewingUser} user={viewingUser} onClose={() => setViewingUser(null)} />
            <LogoutModal isOpen={isLogoutOpen} onClose={() => setIsLogoutOpen(false)} onConfirm={handleLogout} />
        </div>
    );
}