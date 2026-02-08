'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { MessageSquare, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    api.get('/health')
        .then(() => setStatus('online'))
        .catch(() => setStatus('offline'));
  }, []);

  return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-black relative overflow-hidden">

        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>

        <div className="space-y-8 relative z-10 text-center max-w-2xl px-6">

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
              status === 'online' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' :
                  status === 'offline' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
          }`}>
            <span className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
            System Status: {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-black dark:text-white">
              Connect <span className="text-primary">Instantly</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
              Secure, real-time messaging for the modern enterprise. Powered by Socket.io and Next.js.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {user ? (
                <Link href="/chat">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-primary/25 transition-all">
                    Open Dashboard
                  </Button>
                </Link>
            ) : (
                <>
                  <Link href="/login">
                    <Button size="lg" className="h-14 px-8 rounded-full min-w-[140px]">
                      Login
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="outline" size="lg" className="h-14 px-8 rounded-full min-w-[140px] bg-white/50 backdrop-blur-sm dark:bg-black/50">
                      Register
                    </Button>
                  </Link>
                </>
            )}
          </div>

          {/* Feature Pills */}
          <div className="pt-12 flex flex-wrap justify-center gap-4 text-sm text-zinc-500 font-medium">
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800">
              <Zap className="w-4 h-4 text-yellow-500" /> Real-time
            </div>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800">
              <ShieldCheck className="w-4 h-4 text-green-500" /> End-to-End Encrypted
            </div>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800">
              <MessageSquare className="w-4 h-4 text-blue-500" /> Rich Media
            </div>
          </div>
        </div>
      </div>
  );
}