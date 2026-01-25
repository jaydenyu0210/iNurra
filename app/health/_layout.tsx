import { Stack } from 'expo-router';

export default function HealthLayout() {
    return (
        <Stack screenOptions={{
            headerShown: false,
        }}>
            <Stack.Screen name="[id]" options={{ headerShown: false }} />
        </Stack>
    );
}

