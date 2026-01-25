import { View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';

export function GlobalHeaderButtons() {
    const router = useRouter();
    return (
        <View style={{ flexDirection: 'row' }}>
            <IconButton icon="plus" onPress={() => router.push('/documents/upload')} />
            <IconButton icon="calendar" onPress={() => router.push('/(tabs)/calendar')} />
        </View>
    );
}
