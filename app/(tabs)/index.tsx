import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, IconButton, useTheme, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../src/theme';
import { useAuth } from '../../src/hooks';

export default function HomeScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();

    const DASHBOARD_BLOCKS = [
        {
            title: 'Medications',
            icon: 'pill',
            color: theme.colors.primary,
            route: '/(tabs)/medications',
        },
        {
            title: 'Health Metrics',
            icon: 'heart-pulse',
            color: theme.colors.secondary,
            route: '/(tabs)/health',
        },
        {
            title: 'Documents',
            icon: 'file-document',
            color: theme.colors.tertiary,
            route: '/documents/list',
        },
        {
            title: 'Body Conditions',
            icon: 'human',
            color: '#FF7043', // Deep Orange
            route: '/(tabs)/body-conditions',
        },
        {
            title: 'Calendar',
            icon: 'calendar',
            color: '#FBBC04',
            route: '/(tabs)/calendar',
        },
    ];



    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <View style={styles.header}>

                <IconButton
                    icon="cog"
                    size={24}
                    onPress={() => router.push('/(tabs)/profile')}
                />
            </View>



            <ScrollView contentContainerStyle={styles.content}>
                {DASHBOARD_BLOCKS.map((block) => (
                    <Card
                        key={block.title}
                        style={styles.card}
                        mode="elevated"
                        onPress={() => router.push(block.route)}
                    >
                        <Card.Content style={styles.cardContent}>
                            <View style={styles.leftContent}>
                                <View style={[styles.iconBox, { backgroundColor: block.color + '20' }]}>
                                    <MaterialCommunityIcons name={block.icon as any} size={32} color={block.color} />
                                </View>
                                <Text variant="titleLarge" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
                                    {block.title}
                                </Text>
                            </View>

                        </Card.Content>
                    </Card>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    greetingContainer: {
        paddingHorizontal: tokens.spacing.lg,
        paddingVertical: tokens.spacing.md,
    },
    content: {
        padding: tokens.spacing.lg,
        gap: tokens.spacing.lg,
        paddingTop: tokens.spacing.sm,
        paddingBottom: 100, // Add padding for footer
    },
    card: {
        borderRadius: tokens.radius.xl,
        justifyContent: 'center',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.md,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: tokens.radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
