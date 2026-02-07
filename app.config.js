import 'dotenv/config';

export default {
    expo: {
        name: 'iNurra',
        slug: 'inurra',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        scheme: 'inurra',
        userInterfaceStyle: 'automatic',
        splash: {
            image: './assets/splash.png',
            resizeMode: 'contain',
            backgroundColor: '#1A73E8',
        },
        assetBundlePatterns: ['**/*'],
        ios: {
            supportsTablet: true,
            bundleIdentifier: 'com.jaydenyu.inurra',
            infoPlist: {
                NSCameraUsageDescription: 'iNurra need camera access to scan your medical documents',
                NSPhotoLibraryUsageDescription: 'iNurra need photo library access to upload medical documents',
                ITSAppUsesNonExemptEncryption: false,
            },
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/adaptive-icon.png',
                backgroundColor: '#1A73E8',
            },
            package: 'com.inurra.app',
            permissions: [
                'android.permission.CAMERA',
                'android.permission.READ_EXTERNAL_STORAGE',
                'android.permission.RECORD_AUDIO',
            ],
        },
        web: {
            bundler: 'metro',
            output: 'static',
            favicon: './assets/favicon.png',
        },
        plugins: [
            'expo-router',
            'expo-secure-store',
            [
                'expo-image-picker',
                {
                    photosPermission: 'Allow iNurra to access your photos to upload medical documents',
                    cameraPermission: 'Allow iNurra to access your camera to scan medical documents',
                },
            ],
            [
                'expo-notifications',
                {
                    color: '#1A73E8',
                },
            ],
        ],
        experiments: {
            typedRoutes: true,
        },
        extra: {
            router: {
                origin: false,
            },
            eas: {
                projectId: '9e6ab5bd-f438-439f-97b3-e7bd40fa07ed',
            },
            // Supabase configuration - these will be bundled into the app
            supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
            supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        owner: 'jiaweiyu2009',
    },
};
