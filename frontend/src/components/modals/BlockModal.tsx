'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface BlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    username: string;
    isBlocked: boolean;
    isLoading?: boolean;
}

export default function BlockModal({ isOpen, onClose, onConfirm, username, isBlocked, isLoading }: BlockModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-full max-w-sm shadow-xl border border-zinc-200 dark:border-zinc-800 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center">
                    {/* Icon Circle */}
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 ${
                        isBlocked
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            : "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500"
                    }`}>
                        {isBlocked ? (
                            // Unlock Icon
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                        ) : (
                            // Block Icon
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        )}
                    </div>

                    <h2 className="text-lg font-bold mb-2">
                        {isBlocked ? `Unblock ${username}?` : `Block ${username}?`}
                    </h2>

                    <p className="text-sm text-zinc-500 mb-6">
                        {isBlocked
                            ? "They will be able to send you messages and see your status again."
                            : "Are you sure? They won't be able to message you or see your online status."
                        }
                    </p>

                    <div className="flex gap-3 w-full">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex-1 text-white ${
                                isBlocked
                                    ? "bg-zinc-700 hover:bg-zinc-600"
                                    : "bg-red-600 hover:bg-red-700"
                            }`}
                        >
                            {isLoading ? 'Processing...' : (isBlocked ? 'Unblock' : 'Block User')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}