'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Download, Maximize2 } from 'lucide-react';

interface MediaAttachmentProps {
    url: string;
    type: 'IMAGE' | 'VIDEO';
    isLocal?: boolean;
}

// ----------------------------------------------------------------------
// Helper Component: Full Screen Portal
// Moved outside to prevent re-creation on every render
// ----------------------------------------------------------------------

interface FullScreenMediaProps {
    url: string;
    type: 'IMAGE' | 'VIDEO';
    onClose: () => void;
}

function FullScreenMedia({ url, type, onClose }: FullScreenMediaProps) {

    useEffect(() => {
        // Lock body scroll when open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `media-${Date.now()}.${type === 'VIDEO' ? 'mp4' : 'jpg'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed", error);
        }
    };

    // Safety check: ensure we are in a browser environment before accessing document.body
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300"
            onClick={onClose}
        >
            {/* Header Controls */}
            <div className="flex justify-between items-center p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
                <span className="text-white text-sm font-medium">Attachment</span>
                <div className="flex items-center gap-3">
                    <button onClick={handleDownload} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
                        <Download className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="p-2.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
                {type === 'VIDEO' ? (
                    <video
                        src={url}
                        controls
                        autoPlay
                        className="max-w-full max-h-[80vh] shadow-2xl rounded-lg"
                    />
                ) : (
                    <img src={url} alt="Full view" className="max-w-full max-h-[85vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300" />
                )}
            </div>
        </div>,
        document.body
    );
}

// ----------------------------------------------------------------------
// 📦 Main Component
// ----------------------------------------------------------------------

export function MediaAttachment({ url, type, isLocal }: MediaAttachmentProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    if (type === 'VIDEO') {
        return (
            <>
                <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-video group/video border border-zinc-800">
                    <video
                        src={url}
                        className="w-full h-full object-cover opacity-80"
                        onLoadedData={() => setIsLoading(false)}
                    />
                    <div
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                        className="absolute inset-0 flex items-center justify-center cursor-pointer group-hover/video:bg-black/20 transition-all z-10"
                    >
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/40 shadow-lg group-hover/video:scale-110 transition-transform">
                            <Play className="w-6 h-6 text-white fill-white ml-1" />
                        </div>
                    </div>
                </div>

                {/* Render separate component only when expanded */}
                {isExpanded && (
                    <FullScreenMedia
                        url={url}
                        type={type}
                        onClose={() => setIsExpanded(false)}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div
                onClick={(e) => { e.stopPropagation(); if (!isLocal) setIsExpanded(true); }}
                className={`relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer group/image border border-zinc-200 dark:border-zinc-800 ${isLoading ? 'min-h-[150px]' : ''}`}
            >
                <img
                    src={url}
                    alt="Attachment"
                    className={`w-full h-auto max-h-[400px] object-cover transition-all duration-500 ${isLoading ? 'scale-110 blur-xl grayscale' : 'scale-100'}`}
                    onLoad={() => setIsLoading(false)}
                />
                {isLocal && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
                {!isLoading && !isLocal && (
                    <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100">
                        <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                )}
            </div>

            {/* Render separate component only when expanded */}
            {isExpanded && (
                <FullScreenMedia
                    url={url}
                    type={type}
                    onClose={() => setIsExpanded(false)}
                />
            )}
        </>
    );
}