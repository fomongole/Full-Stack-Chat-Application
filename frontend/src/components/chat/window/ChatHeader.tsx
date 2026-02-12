import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { User } from '@/types';
import { formatLastSeen } from '@/lib/formatTime';
import { useChatStore } from '@/store/useChatStore';
import BlockModal from '@/components/modals/BlockModal';
import UserProfileModal from '@/components/modals/UserProfileModal';
import { ArrowLeft, MoreVertical, Ban, Lock, Phone, Video } from 'lucide-react';
import { useUserBlock } from '@/hooks/user/useUserBlock';

interface ChatHeaderProps {
    user: User;
    isTyping: boolean;
}

export function ChatHeader({ user, isTyping }: ChatHeaderProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const { toggleBlockStatus, isLoading } = useUserBlock();

    const setActiveUser = useChatStore((state) => state.setActiveUser);
    const menuRef = useRef<HTMLDivElement>(null);

    const isBlocked = user.hasBlocked || user.isBlockedBy;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleBlockAction = async () => {
        const success = await toggleBlockStatus(user);

        // Only close menus if the API call succeeded
        if (success) {
            setIsBlockModalOpen(false);
            setIsMenuOpen(false);
        }
    };

    const handleCallFeature = (type: 'Audio' | 'Video') => {
        toast.info(`${type} calling is coming soon!`, {
            description: "Ngenda kusaba obe mukakamu!😀",
            duration: 3000,
        });
    };

    return (
        <>
            <header className="px-3 md:px-4 py-2 border-b border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between bg-[#f0f2f5]/90 dark:bg-[#202c33]/90 backdrop-blur-md sticky top-0 z-30 h-[60px]">

                {/* LEFT: Back Button + User Info */}
                <div className="flex items-center gap-1 md:gap-2 min-w-0 flex-1">
                    {/* MOBILE BACK BUTTON */}
                    <button
                        onClick={() => setActiveUser(null)}
                        className="md:hidden p-1.5 -ml-1 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    {/* CLICKABLE USER INFO -> Opens Profile Modal */}
                    <div
                        className="flex items-center gap-2 md:gap-3 cursor-pointer group p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-0"
                        onClick={() => setIsProfileOpen(true)}
                    >
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-300 font-bold border border-zinc-100 dark:border-zinc-700 relative shrink-0">
                            {user.image && !isBlocked ? (
                                <img src={user.image} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-xs md:text-base">{user.username[0].toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm md:text-[15px] leading-tight flex items-center gap-1.5 group-hover:underline decoration-zinc-400 underline-offset-2 truncate">
                                <span className="truncate">{user.username}</span>
                                {user.isPrivate && <Lock className="w-3 h-3 text-zinc-400 shrink-0" />}
                            </h3>

                            {!isBlocked && !user.isPrivate && (
                                <>
                                    {isTyping ? (
                                        <span className="text-xs text-primary font-bold animate-pulse truncate">typing...</span>
                                    ) : user.isOnline ? (
                                        <span className="text-[10px] md:text-xs text-green-500 font-medium flex items-center gap-1 truncate">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span> Online
                                        </span>
                                    ) : (
                                        <span className="text-[10px] md:text-xs text-zinc-500 truncate">{formatLastSeen(user.lastSeen)}</span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Calls + Menu */}
                <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                    {!isBlocked && (
                        <>
                            <button
                                onClick={() => handleCallFeature('Audio')}
                                className="p-2 md:p-2.5 rounded-full text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-primary transition-all active:scale-95"
                                title="Voice Call"
                            >
                                <Phone className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                            <button
                                onClick={() => handleCallFeature('Video')}
                                className="p-2 md:p-2.5 rounded-full text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-primary transition-all active:scale-95"
                                title="Video Call"
                            >
                                <Video className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                            <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-0.5 md:mx-1"></div>
                        </>
                    )}

                    {/* Options Menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 md:p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 transition-colors"
                        >
                            <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#2a3942] rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <button
                                    onClick={() => {
                                        setIsProfileOpen(true);
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <div className="w-5 flex justify-center"><UserIconSmall /></div>
                                    View Profile
                                </button>

                                <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1"></div>

                                <button
                                    onClick={() => setIsBlockModalOpen(true)}
                                    className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors ${
                                        user.hasBlocked
                                            ? "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/5"
                                            : "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                    }`}
                                >
                                    <div className="w-5 flex justify-center"><Ban className="w-4 h-4" /></div>
                                    {user.hasBlocked ? 'Unblock User' : 'Block User'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Modals */}
            <BlockModal
                isOpen={isBlockModalOpen}
                onClose={() => setIsBlockModalOpen(false)}
                onConfirm={handleBlockAction}
                username={user.username}
                isBlocked={!!user.hasBlocked}
                isLoading={isLoading}
            />

            <UserProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                user={user}
            />
        </>
    );
}

function UserIconSmall() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    )
}