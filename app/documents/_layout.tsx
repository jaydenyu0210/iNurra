import { Stack } from 'expo-router';
import { GlobalHeaderButtons } from '../../src/components/GlobalHeaderRight';

export default function DocumentsLayout() {
    return (
        <Stack screenOptions={{
            headerShown: false,
            headerRight: () => <GlobalHeaderButtons />,
            headerTitle: '',
            headerShadowVisible: false,
            headerTintColor: '#000',
            headerStyle: { backgroundColor: '#fff' },
        }}>
            <Stack.Screen name="list" options={{ title: 'Documents' }} />
            <Stack.Screen name="upload" options={{ title: 'Upload' }} />
            <Stack.Screen name="[id]" options={{ title: 'Document Details' }} />
        </Stack>
    );
}
