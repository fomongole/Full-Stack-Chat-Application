import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export function Button({
                           className,
                           variant = 'primary',
                           size = 'md',
                           isLoading = false,
                           children,
                           disabled,
                           ...props
                       }: ButtonProps) {

    const variants = {
        primary: "bg-primary text-white hover:bg-primary/90 shadow-sm border-transparent",
        outline: "border border-zinc-200 bg-transparent hover:bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-100",
        ghost: "bg-transparent hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
        secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 p-0 flex items-center justify-center"
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95",
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
}