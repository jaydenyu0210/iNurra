import { create } from 'zustand';
import { ColorScheme } from '../theme/tokens';

interface UIState {
    colorScheme: ColorScheme;
    isOnboardingComplete: boolean;

    // Actions
    setColorScheme: (scheme: ColorScheme) => void;
    toggleColorScheme: () => void;
    setOnboardingComplete: (complete: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
    colorScheme: 'light',
    isOnboardingComplete: false,

    setColorScheme: (colorScheme) => set({ colorScheme }),

    toggleColorScheme: () => {
        const current = get().colorScheme;
        set({ colorScheme: current === 'light' ? 'dark' : 'light' });
    },

    setOnboardingComplete: (isOnboardingComplete) => set({ isOnboardingComplete }),
}));
