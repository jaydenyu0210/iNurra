import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import { tokens } from './tokens';

const fontConfig = {
    fontFamily: 'System',
};

export const lightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: tokens.colors.light.primary,
        onPrimary: tokens.colors.light.onPrimary,
        primaryContainer: tokens.colors.light.primaryContainer,
        onPrimaryContainer: tokens.colors.light.onPrimaryContainer,
        secondary: tokens.colors.light.secondary,
        onSecondary: tokens.colors.light.onSecondary,
        secondaryContainer: tokens.colors.light.secondaryContainer,
        onSecondaryContainer: tokens.colors.light.onSecondaryContainer,
        tertiary: tokens.colors.light.tertiary,
        onTertiary: tokens.colors.light.onTertiary,
        error: tokens.colors.light.error,
        onError: tokens.colors.light.onError,
        errorContainer: tokens.colors.light.errorContainer,
        onErrorContainer: tokens.colors.light.onErrorContainer,
        surface: tokens.colors.light.surface,
        onSurface: tokens.colors.light.onSurface,
        surfaceVariant: tokens.colors.light.surfaceVariant,
        onSurfaceVariant: tokens.colors.light.onSurfaceVariant,
        outline: tokens.colors.light.outline,
        outlineVariant: tokens.colors.light.outlineVariant,
        background: tokens.colors.light.background,
        onBackground: tokens.colors.light.onBackground,
        shadow: tokens.colors.light.shadow,
        scrim: tokens.colors.light.scrim,
    },
    fonts: configureFonts({ config: fontConfig }),
    roundness: tokens.radius.sm,
};

export const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: tokens.colors.dark.primary,
        onPrimary: tokens.colors.dark.onPrimary,
        primaryContainer: tokens.colors.dark.primaryContainer,
        onPrimaryContainer: tokens.colors.dark.onPrimaryContainer,
        secondary: tokens.colors.dark.secondary,
        onSecondary: tokens.colors.dark.onSecondary,
        secondaryContainer: tokens.colors.dark.secondaryContainer,
        onSecondaryContainer: tokens.colors.dark.onSecondaryContainer,
        tertiary: tokens.colors.dark.tertiary,
        onTertiary: tokens.colors.dark.onTertiary,
        error: tokens.colors.dark.error,
        onError: tokens.colors.dark.onError,
        errorContainer: tokens.colors.dark.errorContainer,
        onErrorContainer: tokens.colors.dark.onErrorContainer,
        surface: tokens.colors.dark.surface,
        onSurface: tokens.colors.dark.onSurface,
        surfaceVariant: tokens.colors.dark.surfaceVariant,
        onSurfaceVariant: tokens.colors.dark.onSurfaceVariant,
        outline: tokens.colors.dark.outline,
        outlineVariant: tokens.colors.dark.outlineVariant,
        background: tokens.colors.dark.background,
        onBackground: tokens.colors.dark.onBackground,
        shadow: tokens.colors.dark.shadow,
        scrim: tokens.colors.dark.scrim,
    },
    fonts: configureFonts({ config: fontConfig }),
    roundness: tokens.radius.sm,
};

export type AppTheme = typeof lightTheme;
