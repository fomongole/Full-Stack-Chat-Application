'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useRegisterForm } from '@/hooks/auth/useRegisterForm';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthField } from '@/components/auth/AuthField';
import { Mail, Lock, User, Eye, EyeOff, Check, X } from 'lucide-react';

export default function RegisterPage() {
    const { register, handleSubmit, errors, isSubmitting, watch } = useRegisterForm();
    const [showPassword, setShowPassword] = useState(false);

    const passwordValue = watch('password') || "";

    return (
        <div className="mx-auto w-full max-w-sm space-y-8 p-4">
            <AuthHeader
                title="Create an account"
                subtitle="Enter your details below to set up your chat profile"
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
                    label="Username"
                    optionalLabel="(Optional)"
                    type="text"
                    placeholder="johndoe"
                    registration={register('username')}
                    error={errors.username}
                    startIcon={<User className="h-4 w-4" />}
                />

                {/* Password Field Wrapper */}
                <div className="space-y-3">
                    <AuthField
                        label="Password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
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

                    {/* Strength Meter*/}
                    <PasswordStrengthMeter password={passwordValue} />
                </div>

                <Button type="submit" className="w-full h-11" isLoading={isSubmitting}>
                    Create Account
                </Button>
            </form>

            <div className="text-center text-sm text-zinc-500">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                    Log in
                </Link>
            </div>
        </div>
    );
}

// --- SUB-COMPONENT: Password Strength Meter ---
function PasswordStrengthMeter({ password }: { password: string }) {
    // Requirements Logic
    const requirements = [
        { label: "At least 8 characters", met: password.length >= 8 },
        { label: "Contains number", met: /[0-9]/.test(password) },
        { label: "Contains uppercase", met: /[A-Z]/.test(password) },
        { label: "Contains special char", met: /[^A-Za-z0-9]/.test(password) },
    ];

    // Calculate Score (0 to 4)
    const strength = requirements.filter((r) => r.met).length;

    // Color Logic
    const getColor = (score: number) => {
        if (score === 0) return "bg-zinc-200 dark:bg-zinc-800";
        if (score <= 2) return "bg-red-500";
        if (score === 3) return "bg-yellow-500";
        return "bg-green-500";
    };

    // Text Logic
    const getLabel = (score: number) => {
        if (score === 0) return "Enter password";
        if (score <= 2) return "Weak";
        if (score === 3) return "Medium";
        return "Strong";
    };

    if (!password) return null;

    return (
        <div className="space-y-3 pt-1 animate-in slide-in-from-top-2 fade-in duration-300">
            {/* Bars */}
            <div className="flex gap-1.5 h-1.5 w-full">
                {[1, 2, 3, 4].map((level) => (
                    <div
                        key={level}
                        className={`h-full flex-1 rounded-full transition-all duration-500 ${
                            strength >= level ? getColor(strength) : "bg-zinc-200 dark:bg-zinc-800"
                        }`}
                    />
                ))}
            </div>

            {/* Label & List */}
            <div className="space-y-2">
                <p className={`text-xs font-semibold text-right transition-colors ${
                    strength <= 2 ? "text-red-500" : strength === 3 ? "text-yellow-500" : "text-green-500"
                }`}>
                    {getLabel(strength)}
                </p>

                <div className="grid grid-cols-2 gap-2">
                    {requirements.map((req, i) => (
                        <div key={i} className={`flex items-center gap-1.5 text-xs transition-colors duration-300 ${req.met ? "text-green-600 dark:text-green-400" : "text-zinc-400"}`}>
                            {req.met ? (
                                <Check className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                                <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-1.5" />
                            )}
                            {req.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}