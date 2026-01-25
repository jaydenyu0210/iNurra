// Design Tokens following Material Design 3
export const tokens = {
    // Spacing (8px base unit)
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },

    // Typography
    typography: {
        displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400' as const },
        displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400' as const },
        displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400' as const },
        headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '400' as const },
        headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400' as const },
        headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '400' as const },
        titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '500' as const },
        titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
        titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
        bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
        bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
        bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
        labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
        labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
        labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500' as const },
    },

    // Border Radius
    radius: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 28,
        full: 9999,
    },

    // Colors (Google Material You inspired)
    colors: {
        light: {
            primary: '#1A73E8',
            onPrimary: '#FFFFFF',
            primaryContainer: '#D3E3FD',
            onPrimaryContainer: '#041E49',
            secondary: '#34A853',
            onSecondary: '#FFFFFF',
            secondaryContainer: '#C8E6C9',
            onSecondaryContainer: '#0D3D15',
            tertiary: '#7B61FF',
            onTertiary: '#FFFFFF',
            error: '#EA4335',
            onError: '#FFFFFF',
            errorContainer: '#FDECEA',
            onErrorContainer: '#5F2120',
            warning: '#FBBC04',
            onWarning: '#000000',
            surface: '#FFFFFF',
            onSurface: '#202124',
            surfaceVariant: '#F1F3F4',
            onSurfaceVariant: '#5F6368',
            outline: '#DADCE0',
            outlineVariant: '#E8EAED',
            background: '#FAFAFA',
            onBackground: '#202124',
            shadow: '#000000',
            scrim: 'rgba(0, 0, 0, 0.3)',
        },
        dark: {
            primary: '#8AB4F8',
            onPrimary: '#062E6F',
            primaryContainer: '#0842A0',
            onPrimaryContainer: '#D3E3FD',
            secondary: '#81C995',
            onSecondary: '#003822',
            secondaryContainer: '#005234',
            onSecondaryContainer: '#C8E6C9',
            tertiary: '#B69DF8',
            onTertiary: '#381E72',
            error: '#F28B82',
            onError: '#601410',
            errorContainer: '#8C1D18',
            onErrorContainer: '#F9DEDC',
            warning: '#FDD663',
            onWarning: '#000000',
            surface: '#202124',
            onSurface: '#E8EAED',
            surfaceVariant: '#3C4043',
            onSurfaceVariant: '#BDC1C6',
            outline: '#5F6368',
            outlineVariant: '#3C4043',
            background: '#17181A',
            onBackground: '#E8EAED',
            shadow: '#000000',
            scrim: 'rgba(0, 0, 0, 0.5)',
        },
    },

    // Elevation (MD3 tonal elevation)
    elevation: {
        level0: 0,
        level1: 1,
        level2: 3,
        level3: 6,
        level4: 8,
        level5: 12,
    },
} as const;

export type ThemeTokens = typeof tokens;
export type ColorScheme = 'light' | 'dark';
