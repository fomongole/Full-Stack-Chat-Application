import React, { memo } from 'react';
import { toast } from "sonner";
import { User } from '@/types';
import { formatLastSeen } from '@/lib/formatTime';
import { formatMessageTime } from '@/lib/dateUtils';

interface SidebarUserItemProps {
    user: User;
    isActive: boolean;
    onClick: () => void;
    onViewProfile: (user: User) => void;
}

export const SidebarUserItem = memo(function SidebarUserItem({ user, isActive, onClick, onViewProfile }: SidebarUserItemProps) {

    const isBlocked = user.hasBlocked || user.isBlockedBy;

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (user.isPrivate) {
            toast.error("Privacy Restricted");
            return;
        }
        onViewProfile(user);
    };

    // FIX ISSUE 2: Handle Backend Default Text for empty chats
    const getPreviewText = () => {
        if (user.isTyping && !isBlocked) {
            return <span className="font-bold text-primary animate-pulse">Typing...</span>;
        }

        if (user.lastMessage) {
            // Detect the backend "ghost" message for new chats
            if (user.lastMessage === "Media message" && !user.lastActivity) {
                return <span className="italic opacity-70">New conversation</span>;
            }
            return <span className="truncate block opacity-90">{user.lastMessage}</span>;
        }

        // Fallback status
        return (
            <span className="italic opacity-70">
                {user.isPrivate
                    ? "Private"
                    : (isBlocked
                            ? ""
                            : (user.isOnline ? "Online" : formatLastSeen(user.lastSeen))
                    )
                }
            </span>
        );
    };

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border border-transparent ${
                isActive
                    ? "bg-primary/10 border-primary/20"
                    : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300 active:scale-95"
            }`}
        >
            <div className="relative group/avatar shrink-0" onClick={handleAvatarClick}>
                {user.image ? (
                    <img
                        src={user.image}
                        alt={user.username}
                        className="h-12 w-12 rounded-full object-cover border-2 border-zinc-100 dark:border-zinc-700"
                    />
                ) : (
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                        isActive ? "border-primary/20 bg-primary/10 text-primary" : "border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    }`}>
                        {user.username[0].toUpperCase()}
                    </div>
                )}

                {user.isOnline && !user.isPrivate && !isBlocked && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full animate-pulse"></span>
                )}
            </div>

            <div className="text-left overflow-hidden flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                    <p className={`text-sm font-bold truncate pr-2 ${isActive ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-200"}`}>
                        {user.username}
                    </p>
                    {user.lastActivity && (
                        <span className={`text-[10px] shrink-0 font-medium ${isActive ? "text-primary" : "text-zinc-400"}`}>
                            {formatMessageTime(new Date(user.lastActivity).toISOString())}
                        </span>
                    )}
                </div>

                <div className="flex justify-between items-center gap-2">
                    <div className={`text-xs truncate flex-1 ${isActive ? "text-primary/80 font-medium" : "text-zinc-500"}`}>
                        {getPreviewText()}
                    </div>

                    {(user.unreadCount || 0) > 0 && !isActive && (
                        <span className="text-[10px] font-bold h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full shrink-0 bg-primary text-white shadow-sm shadow-primary/30 animate-in zoom-in duration-200">
                            {user.unreadCount! > 99 ? '99+' : user.unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
});