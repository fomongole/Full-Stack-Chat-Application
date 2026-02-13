'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatLastSeen } from '@/lib/formatTime';
import { User } from '@/types';
import { X, Lock, ShieldBan, ShieldCheck } from 'lucide-react';
import BlockModal from './BlockModal';
import { useUserBlock } from '@/hooks/user/useUserBlock';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

export default function UserProfileModal({ isOpen, onClose, user }: UserProfileModalProps) {
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);

    const { toggleBlockStatus, isLoading } = useUserBlock();

    if (!isOpen || !user) return null;

    const handleConfirmBlock = async () => {
        const success = await toggleBlockStatus(user);

        if (success) {
            setShowBlockConfirm(false);
            onClose();
        }
    };

    // Ensure we do not leak online presence if the user is private or blocked.
    const isBlocked = user.hasBlocked || user.isBlockedBy;
    const canShowStatus = !user.isPrivate && !isBlocked;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-zinc-200 dark:border-zinc-800 relative flex flex-col items-center">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Avatar Container */}
                    <div className="relative mb-5">
                        <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-zinc-50 dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-900 shadow-inner">
                            {user.image ? (
                                <img src={user.image} alt={user.username} className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-4xl font-bold text-zinc-300 dark:text-zinc-700">
                                    {user.username[0].toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* Status Dot */}
                        {/* ---> FIX: Respect privacy guard <--- */}
                        {user.isOnline && canShowStatus && (
                            <div className="absolute bottom-1 right-1 p-1 bg-white dark:bg-zinc-950 rounded-full">
                                <div className="w-5 h-5 bg-green-500 rounded-full animate-pulse border border-white dark:border-zinc-950"></div>
                            </div>
                        )}
                    </div>

                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">{user.username}</h2>

                    {/* Status Text */}
                    {/* ---> FIX: Respect privacy guard and fallback gracefully <--- */}
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-6 flex items-center gap-2">
                        {canShowStatus ? (
                            user.isOnline ? (
                                <span className="text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full text-xs">Active Now</span>
                            ) : (
                                <span>Last seen {formatLastSeen(user.lastSeen)}</span>
                            )
                        ) : (
                            <span className="italic text-xs opacity-70">Status hidden</span>
                        )}
                    </p>

                    {/* About Section */}
                    <div className="w-full bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl text-left mb-6 border border-zinc-100 dark:border-zinc-800/50">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            About
                        </h3>
                        {user.isPrivate ? (
                            <div className="flex items-center gap-2 text-zinc-500 italic text-sm">
                                <Lock className="w-4 h-4" />
                                <span>This profile is private</span>
                            </div>
                        ) : (
                            <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                                {user.about || "No bio available."}
                            </p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full flex gap-3">
                        <Button onClick={onClose} variant="secondary" className="flex-1">
                            Close
                        </Button>
                        <Button
                            onClick={() => setShowBlockConfirm(true)}
                            variant={user.hasBlocked ? 'secondary' : 'destructive'}
                            className={`flex-1 ${user.hasBlocked ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : ''}`}
                        >
                            {user.hasBlocked ? (
                                <><ShieldCheck className="w-4 h-4 mr-2" /> Unblock</>
                            ) : (
                                <><ShieldBan className="w-4 h-4 mr-2" /> Block</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal Layer */}
            <BlockModal
                isOpen={showBlockConfirm}
                onClose={() => setShowBlockConfirm(false)}
                onConfirm={handleConfirmBlock}
                username={user.username}
                isBlocked={!!user.hasBlocked}
                isLoading={isLoading}
            />
        </>
    );
}