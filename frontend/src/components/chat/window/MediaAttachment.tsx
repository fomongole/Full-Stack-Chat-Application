'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Download, Maximize2, Pause } from 'lucide-react';

interface MediaAttachmentProps {
    url: string;
    type: 'IMAGE' | 'VIDEO';
    isLocal?: boolean;
}

export function MediaAttachment({ url, type, isLocal }: MediaAttachmentProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [mounted, setMounted] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const expandedVideoRef = useRef<HTMLVideoElement>(null);

    // Hydration fix for Portal
    useEffect(() => {
        setMounted(true);
    }, []);

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `attachment-${Date.now()}.${type === 'VIDEO' ? 'mp4' : 'jpg'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed", error);
        }
    };

    const toggleVideo = (e: React.MouseEvent) => {
        e.stopPropagation();
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

    const toggleExpandedVideo = () => {
        if (expandedVideoRef.current) {
            if (expandedVideoRef.current.paused) {
                expandedVideoRef.current.play();
                setIsPlaying(true);
            } else {
                expandedVideoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    // Sync play state between inline and expanded
    useEffect(() => {
        if (isExpanded && videoRef.current && expandedVideoRef.current) {
            expandedVideoRef.current.currentTime = videoRef.current.currentTime;
            if (isPlaying) {
                expandedVideoRef.current.play();
            } else {
                expandedVideoRef.current.pause();
            }
        }
    }, [isExpanded, isPlaying]);

    // --- RENDER VIDEO THUMBNAIL ---
    if (type === 'VIDEO') {
        return (
            <>
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isLocal) setIsExpanded(true);
                    }}
                    className="relative rounded-lg overflow-hidden bg-black max-w-sm w-full aspect-video group/video border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                >
                    <video
                        ref={videoRef}
                        src={url}
                        className="w-full h-full object-contain"
                        onLoadedData={() => setIsLoading(false)}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        playsInline
                        controls={false} // Hide default controls for inline
                    />
                    {!isPlaying && !isLoading && !isLocal && (
                        <div
                            onClick={toggleVideo}
                            className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-all cursor-pointer z-10"
                        >
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/40 shadow-lg group-hover/video:scale-110 transition-transform">
                                <Play className="w-5 h-5 text-white fill-white ml-1" />
                            </div>
                        </div>
                    )}
                    {!isLoading && !isLocal && (
                        <div className="absolute inset-0 bg-black/0 group-hover/video:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/video:opacity-100">
                            <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                    )}
                </div>

                {isExpanded && mounted && createPortal(
                    <div
                        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200 touch-none"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(false);
                        }}
                    >
                        {/* TOOLBAR - Explicit High Z-Index */}
                        <div
                            className="absolute top-0 left-0 right-0 p-4 flex justify-end gap-4 z-[10000]"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking toolbar area
                        >
                            <button
                                onClick={handleDownload}
                                className="p-3 bg-white/10 hover:bg-white/20 text-white/90 hover:text-white rounded-full transition-all backdrop-blur-md border border-white/10 shadow-lg"
                                title="Download"
                            >
                                <Download className="w-6 h-6" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsExpanded(false);
                                }}
                                className="p-3 bg-white/10 hover:bg-red-500/80 text-white/90 hover:text-white rounded-full transition-all backdrop-blur-md border border-white/10 shadow-lg"
                                title="Close"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* VIDEO */}
                        <div
                            className="relative w-full h-full flex items-center justify-center p-4 md:p-10"
                            onClick={(e) => e.stopPropagation()} // Prevent close on video click
                        >
                            <video
                                ref={expandedVideoRef}
                                src={url}
                                className="max-w-full max-h-full object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-300"
                                autoPlay={isPlaying}
                                loop
                                controls // Show full controls in expanded view
                                onPause={() => setIsPlaying(false)}
                                onPlay={() => setIsPlaying(true)}
                            />
                            {!isPlaying && (
                                <button
                                    onClick={toggleExpandedVideo}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity hover:bg-black/50"
                                >
                                    <Play className="w-16 h-16 text-white" />
                                </button>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
            </>
        );
    }

    // --- FULL SCREEN MODAL (PORTAL) FOR IMAGE ---
    // This renders outside the Chat DOM tree, directly into document.body
    const FullScreenModal = () => {
        if (!mounted) return null;

        return createPortal(
            <div
                className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200 touch-none"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                }}
            >
                {/* TOOLBAR - Explicit High Z-Index */}
                <div
                    className="absolute top-0 left-0 right-0 p-4 flex justify-end gap-4 z-[10000]"
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking toolbar area
                >
                    <button
                        onClick={handleDownload}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white/90 hover:text-white rounded-full transition-all backdrop-blur-md border border-white/10 shadow-lg"
                        title="Download"
                    >
                        <Download className="w-6 h-6" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(false);
                        }}
                        className="p-3 bg-white/10 hover:bg-red-500/80 text-white/90 hover:text-white rounded-full transition-all backdrop-blur-md border border-white/10 shadow-lg"
                        title="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* IMAGE */}
                <div
                    className="relative w-full h-full flex items-center justify-center p-4 md:p-10"
                    onClick={(e) => e.stopPropagation()} // Prevent close on image click
                >
                    <img
                        src={url}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-300"
                    />
                </div>
            </div>,
            document.body
        );
    };

    // --- IMAGE THUMBNAIL (IN CHAT) ---
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

            {isExpanded && <FullScreenModal />}
        </>
    );
}