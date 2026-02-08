'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useLoginForm } from '@/hooks/auth/useLoginForm';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthField } from '@/components/auth/AuthField';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const { register, handleSubmit, errors, isSubmitting } = useLoginForm();
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="mx-auto w-full max-w-sm space-y-8 p-4">
            <AuthHeader
                title="Welcome back"
                subtitle="Enter your credentials to access your conversations"
            />

            <form onSubmit={handleSubmit} className="space-y-5">
                <AuthField
                    label="Email"
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    registration={register('email')}
                    error={errors.email}
                    startIcon={<Mail className="h-4 w-4" />}
                />

                <AuthField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    registration={register('password')}
                    error={errors.password}
                    startIcon={<Lock className="h-4 w-4" />}
                    endIcon={
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="focus:outline-none hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    }
                />

                <Button type="submit" className="w-full h-11" isLoading={isSubmitting}>
                    Sign In
                </Button>
            </form>

            <div className="text-center text-sm text-zinc-500">
                Don&#39;t have an account?{' '}
                <Link href="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                    Create account
                </Link>
            </div>
        </div>
    );
}