import React from 'react';
import { Search } from 'lucide-react';

interface SidebarHeaderProps {
    onSearch: (query: string) => void;
}

export function SidebarHeader({ onSearch }: SidebarHeaderProps) {
    return (
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
            <h2 className="text-xl font-bold text-primary">Chats</h2>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                    type="text"
                    placeholder="Search users..."
                    onChange={(e) => onSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-zinc-500"
                />
            </div>
        </div>
    );
}