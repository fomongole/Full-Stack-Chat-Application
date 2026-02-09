import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from "sonner";
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { registerSchema, type RegisterValues } from '@/validators/auth.validator';

export const useRegisterForm = () => {
    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const form = useForm<RegisterValues>({
        resolver: zodResolver(registerSchema),
        mode: "onChange",
        defaultValues: {
            email: '',
            username: '',
            password: '',
        }
    });

    const onSubmit = async (data: RegisterValues) => {
        const registerPromise = api.post('/auth/register', {
            ...data,
            username: data.username === '' ? undefined : data.username,
        });

        toast.promise(registerPromise, {
            loading: 'Creating your account...',
            success: (response) => {
                const { token, data: { user } } = response.data;
                setAuth(user, token);
                return `Welcome to the team, ${user.username}!`;
            },
            error: (err) => err.response?.data?.message || 'Registration failed'
        });

        try {
            await registerPromise;
            setIsRedirecting(true);
            router.push('/chat');
        } catch (error) {
            // Error handled by toast
        }
    };

    return {
        register: form.register,
        handleSubmit: form.handleSubmit(onSubmit),
        watch: form.watch,
        errors: form.formState.errors,
        isSubmitting: form.formState.isSubmitting || isRedirecting
    };
};