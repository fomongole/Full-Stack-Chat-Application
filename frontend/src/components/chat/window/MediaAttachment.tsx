import React, { useState, useRef } from 'react';
import { X, Play, Download, Maximize2 } from 'lucide-react';

interface MediaAttachmentProps {
    url: string;
    type: 'IMAGE' | 'VIDEO';
    isLocal?: boolean;
}

export function MediaAttachment({ url, type, isLocal }: MediaAttachmentProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevents bubbling to container
        e.preventDefault();
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `attachment-${Date.now()}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed", error);
        }
    };

    // --- VIDEO HANDLER ---
    if (type === 'VIDEO') {
        const handlePlayClick = () => {
            if (videoRef.current) {
                if (videoRef.current.paused) {
                    videoRef.current.play();
                    setIsPlaying(true);
                } else {
                    videoRef.current.pause();
                    setIsPlaying(false);
                }
            }
        };
        return (
            <div className="relative rounded-lg overflow-hidden bg-black max-w-sm w-full aspect-video group/video border border-zinc-200 dark:border-zinc-800">
                <video
                    ref={videoRef}
                    src={url}
                    controls={isPlaying} // Only show native controls when playing
                    className="w-full h-full object-contain"
                    onLoadedData={() => setIsLoading(false)}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                />
                {!isPlaying && !isLoading && !isLocal && (
                    <div
                        onClick={handlePlayClick}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-all cursor-pointer"
                    >
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/40 shadow-lg group-hover/video:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-white fill-white ml-1" />
                        </div>
                    </div>
                )}
                {(isLoading || isLocal) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        );
    }

    // --- IMAGE HANDLER ---
    return (
        <>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isLocal) setIsExpanded(true);
                }}
                className={`
                    relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 
                    cursor-pointer group/image border border-zinc-200 dark:border-zinc-800
                    ${isLoading ? 'min-h-[200px]' : ''}
                `}
            >
                <img
                    src={url}
                    alt="Attachment"
                    className={`
                        w-full h-auto max-h-[400px] object-cover rounded-lg
                        transition-all duration-500 ease-in-out
                        ${isLoading ? 'scale-110 blur-xl grayscale' : 'scale-100 blur-0 grayscale-0'}
                    `}
                    onLoad={() => setIsLoading(false)}
                    loading="lazy"
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

            {/* Lightbox Modal - FIXED: High Z-index, Propagation Handling */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                    }}
                >
                    {/* Toolbar - FIXED: High Z-index, Absolute positioning */}
                    <div
                        className="absolute top-6 right-6 flex gap-4 z-[110]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={handleDownload}
                            className="p-3 bg-white/10 hover:bg-white/20 text-white/90 hover:text-white rounded-full transition-all backdrop-blur-md border border-white/10"
                            title="Download"
                        >
                            <Download className="w-6 h-6" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(false);
                            }}
                            className="p-3 bg-white/10 hover:bg-red-500/40 text-white/90 hover:text-white rounded-full transition-all backdrop-blur-md border border-white/10"
                            title="Close"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <img
                        src={url}
                        alt="Full size"
                        className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}