
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '../src/hooks';
import { lightTheme } from '../src/theme';
import { AppFooter } from '../src/components/AppFooter';

const queryClient = new QueryClient();

// DEV MODE: Set to true to skip phone auth entirely
const DEV_MODE = false;

function AuthProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isInitialized, setDevSession } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        // In dev mode, auto-authenticate with real Supabase session
        if (DEV_MODE && isInitialized && !isAuthenticated) {
            (async () => {
                await setDevSession();
            })();
            return;
        }

        if (!isInitialized) return;

        const inAuthGroup = segments[0] === '(auth)';

        // In DEV_MODE, always go to tabs
        if (DEV_MODE) {
            if (inAuthGroup) {
                router.replace('/(tabs)');
            }
            return;
        }

        if (!isAuthenticated && !inAuthGroup) {
            router.replace('/(auth)/welcome');
        } else if (isAuthenticated && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, isInitialized, segments]);

    return <>{children}</>;
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <PaperProvider theme={lightTheme}>
                        <AuthProvider>
                            <View style={styles.container}>
                                <StatusBar style="dark" />
                                <Stack screenOptions={{ headerShown: false }}>
                                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                    <Stack.Screen name="documents" options={{ headerShown: false }} />
                                    <Stack.Screen name="chat" options={{ headerShown: false }} />
                                </Stack>
                                <AppFooter />
                            </View>
                        </AuthProvider>
                    </PaperProvider>
                </GestureHandlerRootView>
            </SafeAreaProvider>
        </QueryClientProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
