import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import { Toaster } from "sonner";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Chat App",
    description: "Secure, real-time communication platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50`}>
        <ThemeProvider>
            <ThemeInitializer />
            <AuthProvider>
                <SocketProvider>
                    {children}
                    <Toaster position="top-right" richColors closeButton />
                </SocketProvider>
            </AuthProvider>
        </ThemeProvider>
        </body>
        </html>
    );
}