import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeColor {
    id: string;
    name: string;
    color: string; // The Hex for the circle preview UI
    hsl: string;   // The HSL value for Tailwind (e.g., "221.2 83.2% 53.3%")
}

export const THEME_COLORS: ThemeColor[] = [
    { id: 'blue', name: 'Ocean', color: '#3b82f6', hsl: '217 91% 60%' },
    { id: 'violet', name: 'Royal', color: '#7c3aed', hsl: '262 83% 58%' },
    { id: 'midnight', name: 'Midnight', color: '#6366f1', hsl: '244 75% 59%' },
    { id: 'emerald', name: 'Forest', color: '#10b981', hsl: '151 55% 41.5%' },
    { id: 'teal', name: 'Aurora', color: '#14b8a6', hsl: '173 80% 40%' },
    { id: 'rose', name: 'Berry', color: '#e11d48', hsl: '346 84% 61%' },
    { id: 'amber', name: 'Honey', color: '#f59e0b', hsl: '45 93% 47%' },
    { id: 'zinc', name: 'Graphite', color: '#52525b', hsl: '240 5% 33.9%' },
];

interface ConfigState {
    primaryColorId: string;
    setPrimaryColor: (themeId: string) => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set) => ({
            primaryColorId: 'blue', // Default ID
            setPrimaryColor: (themeId) => {
                const theme = THEME_COLORS.find(t => t.id === themeId) || THEME_COLORS[0];

                // This must match the variable used in globals.css
                document.documentElement.style.setProperty('--primary', theme.hsl);

                set({ primaryColorId: themeId });
            },
        }),
        {
            name: 'config-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const theme = THEME_COLORS.find(t => t.id === state.primaryColorId) || THEME_COLORS[0];
                    // Apply immediately on load
                    document.documentElement.style.setProperty('--primary', theme.hsl);
                }
            },
        }
    )
);