import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from "sonner";
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { loginSchema, type LoginValues } from '@/validators/auth.validator';

export const useLoginForm = () => {
    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);
    // state to lock UI during page transition
    const [isRedirecting, setIsRedirecting] = useState(false);

    const form = useForm<LoginValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        }
    });

    const onSubmit = async (data: LoginValues) => {
        //the promise variable
        const loginPromise = api.post('/auth/login', data);

        toast.promise(loginPromise, {
            loading: 'Authenticating...',
            success: (response) => {
                const { token, data: { user } } = response.data;
                setAuth(user, token);
                return `Welcome back, ${user.username}!`;
            },
            error: (err) => err.response?.data?.message || 'Invalid email or password'
        });

        try {
            // Awaiting the promise
            // This forces isSubmitting to stay true until the API responds.
            await loginPromise;

            // If successful, set redirecting state BEFORE navigation
            setIsRedirecting(true);
            router.push('/chat');
        } catch (error) {
            // If error, isSubmitting automatically becomes false by RHF
            // We don't need to do anything here, toast handled the message
        }
    };

    return {
        register: form.register,
        handleSubmit: form.handleSubmit(onSubmit),
        errors: form.formState.errors,
        // Combine both states for the UI
        isSubmitting: form.formState.isSubmitting || isRedirecting
    };
};