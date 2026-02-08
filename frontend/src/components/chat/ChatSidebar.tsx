import React, { useState } from 'react';
import { User } from '@/types';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarUserItem } from './sidebar/SidebarUserItem';
import { SidebarFooter } from './sidebar/SidebarFooter';

interface ChatSidebarProps {
    users: User[];
    isLoading?: boolean;
    onProfileClick: () => void;
    onLogoutClick: () => void;
    onViewUser: (user: User) => void;
}

export default function ChatSidebar({ users, isLoading, onProfileClick, onLogoutClick, onViewUser }: ChatSidebarProps) {
    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const selectedUser = useChatStore((state) => state.activeUser);
    const currentUser = useAuthStore((state) => state.user);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await api.get(`/users/search?q=${query}`);
            setSearchResults(response.data.data.users);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setIsSearching(false);
        }
    };

    const displayUsers = searchQuery ? searchResults : users;

    return (
        <aside className="w-full border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/10 h-full">
            <SidebarHeader onSearch={handleSearch} />

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2">
                    {searchQuery ? "Search Results" : "Direct Messages"}
                </p>

                {/* SKELETON LOADING STATE */}
                {isLoading && !searchQuery ? (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                            <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                                <div className="h-2 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                            </div>
                        </div>
                    ))
                ) : displayUsers.length === 0 ? (
                    <div className="text-center text-zinc-400 text-sm py-8">
                        {isSearching ? "Searching..." : "No users found"}
                    </div>
                ) : (
                    displayUsers.map((user) => (
                        <SidebarUserItem
                            key={user.id}
                            user={user}
                            isActive={selectedUser?.id === user.id}
                            onClick={() => {
                                setActiveUser(user);
                            }}
                            onViewProfile={onViewUser}
                        />
                    ))
                )}
            </div>

            <SidebarFooter
                currentUser={currentUser}
                onProfileClick={onProfileClick}
                onLogoutClick={onLogoutClick}
            />
        </aside>
    );
}