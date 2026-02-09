'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/useAuthStore';
import { useConfigStore, THEME_COLORS } from '@/store/useConfigStore';
import { api } from '@/lib/api';
import { toast } from "sonner";
import { Camera, User as UserIcon, Palette, Lock, Sun, Moon, Monitor, X, Check } from 'lucide-react';

const MAX_PROFILE_IMAGE_SIZE_MB = 1;
const MAX_PROFILE_IMAGE_BYTES = MAX_PROFILE_IMAGE_SIZE_MB * 1024 * 1024;

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    const { user, setAuth, token } = useAuthStore();
    const { primaryColorId, setPrimaryColor } = useConfigStore();
    const { theme, setTheme } = useTheme();

    const [activeTab, setActiveTab] = useState<'profile' | 'appearance'>('profile');

    const [username, setUsername] = useState(user?.username || '');
    const [about, setAbout] = useState(user?.about || '');
    const [isPrivate, setIsPrivate] = useState((user)?.isPrivate || false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(user?.image || null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setUsername(user.username || '');
            setAbout(user.about || '');
            setIsPrivate((user).isPrivate || false);
            setPreviewUrl(user.image || null);
        }
    }, [user]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // 1. Validation Logic
            if (file.size > MAX_PROFILE_IMAGE_BYTES) {
                toast.error(`Profile image too large. Max size is ${MAX_PROFILE_IMAGE_SIZE_MB}MB.`);
                e.target.value = ''; // Reset input
                return;
            }

            if (!file.type.startsWith('image/')) {
                toast.error("Only image files are allowed.");
                e.target.value = '';
                return;
            }

            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('about', about);
            formData.append('isPrivate', String(isPrivate));

            if (selectedFile) {
                formData.append('image', selectedFile);
            }

            const response = await api.put('/users/profile', formData);

            if (token) {
                setAuth(response.data.data.user, token);
            }

            toast.success("Profile updated successfully!");
            onClose();
        }catch (error: unknown) {
            console.error(error);
            // Cast error to a shape that has response.data.message
            const apiError = error as { response?: { data?: { message?: string } } };
            toast.error(apiError.response?.data?.message || "Failed to update profile");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 p-0 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-bold">Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {!user ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-12">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`flex-1 p-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'text-primary border-b-2 border-primary bg-zinc-50/50 dark:bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                            >
                                <UserIcon className="w-4 h-4" /> Profile
                            </button>
                            <button
                                onClick={() => setActiveTab('appearance')}
                                className={`flex-1 p-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'appearance' ? 'text-primary border-b-2 border-primary bg-zinc-50/50 dark:bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                            >
                                <Palette className="w-4 h-4" /> Appearance
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {activeTab === 'profile' ? (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Avatar Section */}
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="relative group">
                                            <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
                                                {previewUrl ? (
                                                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-3xl font-bold text-zinc-300">
                                                        {user.username[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-all duration-200">
                                                <Camera className="w-8 h-8" />
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                            </label>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-zinc-500">{user.email}</p>
                                        </div>
                                    </div>

                                    {/* Username Field */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Username</label>
                                        <Input
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="johndoe"
                                            className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                        />
                                    </div>

                                    {/* Bio Field */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Bio</label>
                                        <Input
                                            value={about}
                                            onChange={(e) => setAbout(e.target.value)}
                                            placeholder="Write something about yourself..."
                                            className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                                                <Lock className="w-5 h-5 text-zinc-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm">Private Account</h4>
                                                <p className="text-xs text-zinc-500">Only contacts can see your status</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsPrivate(!isPrivate)}
                                            className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ${isPrivate ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    <div className="flex gap-3 justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                        <Button type="button" onClick={onClose} variant="ghost">Cancel</Button>
                                        <Button type="submit" isLoading={isLoading}>Save Changes</Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">App Theme</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'light', icon: Sun, label: 'Light' },
                                                { id: 'dark', icon: Moon, label: 'Dark' },
                                                { id: 'system', icon: Monitor, label: 'System' },
                                            ].map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setTheme(item.id)}
                                                    className={`p-3 rounded-xl border flex flex-col items-center gap-3 transition-all ${theme === item.id
                                                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                                                >
                                                    <item.icon className="w-5 h-5" />
                                                    <span className="text-xs font-semibold">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Accent Color</h3>
                                        <div className="grid grid-cols-4 gap-4">
                                            {THEME_COLORS.map((themeOption) => (
                                                <button
                                                    key={themeOption.id}
                                                    onClick={() => setPrimaryColor(themeOption.id)}
                                                    className="flex flex-col items-center gap-2 group"
                                                    title={themeOption.name}
                                                >
                                                    <div
                                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                                            primaryColorId === themeOption.id
                                                                ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-black scale-110'
                                                                : 'hover:scale-105 opacity-80 hover:opacity-100'
                                                        }`}
                                                        style={{ backgroundColor: themeOption.color }}
                                                    >
                                                        {primaryColorId === themeOption.id && (
                                                            <Check className="w-5 h-5 text-white drop-shadow-md animate-in zoom-in" />
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-medium ${primaryColorId === themeOption.id ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
                                                        {themeOption.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <Button onClick={onClose} className="w-full" variant="outline">Done</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}