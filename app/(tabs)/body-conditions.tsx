import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { tokens } from '../../src/theme';
import { BodyCondition, BodilyExcretion } from '../../src/types/database';

// Group conditions by label
interface LabelGroup {
    label: string;
    displayName: string;
    conditions: BodyCondition[];
    latestCondition: BodyCondition;
    count: number;
}

// Sub-component to handle secure image loading for the thumbnail
const LabelThumbnail = ({ condition, theme }: { condition: BodyCondition, theme: any }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadImage = async () => {
            if (condition.document_id && supabase) {
                try {
                    const { data: doc } = await supabase
                        .from('documents')
                        .select('storage_path')
                        .eq('id', condition.document_id)
                        .single();

                    const storagePath = (doc as any)?.storage_path;
                    if (storagePath) {
                        const { data } = await supabase.storage
                            .from('documents')
                            .createSignedUrl(storagePath, 3600);

                        if (data?.signedUrl) {
                            setImageUrl(data.signedUrl);
                        }
                    }
                } catch (e) {
                    console.error('Error loading condition image:', e);
                }
            }
        };
        loadImage();
    }, [condition.document_id]);

    if (imageUrl) {
        return (
            <View style={[styles.itemIcon, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
                <Image
                    source={{ uri: imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
            </View>
        );
    }

    return (
        <View style={[styles.itemIcon, { backgroundColor: theme.colors.errorContainer }]}>
            <MaterialCommunityIcons name="alert-circle" size={24} color={theme.colors.error} />
        </View>
    );
};

// Helper to format label to display name
const formatLabelToDisplayName = (label: string): string => {
    return label
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Get status color
const getStatusColor = (status: string | null, theme: any) => {
    switch (status) {
        case 'improving':
            return { bg: theme.colors.primaryContainer, text: theme.colors.primary };
        case 'worsening':
            return { bg: theme.colors.errorContainer, text: theme.colors.error };
        case 'no_significant_change':
            return { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant };
        case 'initial':
        default:
            return { bg: theme.colors.tertiaryContainer, text: theme.colors.tertiary };
    }
};

// Format status for display
const formatStatus = (status: string | null): string => {
    switch (status) {
        case 'improving': return 'Improving';
        case 'worsening': return 'Worsening';
        case 'no_significant_change': return 'No Change';
        case 'initial':
        default: return 'Initial';
    }
};

export default function BodyConditionsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();

    const [bodyConditions, setBodyConditions] = useState<BodyCondition[]>([]);
    const [bodilyExcretions, setBodilyExcretions] = useState<BodilyExcretion[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user?.id || !supabase) return;

        try {
            // Fetch body conditions
            const { data: conditions, error: conditionsError } = await supabase
                .from('body_conditions')
                .select('*')
                .eq('user_id', user.id)
                .order('observed_at', { ascending: false });

            if (conditionsError) throw conditionsError;
            setBodyConditions(conditions || []);

            // Fetch bodily excretions
            const { data: excretions, error: excretionsError } = await supabase
                .from('bodily_excretions')
                .select('*')
                .eq('user_id', user.id)
                .order('observed_at', { ascending: false });

            if (excretionsError) throw excretionsError;
            setBodilyExcretions(excretions || []);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    // Group conditions by label
    const labelGroups: LabelGroup[] = (() => {
        const groups = new Map<string, BodyCondition[]>();

        for (const condition of bodyConditions) {
            const label = condition.label || `unlabeled_${condition.id}`;
            if (!groups.has(label)) {
                groups.set(label, []);
            }
            groups.get(label)!.push(condition);
        }

        return Array.from(groups.entries()).map(([label, conditions]) => ({
            label,
            displayName: label.startsWith('unlabeled_')
                ? (conditions[0].condition_type || 'Unknown Condition')
                : formatLabelToDisplayName(label),
            conditions: conditions.sort((a, b) =>
                new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
            ),
            latestCondition: conditions[0],
            count: conditions.length,
        }));
    })();

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <IconButton icon="arrow-left" size={24} onPress={() => router.replace('/(tabs)')} />
                    <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                        Body Conditions
                    </Text>
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const isEmpty = bodyConditions.length === 0 && bodilyExcretions.length === 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    size={24}
                    onPress={() => router.replace('/(tabs)')}
                />
                <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                    Body Conditions
                </Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {isEmpty ? (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="human" size={64} color={theme.colors.outline} />
                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: tokens.spacing.lg }}>
                            No Records Found
                        </Text>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: tokens.spacing.sm }}>
                            Upload a photo to track body conditions or excretions
                        </Text>
                        <Button
                            mode="contained"
                            style={{ marginTop: tokens.spacing.lg }}
                            onPress={() => router.push('/documents/upload')}
                        >
                            Upload
                        </Button>
                    </View>
                ) : (
                    <>
                        {labelGroups.length > 0 && (
                            <View style={styles.section}>
                                {labelGroups.map((group) => {
                                    const statusColors = getStatusColor(group.latestCondition.progression_status, theme);
                                    return (
                                        <Card
                                            key={group.label}
                                            style={styles.itemCard}
                                            mode="elevated"
                                            onPress={() => router.push({
                                                pathname: '/body-conditions/[id]',
                                                params: { id: group.label, type: 'label' }
                                            })}
                                        >
                                            <Card.Content style={styles.itemContent}>
                                                <LabelThumbnail condition={group.latestCondition} theme={theme} />
                                                <View style={styles.itemInfo}>
                                                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                                                        {group.displayName}
                                                    </Text>
                                                    <View style={styles.detailsRow}>
                                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                            {group.count} {group.count === 1 ? 'photo' : 'photos'}
                                                        </Text>
                                                        <View style={[styles.badge, { backgroundColor: statusColors.bg, marginLeft: 8 }]}>
                                                            <Text variant="labelSmall" style={{ color: statusColors.text }}>
                                                                {formatStatus(group.latestCondition.progression_status)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                                <IconButton
                                                    icon="plus"
                                                    size={20}
                                                    onPress={() => router.push({
                                                        pathname: '/documents/upload',
                                                        params: { presetLabel: group.label }
                                                    })}
                                                />
                                            </Card.Content>
                                        </Card>
                                    );
                                })}
                            </View>
                        )}

                        {bodilyExcretions.length > 0 && (
                            <View style={styles.section}>
                                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                                    Excretions ({bodilyExcretions.length})
                                </Text>
                                {bodilyExcretions.map((excretion) => (
                                    <Card
                                        key={excretion.id}
                                        style={styles.itemCard}
                                        mode="elevated"
                                        onPress={() => router.push({
                                            pathname: '/body-conditions/[id]',
                                            params: { id: excretion.id, type: 'excretion' }
                                        })}
                                    >
                                        <Card.Content style={styles.itemContent}>
                                            <View style={[styles.itemIcon, { backgroundColor: theme.colors.tertiaryContainer }]}>
                                                <MaterialCommunityIcons name="water" size={24} color={theme.colors.tertiary} />
                                            </View>
                                            <View style={styles.itemInfo}>
                                                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                                                    {excretion.excretion_type}
                                                </Text>
                                                <View style={styles.detailsRow}>
                                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                        {new Date(excretion.observed_at).toLocaleDateString()}
                                                    </Text>
                                                    {(excretion.color || excretion.consistency) && (
                                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                                                            {[excretion.color, excretion.consistency].filter(Boolean).join(' - ')}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                            <IconButton icon="chevron-right" size={20} />
                                        </Card.Content>
                                    </Card>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: tokens.spacing.sm,
        paddingTop: tokens.spacing.sm,
        paddingBottom: tokens.spacing.sm,
    },
    content: {
        padding: tokens.spacing.lg,
        paddingBottom: 100,
    },
    section: {
        marginBottom: tokens.spacing.xl,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: tokens.spacing.md,
    },
    itemCard: {
        marginBottom: tokens.spacing.md,
        borderRadius: tokens.radius.md,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.md,
    },
    itemIcon: {
        width: 48,
        height: 48,
        borderRadius: tokens.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
        marginTop: tokens.spacing.xxl,
    },
});
