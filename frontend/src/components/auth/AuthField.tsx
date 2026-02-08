import React from 'react';
import { Input } from '@/components/ui/Input';
import { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    registration: UseFormRegisterReturn;
    error?: FieldError;
    optionalLabel?: string;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
}

export function AuthField({ label, registration, error, optionalLabel, className, startIcon, endIcon, ...props }: AuthFieldProps) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-baseline">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {label}
                </label>
                {optionalLabel && <span className="text-xs text-zinc-400 font-normal">{optionalLabel}</span>}
            </div>

            <Input
                {...registration}
                {...props}
                startIcon={startIcon}
                endIcon={endIcon}
                className={`${error ? "border-red-500 focus-visible:ring-red-500 bg-red-50 dark:bg-red-900/10" : ""} ${className || ""}`}
            />

            {error && (
                <p className="text-xs font-medium text-red-500 flex items-center gap-1 animate-in slide-in-from-left-1">
                    {error.message}
                </p>
            )}
        </div>
    );
}