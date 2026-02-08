'use client';
import React, { useRef, useState, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '@/components/ui/Button';
import { Message } from '@/types';
import { toast } from 'sonner';
import { Image, Paperclip, Send, X } from 'lucide-react';

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: (e: React.FormEvent) => void;
    recipientName: string;
    replyTo: Message | null;
    onCancelReply: () => void;
    isBlocked?: boolean;
    onUploadMedia?: (file: File, caption: string) => Promise<void>;
}

export function ChatInput({ value, onChange, onSend, replyTo, onCancelReply, isBlocked, onUploadMedia }: ChatInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Auto-focus on reply
    useEffect(() => {
        if (replyTo && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [replyTo]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            toast.error("File is too large (max 10MB)");
            return;
        }
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        e.target.value = '';
    };

    const clearFile = () => {
        setSelectedFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isUploading) return;

        if (selectedFile && onUploadMedia) {
            setIsUploading(true);
            try {
                await onUploadMedia(selectedFile, value);
                clearFile();
                onChange('');
            } catch (error) {
                toast.error("Failed to upload media");
            } finally {
                setIsUploading(false);
            }
        } else {
            onSend(e);
        }
    };

    if (isBlocked) {
        return (
            <footer className="p-4 bg-zinc-50 dark:bg-zinc-950 text-center border-t border-zinc-200 dark:border-zinc-800">
                <div className="bg-zinc-100 dark:bg-zinc-900 py-2 px-4 rounded-full text-zinc-500 text-xs inline-block">
                    You cannot reply to this conversation.
                </div>
            </footer>
        );
    }

    return (
        <footer className="p-3 md:p-4 bg-white dark:bg-[#111b21] border-t border-zinc-100 dark:border-zinc-800 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
            {/* REPLY BAR */}
            {replyTo && !replyTo.isDeleted && (
                <div className="mb-2 mx-1 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-xl border-l-4 border-primary shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="text-sm overflow-hidden">
                        <span className="text-primary font-bold text-[11px] block mb-0.5 uppercase tracking-wider">Replying to {replyTo.username}</span>
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs truncate block max-w-md">
                            {replyTo.messageType !== 'TEXT' ? '📷 Media Attachment' : replyTo.message}
                        </span>
                    </div>
                    <button onClick={onCancelReply} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>
            )}

            {/* PREVIEW BAR */}
            {selectedFile && previewUrl && (
                <div className="mb-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 animate-in fade-in">
                    <div className="h-16 w-16 rounded-lg overflow-hidden bg-black/10 shrink-0 border border-zinc-200 dark:border-zinc-700">
                        {selectedFile.type.startsWith('video/') ? (
                            <video src={previewUrl} className="h-full w-full object-cover" />
                        ) : (
                            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-zinc-700 dark:text-zinc-200">{selectedFile.name}</p>
                        <p className="text-xs text-zinc-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={clearFile} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-6xl mx-auto">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />

                <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 mb-0.5 text-zinc-500 hover:text-primary transition-all active:scale-90"
                >
                    <Paperclip className="w-6 h-6" />
                </button>

                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-[24px] border border-transparent transition-all flex items-center px-4 py-2">
                    <TextareaAutosize
                        ref={textareaRef as any}
                        minRows={1}
                        maxRows={6}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder={selectedFile ? "Add a caption..." : "Type a message"}
                        className="w-full resize-none bg-transparent border-none focus:ring-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-[16px] leading-6 scrollbar-hide outline-none"
                    />
                </div>

                <Button
                    type="submit"
                    disabled={isUploading || (!value.trim() && !selectedFile)}
                    className="h-12 w-12 rounded-full p-0 flex items-center justify-center shrink-0 mb-0.5 bg-primary hover:bg-primary/90 text-white shadow-lg active:scale-90 transition-transform disabled:opacity-50"
                >
                    {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Send className="w-5 h-5 ml-1" />
                    )}
                </Button>
            </form>
        </footer>
    );
}