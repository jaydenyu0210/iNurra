import { Stack } from 'expo-router';
import { GlobalHeaderButtons } from '../../src/components/GlobalHeaderRight';

export default function TabLayout() {
    return (
        <Stack screenOptions={{
            headerShown: false,
            headerRight: () => <GlobalHeaderButtons />,
            headerTitle: '',
            headerShadowVisible: false,
            headerTintColor: '#000',
            headerStyle: { backgroundColor: '#fff' }, // Match background
        }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="medications" options={{ title: 'Medications' }} />
            <Stack.Screen name="health" options={{ title: 'Health Metrics' }} />
            <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
            <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        </Stack>
    );
}
