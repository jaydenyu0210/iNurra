import { FAB } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { StyleSheet } from 'react-native';
import { tokens } from '../theme';

export function GlobalFAB() {
    const router = useRouter();
    const segments = useSegments();

    // Hide on Auth or Chat screens
    const isAuthGroup = segments[0] === '(auth)';
    const isChat = (segments as string[]).includes('chat');

    if (isAuthGroup || isChat) return null;

    return (
        <FAB
            icon="message-text"
            label="Ask Nurra"
            style={styles.fab}
            onPress={() => router.push('/chat/new')}
            mode="elevated"
        />
    );
}

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#D0BCFF', // Primary Container color usually, or tokens.colors.primaryContainer
    },
});
