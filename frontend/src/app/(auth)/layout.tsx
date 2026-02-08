'use client';
import React from 'react';
import Link from 'next/link';
import { AuthBranding } from '@/components/auth/AuthBranding';
import { ArrowLeft } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen w-full bg-white dark:bg-zinc-950">
            {/* Left Side: Form Container */}
            <div className="relative flex w-full flex-col justify-center px-8 lg:w-1/2 xl:px-24 py-12">

                {/* Floating Back Button */}
                <Link
                    href="/"
                    className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    Back
                </Link>

                {/* Centered Content Wrapper */}
                <div className="mx-auto w-full max-w-sm">
                    {children}
                </div>
            </div>

            {/* Right Side: Branding Visuals (Hidden on Mobile) */}
            <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 relative overflow-hidden text-white">
                <AuthBranding />
            </div>
        </div>
    );
}