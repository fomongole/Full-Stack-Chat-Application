import React, { useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from '@/components/ui/Button';
import { Message } from '@/types';
import { toast } from 'sonner';
import { Image, Paperclip, Send, X } from 'lucide-react';

const MAX_MEDIA_SIZE_MB = 5;
const MAX_MEDIA_SIZE_BYTES = MAX_MEDIA_SIZE_MB * 1024 * 1024;

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
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Validate File Size immediately
        if (file.size > MAX_MEDIA_SIZE_BYTES) {
            toast.error(`File too large. Maximum size is ${MAX_MEDIA_SIZE_MB}MB.`);
            // Reset input so user can try again
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // 2. Validate Type (Safety check)
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            toast.error("Only images and videos are allowed.");
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));

        // Reset the input value so the same file can be selected again if needed (e.g. after clearing)
        e.target.value = '';
    };

    const clearFile = () => {
        setSelectedFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    if (isBlocked) {
        return (
            <footer className="p-4 bg-white dark:bg-zinc-950 text-center z-20 border-t border-zinc-200 dark:border-zinc-800">
                <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg text-zinc-500 text-sm">
                    You cannot send messages to this conversation.
                </div>
            </footer>
        );
    }

    return (
        <footer className="p-3 md:p-4 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900 z-20">
            {/* Reply Preview */}
            {replyTo && !selectedFile && (
                <div className="mb-2 mx-1 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg border-l-4 border-primary shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="text-sm overflow-hidden">
                        <span className="text-primary font-bold text-xs block mb-0.5">Replying to {replyTo.username}</span>
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs truncate block max-w-[200px] md:max-w-md">
                            {replyTo.messageType !== 'TEXT' ? '📷 Media' : replyTo.message}
                        </span>
                    </div>
                    <button onClick={onCancelReply} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>
            )}

            {/* File Preview */}
            {selectedFile && previewUrl && (
                <div className="mb-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="h-14 w-14 rounded-lg overflow-hidden bg-black/10 shrink-0 border border-zinc-200 dark:border-zinc-700">
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
                    <button onClick={clearFile} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-5xl mx-auto">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />

                {/* Attach Button */}
                <button
                    type="button"
                    disabled={isUploading || !!selectedFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 mb-1 text-zinc-500 hover:text-primary dark:text-zinc-400 dark:hover:text-primary transition-colors active:scale-95"
                    title="Attach file"
                >
                    {selectedFile ? <Image className="w-6 h-6" /> : <Paperclip className="w-6 h-6" />}
                </button>

                {/* Auto-Expanding Textarea */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-[24px] border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-700 focus-within:bg-white dark:focus-within:bg-zinc-900 transition-all flex items-center px-2 py-2">
                    <TextareaAutosize
                        minRows={1}
                        maxRows={5}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedFile ? "Add a caption..." : "Message"}
                        className="w-full resize-none bg-transparent border-none focus:ring-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-[15px] leading-6 max-h-[150px] px-3 py-0.5 scrollbar-hide"
                    />
                </div>

                {/* Send Button */}
                <Button
                    type="submit"
                    disabled={isUploading || (!value.trim() && !selectedFile)}
                    className="h-12 w-12 rounded-full p-0 flex items-center justify-center shrink-0 mb-0.5 bg-primary hover:bg-primary/90 transition-all shadow-md active:scale-95 text-white disabled:opacity-50 disabled:scale-100"
                >
                    {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Send className="w-5 h-5 ml-0.5" />
                    )}
                </Button>
            </form>
        </footer>
    );
}