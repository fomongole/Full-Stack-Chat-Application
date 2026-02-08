'use client';

import { useEffect } from 'react';
import { useConfigStore, THEME_COLORS } from '@/store/useConfigStore';

export function ThemeInitializer() {
    // 1. Get the ID from the store
    const primaryColorId = useConfigStore((state) => state.primaryColorId);

    useEffect(() => {
        // 2. Find the matching theme object
        const theme = THEME_COLORS.find(t => t.id === primaryColorId) || THEME_COLORS[0];

        // 3. Inject the HSL channels into the CSS variable
        document.documentElement.style.setProperty('--primary', theme.hsl);

    }, [primaryColorId]);

    return null;
}