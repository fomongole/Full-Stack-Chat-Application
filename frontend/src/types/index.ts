export interface User {
    id: string;
    username: string;
    image?: string;
    about?: string;
    isOnline: boolean;
    lastSeen?: string;
    isPrivate?: boolean;
    isTyping?: boolean; // For UI use only
    unreadCount?: number;

    // For Sidebar Sorting and Preview
    lastMessage?: string;
    lastActivity?: string | Date;

    // Blocking System
    hasBlocked?: boolean;   // Did I block them?
    isBlockedBy?: boolean;  // Did they block me?
}

export interface Message {
    id: string;
    conversationId: string;
    authorId: string;
    username: string;
    image?: string;

    // Content
    message: string;
    content?: string;

    // Media Support
    messageType?: 'TEXT' | 'IMAGE' | 'VIDEO';
    attachmentUrl?: string;

    // Status
    isDeleted: boolean;
    isRead: boolean;
    timestamp: string;

    // Reply Data
    replyTo?: {
        id: string;
        username: string;
        content: string;
        messageType?: 'TEXT' | 'IMAGE' | 'VIDEO';
        attachmentUrl?: string;
    } | null;
}