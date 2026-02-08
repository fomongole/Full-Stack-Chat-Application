import React from 'react';
import { MessageSquare, Terminal } from 'lucide-react';

export function AuthBranding() {
    return (
        <div className="relative w-full h-full flex flex-col justify-between p-12 lg:p-16">

            {/* Background Effects */}
            <div className="absolute inset-0 bg-zinc-900">
                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                {/* Glow Effect  */}
                <div className="absolute right-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-primary/20 opacity-20 blur-[120px]"></div>
            </div>

            {/* Top: Branding / Logo */}
            <div className="relative z-10 flex items-center gap-2 font-bold text-xl tracking-tight text-white">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                    <MessageSquare className="w-5 h-5 text-white fill-white/20" />
                </div>
                <span>Enterprise Chat</span>
            </div>

            {/* Bottom: Developer Statement */}
            <div className="relative z-10 max-w-lg space-y-8">

                {/* Technical Highlight */}
                <blockquote className="text-lg md:text-xl font-medium leading-relaxed text-zinc-200">
                    &ldquo;This application demonstrates a production-grade full stack architecture. From handling secure real-time WebSocket connections to optimizing database queries, every component is built to scale.&rdquo;
                </blockquote>

                {/* Developer Profile */}
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600 flex items-center justify-center shadow-sm relative group">
                        <Terminal className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                    </div>
                    <div>
                        <div className="font-bold text-white text-base">Engineer Fred</div>
                        <div className="text-sm text-zinc-400 font-medium flex items-center gap-2">
                            Full Stack JavaScript Developer
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}