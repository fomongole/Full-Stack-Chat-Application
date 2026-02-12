import React from 'react';
import { User } from '@/types';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserSearch } from '@/hooks/chat/sidebar/useUserSearch';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarUserItem } from './sidebar/SidebarUserItem';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { UserPlus, Search, AlertCircle, RefreshCcw } from 'lucide-react';

interface ChatSidebarProps {
    users: User[];
    isLoading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    onProfileClick: () => void;
    onLogoutClick: () => void;
    onViewUser: (user: User) => void;
}

/**
 * Refactored ChatSidebar component.
 */
export default function ChatSidebar({
                                        users,
                                        isLoading,
                                        error,
                                        onRetry,
                                        onProfileClick,
                                        onLogoutClick,
                                        onViewUser,
                                    }: ChatSidebarProps) {
    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const selectedUser = useChatStore((state) => state.activeUser);
    const currentUser = useAuthStore((state) => state.user);

    // Search functionality extracted to hook
    const { searchQuery, searchResults, isSearching, handleSearch } = useUserSearch();

    // Display search results or regular user list
    const displayUsers = searchQuery ? searchResults : users;

    return (
        <aside className="w-full border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/10 h-full">
            <SidebarHeader onSearch={handleSearch} />

            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2">
                    {searchQuery ? 'Search Results' : 'Direct Messages'}
                </p>

                {/* ERROR STATE - PRIORITIZED */}
                {error ? (
                    <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4 text-center">
                        <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full mb-3">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <p className="text-sm text-zinc-500 mb-4">{error}</p>
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                            >
                                <RefreshCcw className="w-3 h-3" />
                                Retry
                            </button>
                        )}
                    </div>
                ) : isLoading && !searchQuery ? (
                    /* LOADING STATE */
                    [...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-xl animate-pulse"
                        >
                            <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                                <div className="h-2 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                            </div>
                        </div>
                    ))
                ) : displayUsers.length === 0 ? (
                    <EmptyState searchQuery={searchQuery} isSearching={isSearching} />
                ) : (
                    displayUsers.map((user) => (
                        <SidebarUserItem
                            key={user.id}
                            user={user}
                            isActive={selectedUser?.id === user.id}
                            onClick={() => setActiveUser(user)}
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

/**
 * Empty state component
 */
function EmptyState({
                        searchQuery,
                        isSearching,
                    }: {
    searchQuery: string;
    isSearching: boolean;
}) {
    if (isSearching) {
        return (
            <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                <p className="text-sm text-zinc-500 mt-3">Searching...</p>
            </div>
        );
    }

    if (searchQuery) {
        return (
            <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4 text-center opacity-70">
                <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                    <div className="bg-zinc-100 dark:bg-zinc-800/50 p-3 rounded-full inline-block">
                        <Search className="w-6 h-6 text-zinc-400" />
                    </div>
                    <p className="text-sm text-zinc-500">
                        No users found for{' '}
                        <span className="font-semibold">&#34;{searchQuery}&#34;</span>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4 text-center">
            <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="p-4 bg-primary/10 dark:bg-primary/20 rounded-full">
                    <UserPlus className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                        Start a Conversation
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed mx-auto">
                        Your inbox is empty. Search for colleagues above to start chatting.
                    </p>
                </div>
            </div>
        </div>
    );
}